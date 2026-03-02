"""Compute running totals with operator precedence.

x and / bind tighter than + and -.

The op on each entry means "what comes after this value."
Entries connected by x or / form a multiplicative group.
Groups are separated by + or -, which determine how the
group result applies to the additive total.

Each entry's running total = "total if the tape ended here."
"""


def compute_running_totals(tape, mode="arithmetic"):
    if mode == "adding":
        return _compute_adding(tape)
    return _compute_arithmetic(tape)


def _apply_add(op, total, value):
    return total + value if op == "+" else total - value


def _apply_op(op, a, b):
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        return a / b if b != 0 else a
    return a + b


def _compute_arithmetic(tape):
    totals = []
    sub_products = []
    total = 0.0
    add_op = "+"
    group_product = 0.0
    group_len = 0
    prev_entry = None

    for entry in tape:
        op = entry["op"]

        if op == "text":
            totals.append(totals[-1] if totals else 0)
            sub_products.append(None)
            continue

        if op == "=":
            display_total = total
            if group_len > 0:
                display_total = _apply_add(add_op, total, group_product)
            totals.append(display_total)
            sub_products.append(None)
            continue

        if op == "T":
            if group_len > 0:
                total = _apply_add(add_op, total, group_product)
                group_len = 0
            totals.append(total)
            sub_products.append(None)
            total = 0.0
            add_op = "+"
            prev_entry = entry
            continue

        if group_len == 0:
            group_product = entry["value"]
            group_len = 1
        else:
            prev_op = prev_entry["op"]
            if prev_op == "*":
                group_product *= entry["value"]
            elif prev_op == "/":
                group_product = (
                    group_product / entry["value"]
                    if entry["value"] != 0
                    else group_product
                )
            group_len += 1

        current_total = _apply_add(add_op, total, group_product)
        totals.append(current_total)

        is_mult_op = op in ("*", "/")
        prev_is_mult = prev_entry is not None and prev_entry["op"] in ("*", "/")
        if is_mult_op or prev_is_mult:
            sub_products.append(group_product)
        else:
            sub_products.append(None)

        if op in ("+", "-"):
            total = current_total
            add_op = op
            group_len = 0

        prev_entry = entry

    return totals, sub_products


def _compute_adding(tape):
    totals = []
    sub_products = []
    total = 0.0
    pending_op = "+"

    for entry in tape:
        op = entry["op"]

        if op == "text":
            totals.append(totals[-1] if totals else 0)
            sub_products.append(None)
            continue

        if op in ("=", "T"):
            totals.append(total)
            sub_products.append(None)
            if op == "T":
                total = 0.0
                pending_op = "+"
            continue

        total = _apply_op(pending_op, total, entry["value"])
        totals.append(total)
        sub_products.append(None)
        pending_op = op

    return totals, sub_products
