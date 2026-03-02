"""Number formatting matching the web app's 4 locale/decimal modes."""

FORMAT_ORDER = ["2dec", "0dec", "eu2dec", "eu0dec"]

FORMAT_LABELS = {
    "2dec": "1,234.56",
    "0dec": "1,235",
    "eu2dec": "1.234,56",
    "eu0dec": "1.235",
}


def format_number(n, number_format="2dec"):
    if n is None or n != n:  # NaN check
        return "0.00"

    fmt = number_format if number_format in FORMAT_LABELS else "2dec"
    is_eu = fmt.startswith("eu")
    decimals = 2 if "2dec" in fmt else 0

    if decimals > 0:
        formatted = f"{abs(n):,.2f}"
    else:
        formatted = f"{abs(n):,.0f}"

    if is_eu:
        # Swap . and , for European format: 1,234.56 -> 1.234,56
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")

    if n < 0:
        formatted = "-" + formatted

    return formatted
