import hashlib
import re
from html.parser import HTMLParser

_BLOCK_TAGS = {"p", "div", "br", "ul", "ol", "li", "tr", "section", "h1", "h2", "h3", "h4", "h5", "h6"}


class _Stripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")
            if tag == "li":
                self.parts.append("• ")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


# Characters a UTF-8 continuation byte (0x80-0xBF) turns into when mis-decoded as Windows-1252/Latin-1
_CONT = "".join(bytes([b]).decode("cp1252", errors="ignore") for b in range(0x80, 0xC0))
# "Â·", "Â®", "Ã©" (2-byte sequences) and "â€™" (3-byte sequences) left behind by that mistake
_BROKEN_SEQ = re.compile(rf"[\u00c2-\u00df][{_CONT}]|[\u00e0-\u00ef][{_CONT}]{{2}}")


def _repair(match: re.Match) -> str:
    try:
        return match.group(0).encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return match.group(0)


def fix_mojibake(text: str) -> str:
    """Repair text that was UTF-8 but got decoded as Latin-1 somewhere upstream.

    Some feeds (Remote OK) ship descriptions like "Full-timeÂ\u00a0Permanent", "Â£134,600" or "donâ€™t",
    which otherwise show up as stray characters. Correct text is left untouched.
    """
    if not _BROKEN_SEQ.search(text) and "Â" not in text:
        return text
    text = _BROKEN_SEQ.sub(_repair, text)
    return re.sub(r"Â(?=[\s.,;:!?)]|$)", "", text)  # a lone leftover "Â" next to whitespace or punctuation


def html_to_text(raw: str | None) -> str:
    """Strip tags from a job description while keeping paragraph and bullet breaks."""
    if not raw:
        return ""
    parser = _Stripper()
    parser.feed(raw)
    parser.close()
    text = fix_mojibake("".join(parser.parts))
    text = re.sub(r"[ \t\r\f\v ]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _norm(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def dedupe_key(company: str | None, title: str, location: str | None) -> str:
    """Same company + title + place => same job, even when two platforms both list it."""
    place = _norm((location or "").split(",")[0])
    return hashlib.sha1(f"{_norm(company)}|{_norm(title)}|{place}".encode()).hexdigest()


def truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
