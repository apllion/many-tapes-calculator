"""Many Tapes Calculator — Textual TUI."""


def main():
    from .app import CalculatorApp
    app = CalculatorApp()
    app.run()
