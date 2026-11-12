"""Families of the free-form goal and friction labels /insights writes: `create_pull_request` and `open_pr` are one goal family.

A name is lower-cased and split into tokens on `_`, `-`, spaces and `/`. The rules of its kind are walked in order and the first
rule with a matching pattern wins. A pattern is a token (equal to one of the name's tokens) or a token sequence (those tokens
consecutively in the name). A name no rule matches is a family of its own, keyed by the raw name: there is no "Other" bucket.
Families are computed when a payload is built and never stored.
"""
import re

SPLIT = re.compile(r"[_\-\s/]+")

# kind -> [(family key, patterns)] in match order, one line per rule. A pattern with a space is a token sequence.
RULES = {
    "goal": [
        ("pull_request", ("pr", "prs", "pull request", "pull requests", "merge request")),
        ("release", ("release", "releases", "publish", "deploy", "deployment", "version bump", "changelog")),
        ("git_cleanup", ("git", "commit", "commits", "branch", "branches", "rebase", "worktree", "worktrees", "stash", "cherry pick", "merge", "squash", "push")),
        ("tests", ("test", "tests", "testing", "coverage")),
        ("fix_bug", ("fix", "fixes", "bug", "bugs", "bugfix", "debug", "debugging", "troubleshoot", "regression", "crash", "failing", "failure", "error", "errors")),
        ("docs", ("doc", "docs", "documentation", "document", "readme", "comment", "comments", "guide")),
        ("review", ("review", "audit", "critique")),
        ("refactor", ("refactor", "refactoring", "cleanup", "clean up", "simplify", "rename", "restructure", "reorganize", "migrate", "migration")),
        ("configure", ("config", "configure", "configuration", "setup", "set up", "install", "ci", "tooling", "dependency", "dependencies", "upgrade")),
        ("research", ("explore", "investigate", "investigation", "research", "understand", "analyze", "analysis", "explain", "question", "plan", "planning", "design", "brainstorm")),
        ("implement_feature", ("implement", "implementation", "feature", "features", "add", "build", "create", "develop", "write")),
    ],
    "friction": [
        ("misunderstood_request", ("misunderstood", "misunderstanding", "misinterpreted", "misread", "unclear", "ambiguous")),
        ("wrong_approach", ("approach", "wrong", "incorrect", "assumption", "assumptions")),
        ("buggy_code", ("bug", "bugs", "buggy", "broken", "regression", "error", "errors", "failing", "failure")),
        ("excessive_changes", ("excessive", "scope", "overreach", "unrequested", "unwanted", "over engineered", "overengineered")),
        ("tooling", ("tool", "tools", "tooling", "environment", "permission", "permissions", "timeout", "ci", "flaky", "sandbox", "network")),
        ("rejected_action", ("rejected", "interrupted", "denied", "reverted")),
        ("slow", ("slow", "stalled", "stuck", "loop", "repeated")),
    ],
}
COMPILED = {kind: [(key, [tuple(p.split()) for p in patterns]) for key, patterns in rules] for kind, rules in RULES.items()}


def contains(tokens, pattern):
    """Whether the pattern's tokens appear consecutively in tokens."""
    n = len(pattern)
    return any(tuple(tokens[i:i + n]) == pattern for i in range(len(tokens) - n + 1))


def family(kind, name):
    """The family key of a goal or friction name: that of the first rule of the kind with a matching pattern, else the name."""
    tokens = [t for t in SPLIT.split(name.lower()) if t]
    for key, patterns in COMPILED[kind]:
        if any(contains(tokens, p) for p in patterns):
            return key
    return name


def group(kind, rows, pairs):
    """The families of rows, [{family, n, sessions, members}]: rows are [{name, n, sessions}] of one kind, pairs the
    (name, session_id) pairs behind them. n sums the members' n; sessions counts the distinct sessions with any member. Members
    come most counted first, then by name; families by n, then sessions (both descending), then key."""
    keys = {r["name"]: family(kind, r["name"]) for r in rows}
    carried = {}
    for name, sid in pairs:
        carried.setdefault(keys[name], set()).add(sid)
    out = {}
    for r in rows:
        f = out.setdefault(keys[r["name"]], dict(family=keys[r["name"]], n=0, sessions=len(carried.get(keys[r["name"]], ())), members=[]))
        f["n"] += r["n"]
        f["members"].append(dict(r))
    for f in out.values():
        f["members"].sort(key=lambda m: (-m["n"], m["name"]))
    return sorted(out.values(), key=lambda f: (-f["n"], -f["sessions"], f["family"]))
