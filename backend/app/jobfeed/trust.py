"""How trustworthy does a job listing look?

This is a set of transparent rules, not a verdict. It looks for the things that scam postings share
(asking for money, chat-app-only contact, "earn lakhs from home", free-email recruiters, no real
company) and for the things that real postings share (a named company, an application link on the
company's own site or a known hiring system, a substantive description). Every rule that fires is
reported with a plain-language reason, so a candidate can see *why* a job got its rating.

It can't prove a listing is real, and a determined scammer can write a clean-looking post. Treat
"looks good" as "no red flags found", and keep reporting (see the report button) as the second layer.
"""

import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.jobfeed.types import RawJob

GOOD_THRESHOLD = 70
RISKY_THRESHOLD = 45  # below this a listing is hidden by default


@dataclass
class Reason:
    code: str
    text: str
    impact: int  # points added (+) or removed (-)


@dataclass
class TrustResult:
    score: int
    label: str  # looks_good | be_careful | likely_scam
    reasons: list[Reason]

    def reasons_as_dicts(self) -> list[dict]:
        return [asdict(r) for r in self.reasons]


# ── red flags ────────────────────────────────────────────────────────────────

_FEE_WORDS = r"(?:registration|security|training|joining|application|verification|admission|refundable|kit|id[\s-]?card|laptop|uniform|courier)"
_ASKS_MONEY = re.compile(
    rf"\b{_FEE_WORDS}\s+(?:fee|fees|deposit|charges?)\b"
    r"|\b(?:pay|deposit|send|transfer|invest)\s+(?:rs\.?|inr|₹|usd|\$)\s?\d[\d,]*"
    r"|\bpay\s+(?:to\s+(?:apply|join|get)|the\s+(?:fee|amount))\b"
    r"|\b(?:investment|deposit)\s+(?:is\s+)?(?:required|needed|mandatory)\b"
    r"|\bpurchase\s+(?:a\s+)?(?:starter\s+)?kit\b",
    re.IGNORECASE,
)
_NEGATION_BEFORE = re.compile(r"\b(?:no|without|never|zero|nil|not\s+charge[sd]?|free\s+of)\s+(?:\w+\s+){0,2}$", re.IGNORECASE)

_CHAT_APP = re.compile(r"\b(?:whats\s?app|telegram)\b|\bt\.me/|\bwa\.me/", re.IGNORECASE)
_ASK_VERB = re.compile(r"\b(?:contact|message|reach|text|ping|dm|send|apply|forward|share|connect|call|chat|join|whatsapp(?:\s+us)?\s+(?:on|at))\b", re.IGNORECASE)
_ASK_FORM = re.compile(r"\bwhats\s?app\s+(?:your|me|us|the|resume|cv)\b|\b(?:cv|resume)\s+(?:on|to|via)\s+(?:whats\s?app|telegram)\b", re.IGNORECASE)
_PHONE = re.compile(r"\+?\d[\d\s-]{8,}\d|\b[6-9]\d{9}\b")
_WARNING_WORDS = re.compile(r"\b(?:do\s+not|don'?t|never|will\s+not|won'?t|not|beware|scam|scams|fraud|fake|impersonat\w*)\b", re.IGNORECASE)
_UNREALISTIC_PAY = re.compile(
    r"\b(?:earn|income|salary)\b[^.\n]{0,40}?\b(?:\d{2,3},?\d{3}|\d{2,3}\s?k|\d+\s?lakhs?)\b[^.\n]{0,25}?\b(?:per|a|/)\s*(?:day|week)\b"
    r"|\bguaranteed\s+(?:income|salary|job|placement|selection)\b"
    r"|\b100\s?%\s+(?:job\s+)?(?:guarantee|placement)\b"
    r"|\bearn\s+(?:up\s+to\s+)?(?:rs\.?|₹|\$)\s?\d[\d,]*\s*(?:per|/|a)\s*(?:day|week|hour)\b"
    r"|\bno\s+(?:experience|skills?|qualification)s?\s+(?:required|needed)\b[^.\n]{0,80}(?:₹|rs\.?|\$)\s?\d{2,3},?\d{3}",
    re.IGNORECASE,
)
_NO_INTERVIEW = re.compile(
    r"\b(?:no\s+interview|direct\s+joining|instant\s+(?:offer|joining|selection)|selection\s+guaranteed|offer\s+letter\s+(?:immediately|same\s+day))\b",
    re.IGNORECASE,
)
_FREE_EMAIL = re.compile(r"[\w.+-]+@(?:gmail|yahoo|ymail|outlook|hotmail|rediffmail|live|aol|proton(?:mail)?)\.(?:com|in|me)\b", re.IGNORECASE)
_SHORTENERS = re.compile(r"\b(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly|rb\.gy|shorturl\.at|is\.gd|goo\.gl|ow\.ly|tiny\.cc)/", re.IGNORECASE)
_HYPE = re.compile(r"!{3,}|\b(?:urgent(?:ly)?\s+hiring|immediate\s+joining|hurry\s+up|limited\s+(?:seats|vacancies)|last\s+chance)\b", re.IGNORECASE)

_GENERIC_COMPANIES = {
    "", "confidential", "hiring", "company", "anonymous", "n/a", "na", "private", "not disclosed", "various",
    "multiple", "mnc", "reputed company", "leading company", "top company", "undisclosed",
}

# ── green flags ──────────────────────────────────────────────────────────────

_KNOWN_HIRING_SYSTEMS = (
    "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com", "myworkdayjobs.com",
    "bamboohr.com", "recruitee.com", "teamtailor.com", "jobvite.com", "icims.com", "breezy.hr", "personio.de",
    "personio.com", "join.com", "applytojob.com", "taleo.net", "successfactors.com",
)
# Boards that carry other companies' postings: a link to them says nothing about the company itself
_JOB_BOARDS = ("remotive.com", "remoteok.com", "adzuna.", "arbeitnow.com", "linkedin.com", "indeed.", "naukri.com", "glassdoor.")
_SOURCE_BASELINE = {
    "remotive": (10, "Listed on Remotive, a moderated job board"),
    "remoteok": (6, "Listed on Remote OK, a curated remote-jobs board"),
}
_STRUCTURE_WORDS = re.compile(r"\b(?:responsibilit|requirement|qualification|experience|skills?|about\s+(?:us|the\s+role)|benefits)", re.IGNORECASE)


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _company_tokens(company: str) -> list[str]:
    stop = {"inc", "llc", "ltd", "limited", "gmbh", "corp", "company", "technologies", "technology", "solutions", "group", "labs", "pvt", "private", "software"}
    return [t for t in re.findall(r"[a-z0-9]+", company.lower()) if len(t) >= 4 and t not in stop]


def _asks_to_chat(text: str) -> bool:
    """True if the posting tells you to reach them on WhatsApp/Telegram (not a warning about it)."""
    for m in _CHAT_APP.finditer(text):
        before = text[max(0, m.start() - 70) : m.start()]
        near = text[max(0, m.start() - 50) : m.end() + 50]
        if _WARNING_WORDS.search(before):
            continue  # e.g. "We do not conduct interviews over WhatsApp or Telegram"
        if _ASK_VERB.search(near) or _ASK_FORM.search(near) or _PHONE.search(near):
            return True
    return False


def _asks_for_money(text: str) -> bool:
    for m in _ASKS_MONEY.finditer(text):
        if not _NEGATION_BEFORE.search(text[max(0, m.start() - 25) : m.start()]):
            return True
    return False


def looks_like_fee_request(text: str) -> bool:
    """True if the text asks candidates to pay (registration fee, deposit, kit...). Used to refuse such posts."""
    return _asks_for_money(text)


def assess(job: RawJob, now: datetime | None = None) -> TrustResult:
    now = now or datetime.now(timezone.utc)
    reasons: list[Reason] = []
    score = 55

    def add(code: str, text: str, impact: int) -> None:
        nonlocal score
        score += impact
        reasons.append(Reason(code, text, impact))

    text = f"{job.title}\n{job.description}"
    company = (job.company or "").strip()
    host = _host(job.url)

    # --- red flags
    money = _asks_for_money(text)
    if money:
        add("asks_for_money", "Asks candidates to pay a fee or deposit. Real employers never charge to hire you", -50)
    if _UNREALISTIC_PAY.search(text):
        add("unrealistic_pay", "Promises unrealistic or guaranteed earnings", -25)
    if _NO_INTERVIEW.search(text):
        add("no_interview", "Offers a job with no interview or 'instant joining', which is typical of scams", -20)
    if _asks_to_chat(text):
        add("chat_contact", "Moves the conversation to WhatsApp or Telegram, a common scam pattern", -15)
    if _FREE_EMAIL.search(text):
        add("free_email", "Recruiter uses a free personal email (Gmail, Yahoo, etc.) instead of a company address", -20)
    if _SHORTENERS.search(job.url or "") or _SHORTENERS.search(job.description or ""):
        add("short_link", "Uses a shortened link that hides where you are being sent", -20)
    if (job.url or "").startswith("http://"):
        add("insecure_link", "Application link is not secure (http)", -8)
    if _HYPE.search(text):
        add("hype", "Uses pressure language like 'urgent hiring' or 'limited seats'", -10)
    letters = [c for c in job.title if c.isalpha()]
    if len(letters) > 12 and sum(c.isupper() for c in letters) / len(letters) > 0.7:
        add("shouting", "Title is written in all capitals", -5)
    if company.lower() in _GENERIC_COMPANIES:
        add("no_company", "No real company name is given", -15)

    # --- green flags
    if job.verified_by_source:
        add("source_verified", "The source platform marks this listing as verified", 12)
    if job.source in _SOURCE_BASELINE:
        points, text_ = _SOURCE_BASELINE[job.source]
        add("moderated_source", text_, points)
    if host and any(host == d or host.endswith("." + d) for d in _KNOWN_HIRING_SYSTEMS):
        add("known_ats", "Application goes through a recognised hiring system", 8)
    elif company and host and not any(b in host for b in _JOB_BOARDS):
        tokens = _company_tokens(company)
        if tokens and any(t in host.replace("-", "") for t in tokens):
            add("company_site", "Application link points to the company's own website", 10)
    if company.lower() not in _GENERIC_COMPANIES:
        add("named_company", "A named company is listed", 6)
    if job.salary_text:
        add("salary_listed", "Salary is stated", 4)

    length = len(job.description or "")
    if length >= 600:
        add("detailed", "Detailed description", 8)
    elif length >= 300:
        add("some_detail", "Reasonable description", 4)
    elif length < 120:
        add("thin", "Very little detail about the role", -15)
    if len(_STRUCTURE_WORDS.findall(job.description or "")) >= 2:
        add("structured", "Describes responsibilities and requirements", 5)

    if job.posted_at:
        age = (now - (job.posted_at if job.posted_at.tzinfo else job.posted_at.replace(tzinfo=timezone.utc))).days
        if age <= 14:
            add("fresh", "Posted recently", 4)
        elif age > 120:
            add("very_stale", "Posted over four months ago, so it may be filled", -20)
        elif age > 60:
            add("stale", "Posted over two months ago", -10)

    score = max(0, min(100, score))
    if money:
        score = min(score, 25)  # asking for money is disqualifying whatever else looks good
    label = "looks_good" if score >= GOOD_THRESHOLD else "be_careful" if score >= RISKY_THRESHOLD else "likely_scam"
    reasons.sort(key=lambda r: abs(r.impact), reverse=True)
    return TrustResult(score=score, label=label, reasons=reasons)
