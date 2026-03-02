"""TapeView: Static-based tape display with cursor highlight and tilde fill."""

from textual.message import Message
from textual.widget import Widget
from textual.app import RenderResult
from rich.text import Text

from ..calculate import compute_running_totals
from ..format import format_number

OP_SYMBOLS = {
    "+": "+",
    "-": "\u2212",
    "*": "\u00d7",
    "/": "\u00f7",
    "=": "S=",
    "T": "T=",
    "text": "",
}


class TapeView(Widget):
    """Displays the active tape as formatted lines with a vim-like cursor."""

    can_focus = False

    class CursorMoved(Message):
        """Posted when the user clicks to move the cursor."""
        def __init__(self, index: int) -> None:
            super().__init__()
            self.index = index

    DEFAULT_CSS = """
    TapeView {
        height: 1fr;
        padding: 0 1;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._tape = []
        self._settings = {}
        self._cursor = -1
        self._scroll_offset = 0

    def update_tape(self, tape, settings, cursor=-1):
        self._tape = tape
        self._settings = settings
        self._cursor = cursor
        self._ensure_cursor_visible()
        self.refresh()

    def _ensure_cursor_visible(self):
        """Adjust scroll offset so cursor is visible."""
        height = self.size.height if self.size.height > 0 else 20
        if self._cursor < 0:
            self._scroll_offset = 0
            return
        if self._cursor < self._scroll_offset:
            self._scroll_offset = self._cursor
        elif self._cursor >= self._scroll_offset + height:
            self._scroll_offset = self._cursor - height + 1

    def render(self) -> RenderResult:
        height = self.size.height if self.size.height > 0 else 20
        width = self.size.width - 2 if self.size.width > 4 else 40

        fmt = self._settings.get("numberFormat", "2dec")
        calc_mode = self._settings.get("calculationMode", "arithmetic")
        color_neg = self._settings.get("colorNegatives", False)

        text = Text()

        if not self._tape:
            for i in range(height):
                if i > 0:
                    text.append("\n")
                text.append("~", style="bold blue")
            return text

        totals, sub_products = compute_running_totals(self._tape, calc_mode)

        # Render visible lines
        for row in range(height):
            if row > 0:
                text.append("\n")

            entry_idx = self._scroll_offset + row

            if entry_idx >= len(self._tape):
                # Tilde lines for empty space
                text.append("~", style="bold blue")
                continue

            entry = self._tape[entry_idx]
            op = entry["op"]
            rt = totals[entry_idx] if entry_idx < len(totals) else 0
            sp = sub_products[entry_idx] if entry_idx < len(sub_products) else None
            is_cursor = (entry_idx == self._cursor)

            line = self._format_entry(entry, op, rt, sp, fmt, width)

            # Determine style
            if op in ("=", "T"):
                style = "bold green"
            elif op == "text":
                style = ""
            elif color_neg and rt < 0:
                style = "red"
            else:
                style = ""

            if is_cursor:
                style = f"{style} reverse" if style else "reverse"

            text.append(line, style=style)

        return text

    def _format_entry(self, entry, op, rt, sp, fmt, width):
        """Format a single tape entry as a fixed-width line."""
        if op in ("=", "T"):
            label = OP_SYMBOLS[op]
            rt_str = format_number(rt, fmt)
            # Right-align the label and total
            left = f"{label}"
            right = f"{rt_str}"
            spacing = max(1, width - len(left) - len(right))
            return f"{left}{' ' * spacing}{right}"

        if op == "text":
            text_val = entry.get("text", "")
            return text_val[:width]

        val_str = format_number(entry["value"], fmt)
        op_str = OP_SYMBOLS.get(op, op)
        rt_str = format_number(rt, fmt)

        if sp is not None and sp != entry["value"]:
            sp_str = f" [{format_number(sp, fmt)}]"
        else:
            sp_str = ""

        left = f"{val_str:>14} {op_str}{sp_str}"
        right = f"{rt_str}"
        spacing = max(1, width - len(left) - len(right))
        return f"{left}{' ' * spacing}{right}"

    def on_click(self, event) -> None:
        """Click to move cursor — notify app via message."""
        y = event.y
        entry_idx = self._scroll_offset + y
        if 0 <= entry_idx < len(self._tape):
            self.post_message(self.CursorMoved(entry_idx))
