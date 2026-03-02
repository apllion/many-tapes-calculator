"""Save/load named snapshots from ~/.many-tapes-calculator/saves/."""

import json
from pathlib import Path

from .state import generate_id

DIR = Path.home() / ".many-tapes-calculator" / "saves"


def _ensure_dir():
    DIR.mkdir(parents=True, exist_ok=True)


def load_saves():
    try:
        _ensure_dir()
        saves = []
        for f in DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                saves.append({
                    "id": data["id"],
                    "name": data["name"],
                    "timestamp": data["timestamp"],
                })
            except Exception:
                continue
        saves.sort(key=lambda s: s["timestamp"], reverse=True)
        return saves
    except Exception:
        return []


def get_save(save_id):
    try:
        path = DIR / f"{save_id}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def add_save(name, state):
    _ensure_dir()
    save_id = generate_id()
    import time
    save = {
        "id": save_id,
        "name": name,
        "timestamp": int(time.time() * 1000),
        "state": state,
    }
    path = DIR / f"{save_id}.json"
    path.write_text(json.dumps(save, indent=2), encoding="utf-8")
    return {"id": save_id, "name": name, "timestamp": save["timestamp"]}


def delete_save(save_id):
    try:
        path = DIR / f"{save_id}.json"
        if path.exists():
            path.unlink()
    except Exception:
        pass
