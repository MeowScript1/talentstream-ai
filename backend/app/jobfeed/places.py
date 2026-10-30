"""Indian cities go by more than one name, so a search for one should find the others."""

# Each group is one city; the first name is what we ask job APIs for.
_GROUPS = (
    ("Bengaluru", "Bangalore", "Bengaluru Urban"),
    ("Mumbai", "Bombay", "Navi Mumbai", "Thane"),
    ("Delhi", "New Delhi", "Delhi NCR"),
    ("Gurugram", "Gurgaon"),
    ("Noida", "Greater Noida"),
    ("Chennai", "Madras"),
    ("Kolkata", "Calcutta"),
    ("Hyderabad", "Secunderabad"),
    ("Pune", "Poona"),
    ("Kochi", "Cochin"),
    ("Thiruvananthapuram", "Trivandrum"),
    ("Vadodara", "Baroda"),
    ("Visakhapatnam", "Vizag"),
    ("Mysuru", "Mysore"),
    ("Ahmedabad",),
    ("Jaipur",),
    ("Chandigarh",),
    ("Indore",),
    ("Lucknow",),
    ("Coimbatore",),
)

# Cities we ask job APIs about directly, so a search by city has real results
MAJOR_CITIES = ("Bengaluru", "Hyderabad", "Mumbai", "Delhi", "Pune", "Chennai", "Kolkata", "Gurugram", "Noida", "Ahmedabad")

_BY_NAME = {name.lower(): group for group in _GROUPS for name in group}


def location_variants(text: str) -> list[str]:
    """What to look for when someone types a city: the text itself plus every other name of that city."""
    text = text.strip()
    variants = [text]
    group = _BY_NAME.get(text.lower())
    if group:
        variants += [name for name in group if name.lower() != text.lower()]
    return variants


def canonical_city(text: str) -> str:
    """The name we store for a city: the main name of its group (Bangalore -> Bengaluru), else what was typed."""
    text = text.strip()
    group = _BY_NAME.get(text.lower())
    return group[0] if group else text.title()
