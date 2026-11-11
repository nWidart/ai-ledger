# Tasks

## 1. Incidents

- [x] 1.1 Partition `incidents()` by session, subagent flag and `result_file` (one agent), not by session and subagent flag.
- [x] 1.2 Start a new incident after more than `INCIDENT_MAX_OK` (2) successful calls of the tool in between; pick 2 from the stored data.
- [x] 1.3 Take the next call from the agent's calls of the tool that start after the last failure ended (ASOF join); leave calls without a result out.
- [x] 1.4 Send `incident_max_ok` in the errors payload; regenerate the page fixtures.
- [x] 1.5 Tests: two successes keep an incident, three split it, two subagents apart, a parallel call is no next call.

## 2. Page

- [x] 2.1 Incident wording on the Errors page: "the agent's next call of that tool", the limit in the incident hint.
- [x] 2.2 One comparison for the summary, the table's Change and Rising fastest, with a call minimum and counts for few errors.

## 3. Measure

- [x] 3.1 Before and after on a copy of the store: incidents, share with 10 or more successes in between, didn't recover, recoveries that started before their failure ended.
