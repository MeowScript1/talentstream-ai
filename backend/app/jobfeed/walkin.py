"""Spot walk-in interview drives in a job's text and read when and where they are.

Walk-in drives are rarely available as structured data, so this works from the wording of the posting
("Walk-in interview on 28th Oct, 10 AM to 4 PM, Venue: ..."). It only looks for dates near the words
"walk-in", so unrelated dates (a company's founding year, "apply before") don't count.
"""

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

WALKIN_WORD = re.compile(r"\bwalk[\s-]?ins?\b", re.IGNORECASE)
NEGATED = re.compile(r"\b(?:no|not|without|don'?t)\s+(?:accept\s+)?walk[\s-]?ins?\b", re.IGNORECASE)

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MON = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
_DAY = r"(\d{1,2})(?!\d)(?:st|nd|rd|th)?"  # (?!\d): "Oct 2026" is a year, not "Oct 20" + "26"
_RANGE = r"(?:\s*(?:-|–|—|to|&|and)\s*" + _DAY + r")?"

# 28th Oct, 28 October 2026, 26-28 Oct, 26th & 27th October
_DAY_FIRST = re.compile(rf"\b{_DAY}{_RANGE}\s+(?:of\s+)?{_MON}\b\.?(?:,?\s*(\d{{4}}))?", re.IGNORECASE)
# Oct 28, October 28th 2026, Oct 26-28
_MONTH_FIRST = re.compile(rf"\b{_MON}\b\.?\s+{_DAY}(?:\s*(?:-|–|—|to)\s*{_DAY})?(?:,?\s*(\d{{4}}))?", re.IGNORECASE)
# 28/10/2026 or 28-10-26 (day first, as written in India); swapped if the second number can't be a month
_NUMERIC = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b")
_RELATIVE = re.compile(r"\b(today|tomorrow)\b", re.IGNORECASE)

_TIME = re.compile(
    r"(\d{1,2}(?::\d{2})?\s*(?:a\.?m|p\.?m)\.?)\s*(?:-|–|—|to|till|until)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m|p\.?m)\.?)",
    re.IGNORECASE,
)
# The venue ends at a line break, a " | " separator, or the end of a sentence (". " then a capital)
_VENUE = re.compile(r"(?i:venue|address|location)\s*[:\-–]\s*(.{8,200}?)(?:\n|$|(?<=[a-z0-9])\.\s+(?=[A-Z])|\s\|\s)")

# Look this far around the words "walk-in" for the date, time and venue
_BEFORE, _AFTER = 250, 600


@dataclass
class WalkInInfo:
    dates: list[date] = field(default_factory=list)  # every day mentioned (any year)
    time: str | None = None
    venue: str | None = None

    def upcoming(self, today: date) -> list[date]:
        return sorted(d for d in self.dates if d >= today)

    def first_upcoming(self, today: date) -> date | None:
        coming = self.upcoming(today)
        return coming[0] if coming else None

    def within(self, today: date, days: int = 7) -> list[date]:
        end = today + timedelta(days=days)
        return [d for d in self.upcoming(today) if d <= end]


def _resolve(day: int, month: int, year: int | None, today: date) -> date | None:
    """Build a date; with no year given, pick the year that makes it recent or upcoming."""
    candidates = [year] if year else [today.year, today.year + 1]
    for y in candidates:
        try:
            d = date(y, month, day)
        except ValueError:
            continue
        if year or d >= today - timedelta(days=60):
            return d
    return None


def _expand(day1: int, day2: int | None, month: int, year: int | None, today: date) -> list[date]:
    first = _resolve(day1, month, year, today)
    if first is None:
        return []
    if day2 is None or day2 < day1 or day2 - day1 > 31:
        return [first]
    out = []
    for d in range(day1, day2 + 1):
        resolved = _resolve(d, month, first.year, today)
        if resolved:
            out.append(resolved)
    return out or [first]


def _month_number(token: str) -> int:
    return _MONTHS[token[:3].lower()]


def _is_real_may(token: str) -> bool:
    # "may" is also an everyday word ("candidates may apply"), so only trust "May" / "MAY" for the month
    return token.lower() != "may" or token in ("May", "MAY")


def _dates_in(window: str, today: date) -> list[date]:
    found: list[date] = []

    for m in _DAY_FIRST.finditer(window):
        if not _is_real_may(m.group(3)):
            continue
        year = int(m.group(4)) if m.group(4) else None
        found += _expand(int(m.group(1)), int(m.group(2)) if m.group(2) else None, _month_number(m.group(3)), year, today)

    for m in _MONTH_FIRST.finditer(window):
        if not _is_real_may(m.group(1)):
            continue
        year = int(m.group(4)) if m.group(4) else None
        found += _expand(int(m.group(2)), int(m.group(3)) if m.group(3) else None, _month_number(m.group(1)), year, today)

    for m in _NUMERIC.finditer(window):
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        day, month = (b, a) if b > 12 >= a else (a, b)
        if 1 <= month <= 12:
            resolved = _resolve(day, month, y + 2000 if y < 100 else y, today)
            if resolved:
                found.append(resolved)

    for m in _RELATIVE.finditer(window):
        found.append(today if m.group(1).lower() == "today" else today + timedelta(days=1))

    return found


def _clean_time(value: str) -> str:
    value = re.sub(r"\s+", " ", value.replace(".", "")).strip().upper()
    return re.sub(r"(\d)(AM|PM)", r"\1 \2", value)


def detect_walkin(text: str, today: date) -> WalkInInfo | None:
    """Return walk-in details if the posting describes a walk-in drive, otherwise None."""
    if not text:
        return None
    positives = [m for m in WALKIN_WORD.finditer(text) if not NEGATED.search(text[max(0, m.start() - 12) : m.end()])]
    if not positives:
        return None

    info = WalkInInfo()
    seen: set[date] = set()
    for m in positives:
        window = text[max(0, m.start() - _BEFORE) : m.end() + _AFTER]
        for d in _dates_in(window, today):
            if d not in seen:
                seen.add(d)
                info.dates.append(d)
        if info.time is None and (t := _TIME.search(window)):
            info.time = f"{_clean_time(t.group(1))} – {_clean_time(t.group(2))}"
        if info.venue is None and (v := _VENUE.search(window)):
            info.venue = re.sub(r"\s+", " ", v.group(1)).strip(" .,-")
    info.dates.sort()
    return info
