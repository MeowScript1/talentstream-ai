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


def html_to_text(raw: str | None) -> str:
    """Strip tags from a job description while keeping paragraph and bullet breaks."""
    if not raw:
        return ""
    parser = _Stripper()
    parser.feed(raw)
    parser.close()
    text = "".join(parser.parts)
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
