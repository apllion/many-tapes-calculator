"""State management: reducer, enrichAction, generateId, defaults, migration.

All state is plain Python dicts/lists matching the JSON schema used by the web app.
"""

import time
import random
import string
import copy

_counter = 0


def generate_id():
    """Same format as JS: {timestamp_base36}-{counter_base36}-{random4chars}."""
    global _counter
    ts = int(time.time() * 1000)
    ts_b36 = _to_base36(ts)
    c_b36 = _to_base36(_counter)
    _counter += 1
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{ts_b36}-{c_b36}-{rand}"


def _to_base36(n):
    if n == 0:
        return "0"
    digits = ""
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    while n > 0:
        digits = chars[n % 36] + digits
        n //= 36
    return digits


def create_default_state():
    tape_id = generate_id()
    return {
        "tapes": [
            {
                "id": tape_id,
                "name": "Tape 1",
                "tape": [],
                "createdAt": int(time.time() * 1000),
            }
        ],
        "activeTapeId": tape_id,
        "totals": [],
        "activeTotalId": None,
        "settings": {
            "numberFormat": "2dec",
            "colorNegatives": False,
            "calculationMode": "arithmetic",
            "textStores": [],
        },
    }


def migrate_keys(obj):
    """Rename legacy keys for backwards compatibility."""
    if "accounts" in obj and "tapes" not in obj:
        obj["tapes"] = obj.pop("accounts")
    if "activeAccountId" in obj and "activeTapeId" not in obj:
        obj["activeTapeId"] = obj.pop("activeAccountId")
    if "summaries" in obj and "totals" not in obj:
        obj["totals"] = obj.pop("summaries")
    if "activeSummaryId" in obj and "activeTotalId" not in obj:
        obj["activeTotalId"] = obj.pop("activeSummaryId")
    return obj


def _now():
    return int(time.time() * 1000)


def _map_tape(state, tape_id, fn):
    state = copy.deepcopy(state)
    state["tapes"] = [fn(copy.deepcopy(t)) if t["id"] == tape_id else t for t in state["tapes"]]
    return state


def shared_reducer(state, action):
    """Actions that affect shared state (tapes, totals, settings)."""
    t = action["type"]

    if t == "ADD_ENTRY":
        def add_entry(a):
            entry = {
                "id": action["entryId"],
                "op": action["op"],
                "value": action["value"],
                "timestamp": _now(),
            }
            if "text" in action:
                entry["text"] = action["text"]
            a["tape"] = a["tape"] + [entry]
            return a
        return _map_tape(state, action["tapeId"], add_entry)

    if t == "ADD_ENTRY_AND_TOTAL":
        def add_entry_and_total(a):
            value_entry = {"id": action["entryId"], "op": "+", "value": action["value"], "timestamp": _now()}
            if "text" in action:
                value_entry["text"] = action["text"]
            a["tape"] = a["tape"] + [
                value_entry,
                {"id": action["totalEntryId"], "op": action.get("totalOp", "="), "value": 0, "timestamp": _now()},
            ]
            return a
        return _map_tape(state, action["tapeId"], add_entry_and_total)

    if t == "INSERT_ENTRY":
        def insert_entry(a):
            idx = next((i for i, e in enumerate(a["tape"]) if e["id"] == action["afterId"]), -1)
            entry = {
                "id": action["entryId"],
                "op": action["op"],
                "value": action["value"],
                "timestamp": _now(),
            }
            if "text" in action:
                entry["text"] = action["text"]
            tape = list(a["tape"])
            tape.insert(idx + 1, entry)
            a["tape"] = tape
            return a
        return _map_tape(state, action["tapeId"], insert_entry)

    if t == "UPDATE_ENTRY":
        def update_entry(a):
            def apply_updates(e):
                if e["id"] != action["entryId"]:
                    return e
                updated = {**e, **action["updates"]}
                # Remove keys explicitly set to None (e.g. clearing text label)
                for k, v in action["updates"].items():
                    if v is None:
                        updated.pop(k, None)
                return updated
            a["tape"] = [apply_updates(e) for e in a["tape"]]
            return a
        return _map_tape(state, action["tapeId"], update_entry)

    if t == "DELETE_ENTRY":
        def delete_entry(a):
            a["tape"] = [e for e in a["tape"] if e["id"] != action["entryId"]]
            return a
        return _map_tape(state, action["tapeId"], delete_entry)

    if t == "ADD_ENTRY_ALL":
        state = copy.deepcopy(state)
        entry_base = {"op": action["op"], "value": action["value"]}
        if "text" in action:
            entry_base["text"] = action["text"]
        for i, tape in enumerate(state["tapes"]):
            tape["tape"] = tape["tape"] + [{**entry_base, "id": action["entryIds"][i], "timestamp": _now()}]
        return state

    if t == "CLEAR_TAPE":
        return _map_tape(state, action["tapeId"], lambda a: {**a, "tape": []})

    if t == "ADD_TAPE":
        state = copy.deepcopy(state)
        name = f"Tape {len(state['tapes']) + 1}"
        state["tapes"].append({"id": action["id"], "name": name, "tape": [], "createdAt": _now()})
        return state

    if t == "DELETE_TAPE":
        if len(state["tapes"]) <= 1:
            return state
        state = copy.deepcopy(state)
        state["tapes"] = [a for a in state["tapes"] if a["id"] != action["tapeId"]]
        state["totals"] = [
            {**s, "members": [m for m in s.get("members", []) if m["accountId"] != action["tapeId"]]}
            for s in (state.get("totals") or [])
        ]
        return state

    if t == "RENAME_TAPE":
        state = copy.deepcopy(state)
        state["tapes"] = [{**a, "name": action["name"]} if a["id"] == action["tapeId"] else a for a in state["tapes"]]
        return state

    if t == "SET_TAPE_COLOR":
        state = copy.deepcopy(state)
        state["tapes"] = [{**a, "color": action["color"]} if a["id"] == action["tapeId"] else a for a in state["tapes"]]
        return state

    if t == "SET_SETTING":
        state = copy.deepcopy(state)
        settings = state.get("settings") or {}
        settings[action["key"]] = action["value"]
        state["settings"] = settings
        return state

    if t == "SET_TEXT_STORE":
        state = copy.deepcopy(state)
        settings = state.get("settings") or {}
        stores = list(settings.get("textStores") or [])
        while len(stores) <= action["index"]:
            stores.append(None)
        stores[action["index"]] = action["text"]
        settings["textStores"] = stores
        state["settings"] = settings
        return state

    if t == "ADD_TOTAL":
        state = copy.deepcopy(state)
        totals = state.get("totals") or []
        name = action.get("name") or f"Total {len(totals) + 1}"
        totals.append({"id": action["id"], "name": name, "startingValue": 0, "members": []})
        state["totals"] = totals
        return state

    if t == "DELETE_TOTAL":
        state = copy.deepcopy(state)
        state["totals"] = [s for s in (state.get("totals") or []) if s["id"] != action["totalId"]]
        return state

    if t == "RENAME_TOTAL":
        state = copy.deepcopy(state)
        state["totals"] = [{**s, "name": action["name"]} if s["id"] == action["totalId"] else s for s in (state.get("totals") or [])]
        return state

    if t == "SET_TOTAL_STARTING_VALUE":
        state = copy.deepcopy(state)
        state["totals"] = [{**s, "startingValue": action["value"]} if s["id"] == action["totalId"] else s for s in (state.get("totals") or [])]
        return state

    if t == "TOGGLE_TOTAL_MEMBER":
        state = copy.deepcopy(state)
        new_totals = []
        for s in (state.get("totals") or []):
            if s["id"] != action["totalId"]:
                new_totals.append(s)
                continue
            s = copy.deepcopy(s)
            members = s.get("members", [])
            existing = next((m for m in members if m["accountId"] == action["tapeId"]), None)
            if existing is None:
                members.append({"accountId": action["tapeId"], "sign": "+"})
            elif existing["sign"] == "+":
                for m in members:
                    if m["accountId"] == action["tapeId"]:
                        m["sign"] = "-"
            else:
                members = [m for m in members if m["accountId"] != action["tapeId"]]
            s["members"] = members
            new_totals.append(s)
        state["totals"] = new_totals
        return state

    if t == "MOVE_TAPE_LEFT":
        state = copy.deepcopy(state)
        tapes = state["tapes"]
        idx = next((i for i, a in enumerate(tapes) if a["id"] == action["tapeId"]), -1)
        if idx <= 0:
            return state
        tapes[idx - 1], tapes[idx] = tapes[idx], tapes[idx - 1]
        return state

    if t == "MOVE_TAPE_RIGHT":
        state = copy.deepcopy(state)
        tapes = state["tapes"]
        idx = next((i for i, a in enumerate(tapes) if a["id"] == action["tapeId"]), -1)
        if idx < 0 or idx >= len(tapes) - 1:
            return state
        tapes[idx], tapes[idx + 1] = tapes[idx + 1], tapes[idx]
        return state

    if t == "MOVE_TOTAL_LEFT":
        state = copy.deepcopy(state)
        totals = state.get("totals") or []
        idx = next((i for i, s in enumerate(totals) if s["id"] == action["totalId"]), -1)
        if idx <= 0:
            return state
        totals[idx - 1], totals[idx] = totals[idx], totals[idx - 1]
        state["totals"] = totals
        return state

    if t == "MOVE_TOTAL_RIGHT":
        state = copy.deepcopy(state)
        totals = state.get("totals") or []
        idx = next((i for i, s in enumerate(totals) if s["id"] == action["totalId"]), -1)
        if idx < 0 or idx >= len(totals) - 1:
            return state
        totals[idx], totals[idx + 1] = totals[idx + 1], totals[idx]
        state["totals"] = totals
        return state

    if t == "SET_TOTAL_COLOR":
        state = copy.deepcopy(state)
        state["totals"] = [{**s, "color": action["color"]} if s["id"] == action["totalId"] else s for s in (state.get("totals") or [])]
        return state

    if t == "SYNC_STATE":
        state = copy.deepcopy(state)
        state["tapes"] = action["tapes"]
        state["totals"] = action["totals"]
        state["settings"] = action["settings"]
        return state

    if t == "LOAD_STATE":
        return copy.deepcopy(action["state"])

    return state


def local_reducer(state, action):
    """Actions that affect local view state (which tape/total is active)."""
    t = action["type"]

    if t == "SET_ACTIVE":
        state = copy.deepcopy(state)
        state["activeTapeId"] = action["tapeId"]
        state["activeTotalId"] = None
        return state

    if t == "SET_ACTIVE_TOTAL":
        state = copy.deepcopy(state)
        state["activeTotalId"] = action["totalId"]
        return state

    if t == "ADD_TAPE":
        state = copy.deepcopy(state)
        state["activeTapeId"] = action["id"]
        return state

    if t == "ADD_TOTAL":
        state = copy.deepcopy(state)
        state["activeTotalId"] = action["id"]
        return state

    if t == "DELETE_TAPE":
        if state["activeTapeId"] == action["tapeId"]:
            remaining = [a for a in state["tapes"] if a["id"] != action["tapeId"]]
            state = copy.deepcopy(state)
            state["activeTapeId"] = remaining[0]["id"] if remaining else state["activeTapeId"]
        return state

    if t == "DELETE_TOTAL":
        if state.get("activeTotalId") == action["totalId"]:
            state = copy.deepcopy(state)
            state["activeTotalId"] = None
        return state

    if t == "LOAD_STATE":
        return state  # LOAD_STATE fully replaces via shared_reducer

    return state


def fix_dangling_pointers(state):
    tape_ids = {a["id"] for a in state["tapes"]}
    total_ids = {s["id"] for s in (state.get("totals") or [])}

    changed = False
    if state["activeTapeId"] not in tape_ids:
        state = copy.deepcopy(state) if not changed else state
        state["activeTapeId"] = state["tapes"][0]["id"]
        changed = True
    if state.get("activeTotalId") and state["activeTotalId"] not in total_ids:
        state = copy.deepcopy(state) if not changed else state
        state["activeTotalId"] = None

    return state


def reducer(state, action):
    next_state = shared_reducer(state, action)
    if not action.get("_remote"):
        next_state = local_reducer(next_state, action)
    next_state = fix_dangling_pointers(next_state)
    return next_state


def enrich_action(action, state):
    """Auto-populate tapeId and pre-generate IDs before dispatch."""
    enriched = dict(action)

    needs_tape_id = {
        "ADD_ENTRY", "ADD_ENTRY_AND_TOTAL", "INSERT_ENTRY",
        "UPDATE_ENTRY", "DELETE_ENTRY", "CLEAR_TAPE",
    }
    if enriched["type"] in needs_tape_id and "tapeId" not in enriched:
        enriched["tapeId"] = state["activeTapeId"]

    t = enriched["type"]
    if t in ("ADD_ENTRY", "INSERT_ENTRY"):
        if "entryId" not in enriched:
            enriched["entryId"] = generate_id()
    elif t == "ADD_ENTRY_AND_TOTAL":
        if "entryId" not in enriched:
            enriched["entryId"] = generate_id()
        if "totalEntryId" not in enriched:
            enriched["totalEntryId"] = generate_id()
    elif t == "ADD_ENTRY_ALL":
        if "entryIds" not in enriched:
            enriched["entryIds"] = [generate_id() for _ in state["tapes"]]
    elif t in ("ADD_TAPE", "ADD_TOTAL"):
        if "id" not in enriched:
            enriched["id"] = generate_id()

    return enriched
