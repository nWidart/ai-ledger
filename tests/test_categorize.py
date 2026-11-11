import unittest

from ai_ledger.categorize import categorize, input_pattern


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


class BadCallTest(unittest.TestCase):
    """bad_call holds harness and tool-validation messages, never a shell command's own output."""

    def test_validation_messages_are_bad_call(self):
        for tool, err in [
            ("Edit", "No such tool available: Edit"),
            ("mcp__t3-code__preview_evaluate", "Invalid parameters for tool 'preview_evaluate'"),
            ("TaskUpdate", 'Missing key at ["taskIds"]'),
            ("mcp__github__get_pull_request", "Pass either url, or both repository and number."),
            ("Bash", "InputValidationError: Bash failed due to the following issue: The required parameter `command` is missing"),
        ]:
            self.assertEqual(categorize(err, tool, ""), "bad_call", err)

    def test_shell_output_is_not_bad_call(self):
        doc = "---\nname: quick-fix\ndescription: A small fix.\n---\nUse at most one builder. Pass the plan path.\n"
        for tool, err, cmd, want in [
            ("Bash", "Exit code 1\n" + doc + "cat: missing.md: No such file or directory", "cat SKILL.md missing.md", "no_file"),
            ("Bash", "Exit code 1\n" + doc + "Pass either a path or a name, at most once.", "cat SKILL.md; false", "chained"),
            ("exec_command", "Exit code 2\n" + doc + "1 failed", "npm test", "tests"),
            ("Bash", "Exit code 1\n" + doc + "Invalid parameters: fatal", "git show HEAD:SKILL.md", "git"),
            ("Bash", "Exit code 1\n" + doc + "build failed", "cat SKILL.md && ./build.sh", "exit_other"),
        ]:
            self.assertEqual(categorize(err, tool, cmd), want, cmd)


if __name__ == "__main__":
    unittest.main()
