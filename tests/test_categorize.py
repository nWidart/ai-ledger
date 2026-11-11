import unittest

from ai_ledger.categorize import RULES, categorize, input_pattern, runs_tests


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
            ("Bash", "Exit code 1\n" + doc + "build failed", "cat SKILL.md && ./deploy.sh", "exit_other"),
        ]:
            self.assertEqual(categorize(err, tool, cmd), want, cmd)


class RunsTestsTest(unittest.TestCase):
    """A test run is a simple command whose command word runs tests, a build or a linter, not one that names a tool."""

    def test_test_build_and_lint_runs(self):
        for cmd in [
            "npm test", "npm run build", "pnpm run test:unit", "yarn lint", "bun test", "npm --prefix web run check",
            "cd web && npm run typecheck", "FORCE_COLOR=0 CI=1 npx vitest run", "npx tsc --noEmit", "pnpm exec eslint .",
            "cargo test --lib", "cargo clippy -- -D warnings", "cargo fmt --check", "go test ./...", "go build ./cmd/x",
            "make", "make -j4 test", "./vendor/bin/pest", "vendor/bin/phpunit --filter Foo", "php artisan test",
            "composer test", "composer run lint", "uv run pytest -q", "uv run python -m unittest discover -s tests",
            "python3 -m pytest tests", "sudo -n timeout 60 pytest", "./scripts/check.sh", "git status && npm test",
            "( cd web && npm test )", "for d in a b; do cargo test -p $d; done", "if cargo build; then echo ok; fi",
            "bash -lc 'cd web && npm run build'", "npx playwright test", "ls | tsc -p .",
        ]:
            self.assertTrue(runs_tests(cmd), cmd)

    def test_commands_that_only_name_a_tool(self):
        for cmd in [
            "sed -n 1,20p composer.json", "cat package.json | grep npm", "git add Cargo.toml && git commit -m 'bump cargo'",
            "ls ~/.cargo/registry/src", "cd ~/src/make-it && ls", "which cargo", "grep -rn pytest .", "echo npm test",
            "npm install", "npm ci", "npm run dev", "bun run src/cli.ts", "cargo run --release", "cargo fmt", "npx prettier --write .",
            "composer dump-autoload", "php artisan migrate", "go run .", "uv run python script.py", "npx playwright install",
            "",
        ]:
            self.assertFalse(runs_tests(cmd), cmd)


class RulesTest(unittest.TestCase):
    """Synthetic errors for the rules that depend on the command word, the tool, or a harness phrase."""

    def check(self, cases):
        for tool, err, cmd, want in cases:
            self.assertEqual(categorize(err, tool, cmd), want, (err, cmd))

    def test_worktree_outside_path_and_unverifiable_command(self):
        self.check([
            ("Bash", "This agent is isolated in the worktree /w but this command changes directory to the shared checkout (/repo) "
                     "before running git.", "cd /repo && git status", "worktree"),
            ("Edit", "This agent is isolated in the worktree /w. Edit the worktree copy of this file instead of the "
                     "shared-checkout path.", "/repo/a.py", "worktree"),
            ("Bash", "This session is isolated in the worktree /w but its working directory /x no longer exists and the "
                     "recovery target (/y) is outside that worktree.", "ls", "worktree"),
            ("Bash", "This agent is isolated in the worktree /w but this command is too complex to verify that it stays "
                     "inside the worktree.", "a && b | c", "worktree_verify"),
            ("Bash", "This session is isolated in the worktree /w but this command runs sed with a value computed at runtime "
                     "(the variable f).", "sed -i '' s/a/b/ $f", "worktree_verify"),
        ])

    def test_tests_and_git_need_the_command_word(self):
        self.check([
            ("Bash", "Exit code 1\nFAIL src/a.test.ts", "cd web && npm test", "tests"),
            ("Bash", "Exit code 101\nerror[E0308]: mismatched types", "cargo build", "tests"),
            ("Bash", "Exit code 2\nsed: 1: \"x\": unterminated substitute", "sed -n 1p Cargo.toml", "exit_other"),
            ("Bash", "Exit code 1\nbad", "which npm", "exit_other"),
            ("Bash", "Exit code 1\nerror: pathspec 'x' did not match", "git checkout x", "git"),
            ("Bash", "Exit code 1\nerror: could not open", "cd /repo && gh pr view 3", "git"),
            ("Bash", "Exit code 128\nfatal: not a git repository", "./publish.sh", "git"),
            ("Bash", "Exit code 1\nerror: unexpected value", "cat notes.md | grep 'git push'", "exit_other"),
        ])

    def test_no_file_ignores_case(self):
        self.check([
            ("Bash", "Exit code 1\nls: missing: No such file or directory", "ls missing", "no_file"),
            ("Bash", "Exit code 1\nopen x: no such file or directory", "go run .", "no_file"),
        ])

    def test_network_browser_mcp_and_timeout(self):
        self.check([
            ("exec_command", "Exit code 6\ncurl: (6) Could not resolve host: example.test", "curl https://example.test", "network"),
            ("WebFetch", "getaddrinfo ENOTFOUND example.test", "https://example.test", "network"),
            ("Bash", "Exit code 1\nTraceback (most recent call last):\nModuleNotFoundError: No module named 'x'", "python3 a.py", "python"),
            ("mcp__t3-code__preview_act", "Preview automation click received an invalid selector.", "", "browser"),
            ("mcp__t3-code__preview_wait_for", "Preview automation waitFor timed out after 5000ms.", "", "browser"),
            ("mcp__claude-in-chrome__browser_batch", "This element ref is stale.", "", "browser"),
            ("mcp__github__get_issue", "Resource not available: unauthorized", "", "mcp"),
            ("Bash", "Command timed out after 2m 0s", "npm run dev", "timeout"),
            ("mcp__node_repl__js", "js execution timed out; kernel reset", "", "timeout"),
            ("Read", "Something unexpected", "/a", "other"),
        ])

    def test_texts_are_source_neutral(self):
        for r in RULES:
            for k in ("why", "fix", "snippet"):
                self.assertNotIn("Claude ", r[k], r["id"])
                self.assertNotIn("categorize.py", r[k], r["id"])


if __name__ == "__main__":
    unittest.main()
