def ticket_price_for_roll(event: dict, roll_number: str) -> float:
    prefix = roll_number.strip().upper()[:2]
    if prefix == "26":
        year = "first"
        price = event.get("first_year_ticket_price")
    elif prefix == "25":
        year = "second"
        price = event.get("second_year_ticket_price")
    else:
        year = "other"
        price = event.get("other_ticket_price")

    if price is None:
        if year == "other":
            raise ValueError("This roll-number prefix is not eligible for registration. Contact event staff to confirm the correct fee.")
        raise ValueError(f"The {year}-year ticket price has not been configured for this event.")
    return round(float(price), 2)
