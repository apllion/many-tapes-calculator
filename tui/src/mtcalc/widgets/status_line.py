"""StatusLine: mode indicator, input buffer, subtotal display."""

from textual.widget import Widget
from textual.app import RenderResult

from ..format import format_number


class StatusLine(Widget):
    """Bottom bar showing mode, input buffer, and subtotal."""

    DEFAULT_CSS = """
    StatusLine {
        height: 1;
        dock: bottom;
        background: $surface;
        padding: 0 1;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._mode = "normal"
        self._input = ""
        self._command = ""
        self._subtotal = 0.0
        self._fmt = "2dec"

    def update_status(self, mode: str, input_buf: str, command: str,
                      subtotal: float, fmt: str):
        self._mode = mode
        self._input = input_buf
        self._command = command
        self._subtotal = subtotal
        self._fmt = fmt
        self.refresh()

    def render(self) -> RenderResult:
        sub_str = f"Sub: {format_number(self._subtotal, self._fmt)}"
        width = self.size.width - 2  # account for padding

        if self._mode == "command":
            cmd = f":{self._command}\u2588"
            spacing = max(1, width - len(cmd) - len(sub_str))
            return f"{cmd}{' ' * spacing}{sub_str}"

        if self._mode == "insert":
            mode_str = "-- INSERT --"
            if self._input:
                input_str = f" {self._input}\u2588"
            else:
                input_str = " \u2588"
            left = f"{mode_str}{input_str}"
            spacing = max(1, width - len(left) - len(sub_str))
            return f"{left}{' ' * spacing}{sub_str}"

        # normal mode
        mode_str = "-- NORMAL --"
        spacing = max(1, width - len(mode_str) - len(sub_str))
        return f"{mode_str}{' ' * spacing}{sub_str}"
