"""Load/save state from ~/.many-tapes-calculator/state.json."""

import json
from pathlib import Path

from .state import create_default_state, migrate_keys

DIR = Path.home() / ".many-tapes-calculator"
STATE_FILE = DIR / "state.json"


def _ensure_dir():
    DIR.mkdir(parents=True, exist_ok=True)


def load_state():
    try:
        _ensure_dir()
        if not STATE_FILE.exists():
            return create_default_state()
        raw = STATE_FILE.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        migrated = migrate_keys(parsed)
        # Basic validation: must have tapes list with at least one tape
        if not isinstance(migrated.get("tapes"), list) or len(migrated["tapes"]) < 1:
            return create_default_state()
        if "activeTapeId" not in migrated:
            return create_default_state()
        # Ensure defaults for optional fields
        migrated.setdefault("totals", [])
        migrated.setdefault("activeTotalId", None)
        migrated.setdefault("settings", {})
        settings = migrated["settings"]
        settings.setdefault("numberFormat", "2dec")
        settings.setdefault("colorNegatives", False)
        settings.setdefault("calculationMode", "arithmetic")
        settings.setdefault("textStores", [])
        return migrated
    except Exception:
        return create_default_state()


def save_state(state):
    try:
        _ensure_dir()
        STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception:
        pass
