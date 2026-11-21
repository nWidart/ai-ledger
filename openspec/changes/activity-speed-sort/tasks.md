# Tasks

## 1. Sessions by model time and speed

- [x] 1.1 Add `model_ms` and `output_per_s` to `/api/sessions` rows (`metrics.add_runs`) and `model_ms`, `output_per_s` to `SESSION_SORTS`, sessions without model time last either way. Verify with `test_metrics.py` ("test_a_session_cut_by_the_range_counts_its_whole_output", "test_sort_by_model_time_and_output_speed", "test_session_sort").
- [x] 1.2 Add the Model and Tok/s columns to `SessionsPanel` with their sort keys and order hints, and fit the table at 1440px. Verify with `ActivityPage.test.tsx` ("shows each session's model time and output speed", "sends each sortable Sessions column's own key") and, in a browser, no sideways scroll at 1280 and 1440px.
- [x] 1.3 Point the Output speed vital at `output_per_s`, descending. Verify with `ActivityPage.test.tsx` ("… Sessions by output speed").
- [x] 1.4 Regenerate the page fixtures (`tests.test_web_fixtures`).

## 2. Large-results advice per agent

- [x] 2.1 Guard the subagent line of `large_results_advice` with `per_agent`. Verify with `test_context.py` ("test_large_results_advice_names_subagents_for_claude_code_only", "test_large_results").

## 3. First screen

- [x] 3.1 Trim 20px of Overview's vertical spacing in `activity.css`. Verified with `tools/demo/firstscreen.mjs`: the tab list ends at 839px of 900 (859 before), other pages unchanged.

## 4. Review round 1

- [x] 4.1 Keep the sorted Sessions column shown at every width and hide Model and Tok/s under 66em only (`opt1`). Verify with `ActivityPage.test.tsx` ("… a dash for one that records none") and, in a browser, no sideways scroll from 900 to 1440px.
- [x] 4.2 Count a session's output in the vital only when it records model time (`runs_cte`). Verify with `test_metrics.py` ("test_sort_by_model_time_and_output_speed").
- [x] 4.3 Take the large-results advice's agents from the results' sessions, and keep the generic Codex line beside other remedies. Verify with `test_context.py` ("test_large_results_advice_follows_the_results_sessions", "test_large_results_advice_for_a_claude_read_and_a_codex_tool_with_no_remedy").
- [x] 4.4 Name Model time and output speed among the selected day's whole-session figures, and update `README.md`.

## 5. Docs

- [x] 5.1 Add the changes to `CHANGELOG.md`, and update `README.md` and the docs site where they describe the Sessions columns or the Output speed vital.
