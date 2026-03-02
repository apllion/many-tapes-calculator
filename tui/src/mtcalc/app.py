"""Many Tapes Calculator — Vim-like Textual TUI."""

from datetime import datetime

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Vertical, Horizontal, VerticalScroll
from textual.css.query import NoMatches
from textual.screen import ModalScreen
from textual.widget import Widget
from textual.widgets import Static, Input, Label, ListView, ListItem

from .widgets import Sidebar, TapeView, StatusLine
from .state import reducer, enrich_action, generate_id
from .storage import load_state, save_state
from .calculate import compute_running_totals
from .format import format_number, FORMAT_ORDER, FORMAT_LABELS
from .saves import load_saves, get_save, add_save, delete_save


# ── Modal Screens (kept from original) ────────────────────────────


class SaveScreen(ModalScreen[str | None]):
    """Modal screen for saving state."""

    DEFAULT_CSS = """
    SaveScreen {
        align: center middle;
    }
    SaveScreen > Vertical {
        width: 50;
        height: auto;
        max-height: 12;
        border: solid $primary;
        background: $surface;
        padding: 1 2;
    }
    SaveScreen Input {
        margin-top: 1;
    }
    """

    BINDINGS = [
        Binding("escape", "cancel", "Cancel"),
    ]

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Label("Save current state")
            yield Input(placeholder="Save name...", id="save-name-input")

    def on_mount(self) -> None:
        self.query_one("#save-name-input", Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        self.dismiss(event.value.strip() or None)

    def action_cancel(self) -> None:
        self.dismiss(None)


class LoadScreen(ModalScreen[str | None]):
    """Modal screen for loading saved state."""

    DEFAULT_CSS = """
    LoadScreen {
        align: center middle;
    }
    LoadScreen > Vertical {
        width: 60;
        height: auto;
        max-height: 20;
        border: solid $primary;
        background: $surface;
        padding: 1 2;
    }
    LoadScreen ListView {
        height: auto;
        max-height: 14;
        margin-top: 1;
    }
    LoadScreen .save-item {
        height: 1;
        padding: 0 1;
    }
    LoadScreen .no-saves {
        color: $text-muted;
        margin-top: 1;
    }
    LoadScreen .hint {
        color: $text-muted;
        margin-top: 1;
    }
    """

    BINDINGS = [
        Binding("escape", "cancel", "Cancel"),
        Binding("d", "delete_selected", "Delete"),
    ]

    def __init__(self, saves, **kwargs):
        super().__init__(**kwargs)
        self._saves = saves

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Label("Load saved state")
            if not self._saves:
                yield Static("No saves found", classes="no-saves")
            else:
                lv = ListView(id="saves-list")
                for s in self._saves:
                    ts = datetime.fromtimestamp(s["timestamp"] / 1000).strftime("%Y-%m-%d %H:%M")
                    lv.mount(ListItem(Label(f"{s['name']}  \u2014  {ts}"), classes="save-item", id=f"save-{s['id']}"))
                yield lv
                yield Static("[Enter] Load  [d] Delete  [Esc] Cancel", classes="hint")

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        item_id = event.item.id or ""
        if item_id.startswith("save-"):
            save_id = item_id[len("save-"):]
            self.dismiss(save_id)

    def action_cancel(self) -> None:
        self.dismiss(None)

    def action_delete_selected(self) -> None:
        lv = self.query_one("#saves-list", ListView)
        if lv.highlighted_child is None:
            return
        item_id = lv.highlighted_child.id or ""
        if item_id.startswith("save-"):
            save_id = item_id[len("save-"):]
            delete_save(save_id)
            self._saves = [s for s in self._saves if s["id"] != save_id]
            lv.highlighted_child.remove()


# ── TotalView (aggregate total display) ───────────────────────────


class TotalView(Widget):
    """Shows the aggregate total view for a total (sum of tape subtotals)."""

    can_focus = False
    can_focus_children = False

    DEFAULT_CSS = """
    TotalView {
        height: 1fr;
        padding: 1 2;
    }
    TotalView .member-row {
        height: 1;
    }
    TotalView .grand-total {
        margin-top: 1;
        text-style: bold;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._state = None
        self._total = None

    def update_total(self, state, total):
        self._state = state
        self._total = total
        self._refresh()

    def _refresh(self):
        self.query("*").remove()
        if self._state is None or self._total is None:
            return

        settings = self._state.get("settings") or {}
        fmt = settings.get("numberFormat", "2dec")
        calc_mode = settings.get("calculationMode", "arithmetic")
        member_map = {m["accountId"]: m["sign"] for m in (self._total.get("members") or [])}
        grand = self._total.get("startingValue", 0)
        tapes_by_id = {t["id"]: t for t in self._state["tapes"]}

        for tape_id, sign in member_map.items():
            tape = tapes_by_id.get(tape_id)
            if tape is None:
                continue
            totals, _ = compute_running_totals(tape["tape"], calc_mode)
            sub = totals[-1] if totals else 0
            signed = -sub if sign == "-" else sub
            grand += signed
            sign_ch = "\u2212" if sign == "-" else "+"
            self.mount(Static(
                f"{sign_ch} {tape['name']}{'':>20}{format_number(signed, fmt)}",
                classes="member-row",
            ))

        self.mount(Static(
            f"[bold]Total{'':>24}{format_number(grand, fmt)}[/]",
            classes="grand-total",
        ))


# ── Main App ──────────────────────────────────────────────────────


class CalculatorApp(App):
    """Many Tapes Calculator — Vim-like TUI."""

    TITLE = "Many Tapes Calculator"

    CSS = """
    Screen {
        layout: horizontal;
    }
    #main-content {
        width: 1fr;
        layout: vertical;
    }
    #tape-area {
        height: 1fr;
        border: solid $primary;
    }
    #total-area {
        height: 1fr;
        border: solid $primary;
    }
    """

    # No BINDINGS — all key handling through on_key()

    def __init__(self):
        super().__init__()
        self._state = load_state()
        # Vim state
        self._mode = "normal"       # "normal" | "insert" | "command"
        self._cursor = -1           # Index in active tape entries
        self._input = ""            # Number/text being built (INSERT)
        self._insert_type = "number"  # "number" | "text"
        self._insert_position = "append"  # "append" | "edit" | "insert_after" | "insert_before"
        self._insert_edit_entry_id = None
        self._command = ""          # Command text (COMMAND mode)
        self._pending_key = ""     # For multi-key: "d" for dd, "g" for gg
        self._toast_timer = None

    # ── Helpers ──────────────────────────────────────────────

    @property
    def _settings(self):
        return self._state.get("settings") or {}

    @property
    def _active_tape(self):
        for t in self._state["tapes"]:
            if t["id"] == self._state["activeTapeId"]:
                return t
        return self._state["tapes"][0]

    @property
    def _active_total(self):
        total_id = self._state.get("activeTotalId")
        if not total_id:
            return None
        for s in (self._state.get("totals") or []):
            if s["id"] == total_id:
                return s
        return None

    @property
    def _tape(self):
        return self._active_tape["tape"]

    @property
    def _subtotal(self):
        totals, _ = compute_running_totals(self._tape, self._settings.get("calculationMode", "arithmetic"))
        return totals[-1] if totals else 0

    def _dispatch(self, action):
        enriched = enrich_action(action, self._state)
        self._state = reducer(self._state, enriched)
        save_state(self._state)
        self._refresh_ui()
        return enriched

    def _clamp_cursor(self):
        """Ensure cursor is within tape bounds."""
        tape = self._tape
        if not tape:
            self._cursor = -1
        elif self._cursor < 0:
            self._cursor = 0 if tape else -1
        elif self._cursor >= len(tape):
            self._cursor = len(tape) - 1

    def _show_toast(self, message: str):
        """Show a brief notification."""
        self.notify(message, timeout=2)

    # ── Compose ─────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        yield Sidebar(id="sidebar")
        with Vertical(id="main-content"):
            yield TapeView(id="tape-area")
            yield TotalView(id="total-area")
            yield StatusLine(id="status-line")

    def on_mount(self) -> None:
        # Place cursor at last entry
        tape = self._tape
        self._cursor = len(tape) - 1 if tape else -1
        self._refresh_ui()

    # ── Widget clicks ────────────────────────────────────────

    def on_tape_view_cursor_moved(self, event: TapeView.CursorMoved) -> None:
        self._cursor = event.index
        self._refresh_ui()

    def on_sidebar_item_selected(self, event: Sidebar.ItemSelected) -> None:
        if event.item_type == "tape":
            self._dispatch({"type": "SET_ACTIVE", "tapeId": event.item_id})
        else:
            self._dispatch({"type": "SET_ACTIVE_TOTAL", "totalId": event.item_id})
        tape = self._tape
        self._cursor = len(tape) - 1 if tape else -1
        self._mode = "normal"
        self._input = ""
        self._command = ""
        self._pending_key = ""
        self._refresh_ui()

    # ── UI Refresh ───────────────────────────────────────────

    def _refresh_ui(self):
        """Refresh all widgets from current state."""
        try:
            sidebar = self.query_one("#sidebar", Sidebar)
            sidebar.set_state(self._state)
        except NoMatches:
            pass

        viewing_total = self._active_total is not None

        try:
            tape_view = self.query_one("#tape-area", TapeView)
            total_view = self.query_one("#total-area", TotalView)
            if viewing_total:
                tape_view.display = False
                total_view.display = True
                total_view.update_total(self._state, self._active_total)
            else:
                tape_view.display = True
                total_view.display = False
                tape_view.update_tape(self._tape, self._settings, self._cursor)
        except NoMatches:
            pass

        try:
            status = self.query_one("#status-line", StatusLine)
            status.update_status(
                self._mode, self._input, self._command,
                self._subtotal, self._settings.get("numberFormat", "2dec"),
            )
        except NoMatches:
            pass

    # ── Key Dispatch ─────────────────────────────────────────

    def on_key(self, event) -> None:
        # Don't intercept keys when a modal screen is active
        if len(self.screen_stack) > 1:
            return

        event.prevent_default()
        event.stop()

        key = event.key
        char = event.character

        if self._mode == "command":
            self._handle_command_key(key, char)
        elif self._mode == "insert":
            self._handle_insert_key(key, char)
        else:
            self._handle_normal_key(key, char)

    # ── NORMAL Mode ──────────────────────────────────────────

    def _handle_normal_key(self, key, char):
        # Handle pending multi-key sequences
        if self._pending_key:
            self._handle_pending(key, char)
            return

        # If viewing a total, only allow navigation away
        if self._active_total is not None:
            if key == "tab" or (char and char == "n" and key == "ctrl+n"):
                self._cycle_tab(1)
                return
            if key == "shift+tab" or (char and char == "p" and key == "ctrl+p"):
                self._cycle_tab(-1)
                return
            if char == ":":
                self._mode = "command"
                self._command = ""
                self._refresh_ui()
                return
            return

        # Navigation
        if key in ("j", "down"):
            self._move_cursor(1)
            return
        if key in ("k", "up"):
            self._move_cursor(-1)
            return

        # gg (first key)
        if char == "g":
            self._pending_key = "g"
            return

        # G — last entry
        if char == "G":
            tape = self._tape
            if tape:
                self._cursor = len(tape) - 1
                self._refresh_ui()
            return

        # d (first key of dd)
        if char == "d":
            self._pending_key = "d"
            return

        # x — delete entry at cursor
        if char == "x":
            self._delete_at_cursor()
            return

        # Digit/dot: auto-enter INSERT, append at end
        if char and char in "0123456789.":
            self._mode = "insert"
            self._input = char
            self._insert_type = "number"
            self._insert_position = "append"
            self._insert_edit_entry_id = None
            self._refresh_ui()
            return

        # i — edit selected entry's value
        if char == "i":
            tape = self._tape
            if tape and 0 <= self._cursor < len(tape):
                entry = tape[self._cursor]
                self._mode = "insert"
                self._insert_position = "edit"
                self._insert_edit_entry_id = entry["id"]
                if entry["op"] == "text":
                    self._input = entry.get("text", "")
                    self._insert_type = "text"
                elif entry["op"] in ("=", "T"):
                    # Can't edit subtotal/total markers
                    return
                else:
                    self._input = str(entry["value"]) if entry["value"] != 0 else ""
                    self._insert_type = "number"
                self._refresh_ui()
            return

        # o — new entry below cursor
        if char == "o":
            self._mode = "insert"
            self._input = ""
            self._insert_type = "number"
            self._insert_position = "insert_after"
            self._insert_edit_entry_id = None
            self._refresh_ui()
            return

        # O — new entry above cursor
        if char == "O":
            self._mode = "insert"
            self._input = ""
            self._insert_type = "number"
            self._insert_position = "insert_before"
            self._insert_edit_entry_id = None
            self._refresh_ui()
            return

        # Operators: change op of entry at cursor
        if char and char in "+-*/":
            tape = self._tape
            if tape and 0 <= self._cursor < len(tape):
                entry = tape[self._cursor]
                if entry["op"] not in ("=", "T", "text"):
                    self._dispatch({
                        "type": "UPDATE_ENTRY",
                        "entryId": entry["id"],
                        "updates": {"op": char},
                    })
            return

        # = — add subtotal line
        if char == "=":
            self._dispatch({"type": "ADD_ENTRY", "op": "=", "value": 0})
            tape = self._tape
            self._cursor = len(tape) - 1
            self._refresh_ui()
            return

        # t — add total line
        if char == "t":
            self._dispatch({"type": "ADD_ENTRY", "op": "T", "value": 0})
            tape = self._tape
            self._cursor = len(tape) - 1
            self._refresh_ui()
            return

        # f — cycle number format
        if char == "f":
            self._cycle_format()
            return

        # Tab / Ctrl-n: next tape/total
        if key == "tab" or key == "ctrl+n":
            self._cycle_tab(1)
            return

        # Shift-Tab / Ctrl-p: prev tape/total
        if key == "shift+tab" or key == "ctrl+p":
            self._cycle_tab(-1)
            return

        # : — enter command mode
        if char == ":":
            self._mode = "command"
            self._command = ""
            self._refresh_ui()
            return

    def _handle_pending(self, key, char):
        pending = self._pending_key
        self._pending_key = ""

        if pending == "d" and char == "d":
            self._delete_at_cursor()
            return

        if pending == "g" and char == "g":
            tape = self._tape
            if tape:
                self._cursor = 0
                self._refresh_ui()
            return

        # Invalid sequence — ignore

    def _move_cursor(self, direction):
        tape = self._tape
        if not tape:
            return
        if self._cursor < 0:
            self._cursor = 0
        else:
            self._cursor += direction
            if self._cursor < 0:
                self._cursor = 0
            elif self._cursor >= len(tape):
                self._cursor = len(tape) - 1
        self._refresh_ui()

    def _delete_at_cursor(self):
        tape = self._tape
        if not tape or self._cursor < 0 or self._cursor >= len(tape):
            return
        entry = tape[self._cursor]
        self._dispatch({"type": "DELETE_ENTRY", "entryId": entry["id"]})
        tape = self._tape
        if not tape:
            self._cursor = -1
        elif self._cursor >= len(tape):
            self._cursor = len(tape) - 1
        self._refresh_ui()

    # ── INSERT Mode ──────────────────────────────────────────

    def _handle_insert_key(self, key, char):
        # Escape — cancel
        if key == "escape":
            self._mode = "normal"
            self._input = ""
            self._insert_edit_entry_id = None
            self._refresh_ui()
            return

        # Backspace
        if key == "backspace":
            if self._input:
                self._input = self._input[:-1]
                # Re-evaluate type if we deleted back to empty
                if not self._input:
                    self._insert_type = "number"
                self._refresh_ui()
            else:
                # Empty backspace cancels
                self._mode = "normal"
                self._insert_edit_entry_id = None
                self._refresh_ui()
            return

        # Operators: commit number with operator
        if char and char in "+-*/" and self._insert_type == "number":
            self._commit_insert(char)
            return

        # = — commit with subtotal
        if char == "=" and self._insert_type == "number":
            self._commit_insert("=")
            return

        # Enter — commit
        if key == "enter":
            if self._insert_type == "text":
                self._commit_insert("text")
            else:
                self._commit_insert("+")
            return

        # Digits and dot
        if char and char in "0123456789.":
            self._input += char
            self._refresh_ui()
            return

        # Letters — auto-detect as text
        if char and char.isalpha() or (char and char == " " and self._input):
            if self._insert_type == "number" and self._input:
                # Had numeric input, but now typing letters — check if it was just digits
                try:
                    float(self._input)
                    # Was valid number, switch to text
                    self._insert_type = "text"
                    self._input += char
                except ValueError:
                    self._insert_type = "text"
                    self._input += char
            else:
                self._insert_type = "text"
                self._input += char
            self._refresh_ui()
            return

        # Any other printable character in text mode
        if char and self._insert_type == "text":
            self._input += char
            self._refresh_ui()
            return

    def _commit_insert(self, op):
        """Commit the insert buffer."""
        if self._insert_position == "edit":
            # Editing existing entry
            self._commit_edit(op)
            return

        if self._insert_type == "text":
            # Text entry
            text = self._input.strip()
            if not text:
                self._mode = "normal"
                self._input = ""
                self._refresh_ui()
                return
            self._do_insert_entry("text", 0, text)
        elif op == "=":
            # Number + subtotal
            try:
                value = float(self._input)
            except (ValueError, TypeError):
                self._mode = "normal"
                self._input = ""
                self._refresh_ui()
                return
            if self._input.strip():
                self._do_insert_entry_and_total(value)
            else:
                self._mode = "normal"
                self._input = ""
                self._refresh_ui()
                return
        else:
            # Number entry with operator
            try:
                value = float(self._input)
            except (ValueError, TypeError):
                self._mode = "normal"
                self._input = ""
                self._refresh_ui()
                return
            if not self._input.strip():
                self._mode = "normal"
                self._input = ""
                self._refresh_ui()
                return
            self._do_insert_entry(op, value)

        self._mode = "normal"
        self._input = ""
        self._insert_edit_entry_id = None
        # _do_insert_entry sets cursor for insert_after/insert_before;
        # for append, move cursor to the new last entry
        if self._insert_position == "append":
            tape = self._tape
            self._cursor = len(tape) - 1
        self._refresh_ui()

    def _do_insert_entry(self, op, value, text=None):
        """Insert an entry based on insert_position."""
        tape = self._tape

        if self._insert_position == "insert_after":
            # Insert after cursor
            if tape and 0 <= self._cursor < len(tape):
                after_id = tape[self._cursor]["id"]
                action = {"type": "INSERT_ENTRY", "afterId": after_id, "op": op, "value": value}
                if text:
                    action["text"] = text
                self._dispatch(action)
                # Cursor moves to new entry (cursor + 1)
                self._cursor = self._cursor + 1
                return
            # Fallthrough to append if no valid cursor

        if self._insert_position == "insert_before":
            if tape and 0 <= self._cursor < len(tape):
                if self._cursor == 0:
                    # Insert before first: append via reducer, then reorder immutably
                    action = {"type": "ADD_ENTRY", "op": op, "value": value}
                    if text:
                        action["text"] = text
                    self._dispatch(action)
                    # Move newly appended entry from end to position 0
                    import copy
                    state = copy.deepcopy(self._state)
                    for a in state["tapes"]:
                        if a["id"] == state["activeTapeId"]:
                            t = a["tape"]
                            if len(t) > 1:
                                a["tape"] = [t[-1]] + t[:-1]
                            break
                    self._state = state
                    save_state(self._state)
                    # Cursor stays at 0
                    self._cursor = 0
                    return
                else:
                    # Insert after cursor-1
                    after_id = tape[self._cursor - 1]["id"]
                    action = {"type": "INSERT_ENTRY", "afterId": after_id, "op": op, "value": value}
                    if text:
                        action["text"] = text
                    self._dispatch(action)
                    # Cursor stays at the same position (new entry pushed it forward)
                    return
            # Fallthrough to append

        # Default: append
        action = {"type": "ADD_ENTRY", "op": op, "value": value}
        if text:
            action["text"] = text
        self._dispatch(action)
        self._cursor = len(self._tape) - 1

    def _do_insert_entry_and_total(self, value):
        """Insert entry + subtotal."""
        tape = self._tape

        if self._insert_position == "insert_after" and tape and 0 <= self._cursor < len(tape):
            after_id = tape[self._cursor]["id"]
            enriched = self._dispatch({"type": "INSERT_ENTRY", "afterId": after_id, "op": "+", "value": value})
            new_entry_id = enriched["entryId"]
            self._dispatch({"type": "INSERT_ENTRY", "afterId": new_entry_id, "op": "=", "value": 0})
            self._cursor = self._cursor + 2
            return

        if self._insert_position == "insert_before" and tape and 0 <= self._cursor < len(tape):
            # Insert value entry before cursor, then subtotal after it
            self._do_insert_entry("+", value)
            # Now the value entry is at self._cursor; insert subtotal after it
            new_tape = self._tape
            if 0 <= self._cursor < len(new_tape):
                after_id = new_tape[self._cursor]["id"]
                self._dispatch({"type": "INSERT_ENTRY", "afterId": after_id, "op": "=", "value": 0})
                self._cursor = self._cursor + 1
            return

        self._dispatch({"type": "ADD_ENTRY_AND_TOTAL", "value": value})

    def _commit_edit(self, op):
        """Commit edit of existing entry."""
        entry_id = self._insert_edit_entry_id
        if not entry_id:
            self._mode = "normal"
            self._input = ""
            self._refresh_ui()
            return

        tape = self._tape
        entry = next((e for e in tape if e["id"] == entry_id), None)
        if not entry:
            self._mode = "normal"
            self._input = ""
            self._refresh_ui()
            return

        if self._insert_type == "text":
            text = self._input.strip()
            if text:
                self._dispatch({
                    "type": "UPDATE_ENTRY",
                    "entryId": entry_id,
                    "updates": {"text": text},
                })
        else:
            updates = {}
            try:
                value = float(self._input)
                updates["value"] = value
            except (ValueError, TypeError):
                pass
            if op not in ("=", "text", "+") or (op in "+-*/" and entry["op"] not in ("=", "T", "text")):
                if op in "+-*/":
                    updates["op"] = op
            if updates:
                self._dispatch({
                    "type": "UPDATE_ENTRY",
                    "entryId": entry_id,
                    "updates": updates,
                })

        self._mode = "normal"
        self._input = ""
        self._insert_edit_entry_id = None
        self._refresh_ui()

    # ── COMMAND Mode ─────────────────────────────────────────

    def _handle_command_key(self, key, char):
        if key == "escape":
            self._mode = "normal"
            self._command = ""
            self._refresh_ui()
            return

        if key == "backspace":
            if self._command:
                self._command = self._command[:-1]
                self._refresh_ui()
            else:
                self._mode = "normal"
                self._refresh_ui()
            return

        if key == "enter":
            self._execute_command(self._command.strip())
            self._mode = "normal"
            self._command = ""
            self._refresh_ui()
            return

        # Build command string
        if char:
            self._command += char
            self._refresh_ui()

    def _execute_command(self, cmd):
        """Execute a :command."""
        if not cmd:
            return

        parts = cmd.split(None, 1)
        name = parts[0]
        arg = parts[1].strip() if len(parts) > 1 else ""

        # :w — save
        if name == "w":
            if arg:
                add_save(arg, self._state)
                self._show_toast(f"Saved as '{arg}'")
            else:
                save_state(self._state)
                self._show_toast("State saved")
            return

        # :q — quit
        if name == "q":
            self.exit()
            return

        # :wq — save and quit
        if name == "wq":
            save_state(self._state)
            self.exit()
            return

        # :q! — force quit
        if name == "q!":
            self.exit()
            return

        # :new / :newtape — new tape
        if name in ("new", "newtape"):
            self._dispatch({"type": "ADD_TAPE"})
            self._cursor = -1
            self._show_toast("New tape created")
            return

        # :del / :deltape — delete current tape
        if name in ("del", "deltape"):
            if len(self._state["tapes"]) <= 1:
                self._show_toast("Cannot delete last tape")
                return
            self._dispatch({"type": "DELETE_TAPE", "tapeId": self._state["activeTapeId"]})
            tape = self._tape
            self._cursor = len(tape) - 1 if tape else -1
            self._show_toast("Tape deleted")
            return

        # :rename name
        if name == "rename":
            if arg:
                self._dispatch({
                    "type": "RENAME_TAPE",
                    "tapeId": self._state["activeTapeId"],
                    "name": arg,
                })
                self._show_toast(f"Renamed to '{arg}'")
            return

        # :bn / :next — next tape
        if name in ("bn", "next"):
            self._cycle_tab(1)
            return

        # :bp / :prev — prev tape
        if name in ("bp", "prev"):
            self._cycle_tab(-1)
            return

        # :b N — go to tape N (1-indexed)
        if name == "b":
            try:
                n = int(arg) - 1
                tapes = self._state["tapes"]
                if 0 <= n < len(tapes):
                    self._dispatch({"type": "SET_ACTIVE", "tapeId": tapes[n]["id"]})
                    tape = self._tape
                    self._cursor = len(tape) - 1 if tape else -1
                else:
                    self._show_toast(f"Tape {n+1} does not exist")
            except (ValueError, TypeError):
                self._show_toast("Usage: :b N")
            return

        # :ls / :buffers — list tapes
        if name in ("ls", "buffers"):
            lines = []
            for i, t in enumerate(self._state["tapes"]):
                marker = "%" if t["id"] == self._state["activeTapeId"] else " "
                lines.append(f"  {i+1}{marker} {t['name']}")
            self._show_toast("\n".join(lines))
            return

        # :saves — show saves modal
        if name == "saves":
            saves = load_saves()

            def on_load_result(save_id):
                if save_id is not None:
                    save = get_save(save_id)
                    if save:
                        self._dispatch({"type": "LOAD_STATE", "state": save["state"]})
                        tape = self._tape
                        self._cursor = len(tape) - 1 if tape else -1

            self.push_screen(LoadScreen(saves), on_load_result)
            return

        # :load name — load named save
        if name == "load":
            if not arg:
                self._show_toast("Usage: :load name")
                return
            saves = load_saves()
            match = next((s for s in saves if s["name"] == arg), None)
            if match:
                save = get_save(match["id"])
                if save:
                    self._dispatch({"type": "LOAD_STATE", "state": save["state"]})
                    tape = self._tape
                    self._cursor = len(tape) - 1 if tape else -1
                    self._show_toast(f"Loaded '{arg}'")
            else:
                self._show_toast(f"Save '{arg}' not found")
            return

        # :fmt — cycle format
        if name == "fmt":
            self._cycle_format()
            return

        # :set key=value
        if name == "set":
            if "=" in arg:
                k, v = arg.split("=", 1)
                k = k.strip()
                v = v.strip()
                # Try to convert to appropriate type
                if v.lower() in ("true", "false"):
                    v = v.lower() == "true"
                else:
                    try:
                        v = float(v) if "." in v else int(v)
                    except ValueError:
                        pass
                self._dispatch({"type": "SET_SETTING", "key": k, "value": v})
                self._show_toast(f"Set {k}={v}")
            else:
                self._show_toast("Usage: :set key=value")
            return

        # :clear — clear current tape
        if name == "clear":
            self._dispatch({"type": "CLEAR_TAPE"})
            self._cursor = -1
            self._show_toast("Tape cleared")
            return

        # :total / :newtotal — new total
        if name in ("total", "newtotal"):
            self._dispatch({"type": "ADD_TOTAL"})
            self._show_toast("New total created")
            return

        # :deltotal — delete current total
        if name == "deltotal":
            total = self._active_total
            if total:
                self._dispatch({"type": "DELETE_TOTAL", "totalId": total["id"]})
                self._show_toast("Total deleted")
            else:
                self._show_toast("No active total")
            return

        self._show_toast(f"Unknown command: {name}")

    # ── Shared Actions ───────────────────────────────────────

    def _cycle_tab(self, direction):
        all_tabs = [
            *[{"type": "tape", "id": t["id"]} for t in self._state["tapes"]],
            *[{"type": "total", "id": t["id"]} for t in (self._state.get("totals") or [])],
        ]
        if not all_tabs:
            return

        current_idx = -1
        at = self._active_total
        if at:
            current_idx = next((i for i, t in enumerate(all_tabs) if t["type"] == "total" and t["id"] == at["id"]), -1)
        else:
            current_idx = next((i for i, t in enumerate(all_tabs) if t["type"] == "tape" and t["id"] == self._state["activeTapeId"]), -1)

        next_idx = (current_idx + direction) % len(all_tabs)
        nxt = all_tabs[next_idx]
        if nxt["type"] == "tape":
            self._dispatch({"type": "SET_ACTIVE", "tapeId": nxt["id"]})
        else:
            self._dispatch({"type": "SET_ACTIVE_TOTAL", "totalId": nxt["id"]})
        tape = self._tape
        self._cursor = len(tape) - 1 if tape else -1
        self._refresh_ui()

    def _cycle_format(self):
        current = self._settings.get("numberFormat", "2dec")
        idx = FORMAT_ORDER.index(current) if current in FORMAT_ORDER else 0
        nxt = FORMAT_ORDER[(idx + 1) % len(FORMAT_ORDER)]
        self._dispatch({"type": "SET_SETTING", "key": "numberFormat", "value": nxt})
        self._show_toast(f"Format: {FORMAT_LABELS[nxt]}")
