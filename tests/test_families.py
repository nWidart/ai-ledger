"""Families of goal and friction labels: the rules, their order, token matching, and the grouping of payload rows."""
import unittest

from ai_ledger import families


class FamilyTest(unittest.TestCase):
    def check(self, kind, table):
        for name, want in table:
            with self.subTest(kind=kind, name=name):
                self.assertEqual(families.family(kind, name), want)

    def test_every_goal_rule_matches(self):
        self.check("goal", [
            ("create_pull_request", "pull_request"), ("open_pr", "pull_request"), ("merge_request", "pull_request"),
            ("cut_release", "release"), ("deploy_app", "release"), ("version_bump", "release"), ("update_changelog", "release"),
            ("git_cleanup", "git_cleanup"), ("rebase_branch", "git_cleanup"), ("cherry_pick_fix", "git_cleanup"), ("squash_commits", "git_cleanup"),
            ("write_tests", "tests"), ("raise_coverage", "tests"),
            ("fix_bug", "fix_bug"), ("debug_crash", "fix_bug"), ("investigate_regression", "fix_bug"),
            ("update_docs", "docs"), ("write_readme", "docs"),
            ("code_review", "review"), ("audit_logs", "review"),
            ("refactor_store", "refactor"), ("rename_module", "refactor"), ("migrate_schema", "refactor"),
            ("configure_ci", "configure"), ("install_tool", "configure"), ("upgrade_dependencies", "configure"),
            ("explore_idea", "research"), ("plan_work", "research"), ("understand_code", "research"),
            ("implement_feature", "implement_feature"), ("build_toggle", "implement_feature"), ("add_button", "implement_feature"),
        ])

    def test_every_friction_rule_matches(self):
        self.check("friction", [
            ("misunderstood_request", "misunderstood_request"), ("ambiguous_prompt", "misunderstood_request"),
            ("wrong_approach", "wrong_approach"), ("incorrect_assumptions", "wrong_approach"),
            ("buggy_code", "buggy_code"), ("broken_build", "buggy_code"), ("test_failure", "buggy_code"),
            ("excessive_changes", "excessive_changes"), ("scope_creep", "excessive_changes"), ("over_engineered", "excessive_changes"),
            ("environment", "tooling"), ("permission_denied", "tooling"), ("flaky_ci", "tooling"),
            ("user_rejected_action", "rejected_action"), ("interrupted", "rejected_action"),
            ("slow_tests", "slow"), ("stuck_loop", "slow"),
        ])

    def test_first_matching_rule_wins(self):
        self.check("goal", [
            ("fix_failing_test", "tests"),  # tests comes before fix_bug
            ("create_pull_request", "pull_request"),  # pull_request before implement_feature
            ("write_docs", "docs"),  # docs before implement_feature
            ("merge_pull_request", "pull_request"),  # pull_request before git_cleanup
            ("debug_ci_failure", "fix_bug"),  # fix_bug before configure
        ])
        self.check("friction", [("tool_error", "buggy_code"), ("wrong_test_failure", "wrong_approach")])

    def test_sequences_match_consecutive_tokens_only(self):
        self.check("goal", [
            ("pull_request", "pull_request"), ("pull_a_request", "pull_a_request"), ("request_pull", "request_pull"),
            ("clean_up_code", "refactor"), ("up_clean", "up_clean"), ("clean_the_up", "clean_the_up"),
            ("set_up_env", "configure"), ("cherry_pick", "git_cleanup"), ("cherry", "cherry"), ("version_bump", "release"),
        ])
        self.check("friction", [("over_engineered", "excessive_changes"), ("over", "over")])

    def test_matches_whole_tokens_not_substrings(self):
        self.check("goal", [
            ("prs", "pull_request"), ("express_routes", "express_routes"), ("address_feedback", "address_feedback"),
            ("prefix", "prefix"), ("testimony", "testimony"), ("bugle", "bugle"), ("digit", "digit"),
        ])

    def test_hyphens_spaces_slashes_and_case(self):
        self.check("goal", [
            ("Open-PR", "pull_request"), ("OPEN PR", "pull_request"), ("open/pr", "pull_request"), ("Fix-Bug", "fix_bug"),
            ("clean-up", "refactor"), ("Pull Request", "pull_request"), ("__pr__", "pull_request"),
        ])

    def test_unmatched_name_is_its_own_family_keeping_its_spelling(self):
        self.check("goal", [("Learn_Rust", "Learn_Rust"), ("", ""), ("___", "___")])
        self.check("friction", [("User-Mood", "User-Mood")])

    def test_kinds_have_their_own_rules(self):
        self.check("goal", [("environment", "environment")])
        self.check("friction", [("environment", "tooling"), ("pull_request", "pull_request")])


class GroupTest(unittest.TestCase):
    ROWS = [dict(name="create_pull_request", n=3, sessions=2), dict(name="fix_bug", n=3, sessions=1),
            dict(name="open_pr", n=2, sessions=2), dict(name="learn_rust", n=1, sessions=1)]

    def test_sums_counts_and_counts_distinct_sessions(self):
        pairs = [("create_pull_request", "s1"), ("create_pull_request", "s2"), ("open_pr", "s1"), ("open_pr", "s3"),
                 ("fix_bug", "s1"), ("learn_rust", "s4")]
        got = families.group("goal", self.ROWS, pairs)
        pr = next(f for f in got if f["family"] == "pull_request")
        self.assertEqual((pr["n"], pr["sessions"]), (5, 3))  # s1 carries both members: not 2 + 2
        self.assertEqual(pr["members"], [dict(name="create_pull_request", n=3, sessions=2), dict(name="open_pr", n=2, sessions=2)])

    def test_orders_families_and_members(self):
        rows = [dict(name="b_pr", n=2, sessions=1), dict(name="a_pr", n=2, sessions=1), dict(name="open_pr", n=5, sessions=1),
                dict(name="docs", n=9, sessions=1), dict(name="zzz", n=3, sessions=2), dict(name="aaa", n=3, sessions=1),
                dict(name="bbb", n=3, sessions=2)]
        pairs = [(r["name"], f"{r['name']}-{i}") for r in rows for i in range(r["sessions"])]
        got = families.group("goal", rows, pairs)
        self.assertEqual([(f["family"], f["n"], f["sessions"]) for f in got],
                         [("pull_request", 9, 3), ("docs", 9, 1), ("bbb", 3, 2), ("zzz", 3, 2), ("aaa", 3, 1)])  # ties: more sessions, then key
        self.assertEqual([m["name"] for m in next(f for f in got if f["family"] == "pull_request")["members"]], ["open_pr", "a_pr", "b_pr"])

    def test_unmatched_names_are_single_member_families(self):
        got = families.group("friction", [dict(name="mood", n=1, sessions=1)], [("mood", "s1")])
        self.assertEqual(got, [dict(family="mood", n=1, sessions=1, members=[dict(name="mood", n=1, sessions=1)])])

    def test_no_rows_no_families(self):
        self.assertEqual(families.group("goal", [], []), [])


if __name__ == "__main__":
    unittest.main()
