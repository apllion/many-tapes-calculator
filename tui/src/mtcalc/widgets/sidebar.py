"""Sidebar: tape list with subtotals, totals list, active highlighting."""

from textual.message import Message
from textual.widget import Widget
from textual.app import RenderResult
from rich.text import Text

from ..calculate import compute_running_totals
from ..format import format_number


class Sidebar(Widget):
    """Left panel showing tapes and totals."""

    DEFAULT_CSS = """
    Sidebar {
        width: 22;
        dock: left;
        border-right: solid $primary;
        padding: 0 0;
    }
    """

    can_focus = False

    class ItemSelected(Message):
        """Posted when a sidebar item is clicked."""
        def __init__(self, item_type: str, item_id: str) -> None:
            super().__init__()
            self.item_type = item_type
            self.item_id = item_id

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._state = None
        self._lines = []  # list of (text, item_type, item_id, is_active)

    def set_state(self, state):
        self._state = state
        self._build_lines()
        self.refresh()

    def _build_lines(self):
        self._lines = []
        if self._state is None:
            return

        settings = self._state.get("settings") or {}
        fmt = settings.get("numberFormat", "2dec")
        calc_mode = settings.get("calculationMode", "arithmetic")
        active_tape_id = self._state.get("activeTapeId")
        active_total_id = self._state.get("activeTotalId")

        # TAPES header
        self._lines.append(("TAPES", "header", None, False))

        for tape in self._state["tapes"]:
            totals, _ = compute_running_totals(tape["tape"], calc_mode)
            sub = totals[-1] if totals else 0
            is_active = tape["id"] == active_tape_id and not active_total_id
            marker = "\u25b8 " if is_active else "  "
            sub_str = format_number(sub, fmt)
            name = tape["name"]
            # Truncate name to fit
            max_name = 10
            if len(name) > max_name:
                name = name[:max_name]
            line = f"{marker}{name:<{max_name}} {sub_str:>7}"
            self._lines.append((line, "tape", tape["id"], is_active))

        # TOTALS header (only if there are totals)
        totals_list = self._state.get("totals") or []
        if totals_list:
            self._lines.append(("", "spacer", None, False))
            self._lines.append(("TOTALS", "header", None, False))
            for total in totals_list:
                is_active = total["id"] == active_total_id
                marker = "\u25b8 " if is_active else "  "
                line = f"{marker}\u03a3 {total['name']}"
                self._lines.append((line, "total", total["id"], is_active))

    def render(self) -> RenderResult:
        text = Text()
        for i, (line, line_type, item_id, is_active) in enumerate(self._lines):
            if i > 0:
                text.append("\n")
            if line_type == "header":
                text.append(line, style="bold dim")
            elif is_active:
                text.append(line, style="bold reverse")
            else:
                text.append(line)
        return text

    def on_click(self, event) -> None:
        # Determine which line was clicked based on Y offset
        y = event.y
        if y < 0 or y >= len(self._lines):
            return
        line_text, line_type, item_id, is_active = self._lines[y]
        if line_type == "tape" and item_id:
            self.post_message(self.ItemSelected("tape", item_id))
        elif line_type == "total" and item_id:
            self.post_message(self.ItemSelected("total", item_id))
