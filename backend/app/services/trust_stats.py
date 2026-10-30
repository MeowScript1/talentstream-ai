"""Plain-number summaries for the company check and the reporter ranks. No guesses: too little data says so."""

from statistics import median

# An employer needs this many applications older than a week before we show a response rate
MIN_APPLICATIONS_FOR_RATE = 5
MIN_DECISIONS_FOR_SPEED = 3
RESPONSE_WINDOW_DAYS = 7

POINTS_PER_CONFIRMED_REPORT = 5
# (points needed, rank name), lowest first
RANKS = [(0, "New reporter"), (5, "Scout"), (15, "Senior scout"), (50, "Lead scout")]


def response_summary(applications: int, decided: int, days_to_decision: list[float]) -> dict:
    """applications = those at least a week old; decided = how many of them got a shortlist or rejection."""
    enough = applications >= MIN_APPLICATIONS_FOR_RATE
    return {
        "applications": applications,
        "decided": decided,
        "response_rate": round(100 * decided / applications) if enough else None,
        "median_days_to_decision": round(median(days_to_decision), 1) if len(days_to_decision) >= MIN_DECISIONS_FOR_SPEED else None,
    }


def rank_for(points: int) -> dict:
    """The current rank and what the next one needs (None at the top)."""
    current = RANKS[0][1]
    next_at = None
    for i, (need, name) in enumerate(RANKS):
        if points >= need:
            current = name
            next_at = RANKS[i + 1][0] if i + 1 < len(RANKS) else None
    return {"rank": current, "next_rank_at": next_at}
