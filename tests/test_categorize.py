import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from categorize import input_pattern  # noqa: E402


class InputPatternTest(unittest.TestCase):
    """Inputs as ingest records them (input_summary): Claude Code's from test_derive, Codex's from tests/fixtures/codex."""

    def test_shell_first_word(self):
        for tool, summary, want in [
            ("Bash", "npm test", "npm"),
            ("Bash", "uv run pytest -q", "uv"),
            ("Bash", "git add . && git commit -m 'x'", "git"),
            ("Bash", "cd web && npm run build", "npm"),
            ("Bash", "cd /tmp/x; ls -la", "ls"),
            ("Bash", "FORCE_COLOR=0 CI=1 npx vitest run", "npx"),
            ("Bash", "sudo -n lsof -i :8765", "lsof"),
            ("Bash", "( cd web && npm test )", "npm"),
            ("exec_command", "git status --short && git diff --numstat && git show HEAD:usage.html | sed -n '364,404p'", "git"),
            ("exec_command", "pwd && ls -la && rg --files .codex .vscode || true", "pwd"),
            ("exec_command", "bash -lc 'cd web && npm run build'", "npm"),
            ("exec_command", '/bin/zsh -lc "rg -n codex ."', "rg"),
        ]:
            self.assertEqual(input_pattern(tool, summary), want, summary)

    def test_file_extension_or_name(self):
        for tool, summary, want in [
            ("Edit", "/repo/a.py", ".py"),
            ("Write", "/repo/web/src/App.tsx", ".tsx"),
            ("Read", "/repo/Makefile", "Makefile"),
            ("NotebookEdit", "/repo/n.ipynb", ".ipynb"),
            ("apply_patch", "/repo/shop-ui/src/main.ts, /repo/README.md", ".ts"),
        ]:
            self.assertEqual(input_pattern(tool, summary), want, summary)

    def test_search_web_and_other(self):
        self.assertEqual(input_pattern("Grep", "def (incidents|error_loops)"), "def (incidents|error_loops)")
        self.assertEqual(input_pattern("Glob", "x" * 50), "x" * 40)
        self.assertEqual(input_pattern("WebFetch", "https://docs.python.org/3/library/re.html"), "docs.python.org")
        self.assertEqual(input_pattern("WebSearch", "duckdb quantile_cont"), "search")
        self.assertEqual(input_pattern("web_search", "duckdb quantile_cont"), "search")
        self.assertEqual(input_pattern("mcp__github__search_issues", '{"q": "bug"}'), "other")
        for tool in ("Bash", "Edit", "Grep", "WebFetch"):
            self.assertEqual(input_pattern(tool, ""), "other", tool)
        self.assertEqual(input_pattern("WebFetch", "not a url"), "other")
        self.assertEqual(input_pattern("WebFetch", "http://[invalid"), "other")


if __name__ == "__main__":
    unittest.main()
