from .models import Cat, Context


def sentence(cat: Cat, c: Context, lane: str, failures: list[str], pending: bool) -> str:
    if pending:
        return f"{cat.name} found a meal. Let’s see if they keep it for 20 minutes."
    if lane == "kitchen":
        age = f"{c.token_age_days:g} days" if c.token_age_days is not None else "a while"
        return f"{cat.name} still holds it, smart flow is up, and the token is {age} old."
    if lane == "forage":
        if c.token_age_days is not None and c.token_age_days < 7:
            return f"{cat.name} found something young. A tiny gamble, with a 36-hour bedtime."
        return f"{cat.name} found a mushroom. {failures[0] if failures else 'Kitchen checks did not all pass.'}"
    return failures[0] if failures else "Leave this one in the meadow."

