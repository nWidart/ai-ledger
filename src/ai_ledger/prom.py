"""The /metrics endpoint: the store's figures in the Prometheus text exposition format (version 0.0.4), written by hand.

Counters are totals over the whole store, labelled by the session's source, project, automated flag and workload. Gauges
are worked out at each scrape. No label holds a session id, a prompt, a command, an error message, a path or any other
transcript text: only names (source, project, model, workload, tool, error category, state, limit) and the app version."""
import json
import os
import sys
import threading
from datetime import datetime, timezone

from . import metrics, store, titles

CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"
DEFAULT_WORKLOAD = "default"
UNKNOWN = "(unknown)"  # a label for a value the store does not have, as the Errors page names a session without a project
BUCKETS = (0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600)  # seconds, the tool-call duration histogram's upper bounds
BATCH = 500  # sessions whose first prompt one read fetches
# The user's workloads file, {"workloads": [{"name": ..., "prompt_prefix": ...}, ...]}: names groups of sessions by the start
# of their first prompt. It sits next to the store, like metrics.USER_AUTOMATED; the app points it at the --db folder.
USER_WORKLOADS = os.path.join(store.data_dir(), "workloads.json")


# ---------- workloads ----------

def read_workloads(path=None):
    """(entries, error) from the user workloads file, entries [(name, prompt_prefix)]: ([], None) when there is none;
    ([], a message) when it cannot be read or is malformed, so a bad edit is reported and ignored whole."""
    try:
        with open(path or USER_WORKLOADS) as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return [], None
    except (OSError, ValueError) as e:  # JSONDecodeError is a ValueError
        return [], str(e)
    entries = data.get("workloads") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        return [], 'no "workloads" list'
    if not all(isinstance(e, dict) and isinstance(e.get("name"), str) and e["name"] and isinstance(e.get("prompt_prefix"), str)
               and e["prompt_prefix"] for e in entries):
        return [], "each workload needs a name and a prompt_prefix (non-empty text)"
    return [(e["name"], e["prompt_prefix"]) for e in entries], None


def file_key(path):
    """A user file's (mtime_ns, size), which changes with an edit; None when there is none."""
    try:
        st = os.stat(path)
    except OSError:
        return None
    return st.st_mtime_ns, st.st_size


def workload_of(entries, prompt):
    """The name of the first entry whose prefix starts prompt, else DEFAULT_WORKLOAD."""
    return next((name for name, prefix in entries if prompt.startswith(prefix)), DEFAULT_WORKLOAD)


class Workloads:
    """Each session's workload, from the user workloads file and its first prompt. A session's first prompt does not change,
    so a session is matched once; a session with no prompt yet is matched again later. The map is kept for the file's
    mtime and size: a changed file clears it, and a bad file is reported on stderr once per change. Thread-safe."""

    def __init__(self, path=None):
        self.path = path  # None: USER_WORKLOADS when read, so the app can point it at the --db folder
        self.lock = threading.Lock()
        self.key, self.entries, self.of = (), [], {}  # () is no stat: the first call reads the file

    def stat(self):
        return file_key(self.path or USER_WORKLOADS)

    def get(self, cur, sids):
        """{session_id: workload} for the sessions of sids with a workload other than DEFAULT_WORKLOAD."""
        with self.lock:
            key = self.stat()
            if key != self.key:
                self.key, self.of = key, {}
                self.entries, error = read_workloads(self.path)
                if error:
                    print(f"workloads file ignored: {error}", file=sys.stderr, flush=True)
            if not self.entries:
                return {}
            new = [sid for sid in sids if sid not in self.of]
            for i in range(0, len(new), BATCH):
                part = new[i:i + BATCH]
                prompted = [r[0] for r in cur.execute("SELECT DISTINCT session_id FROM prompts WHERE list_contains(?, session_id)",
                                                      [part]).fetchall()]
                texts = titles.first_prompts(cur, prompted) if prompted else {}
                self.of |= {sid: workload_of(self.entries, texts.get(sid, "")) for sid in prompted}
            return {sid: self.of[sid] for sid in sids if self.of.get(sid, DEFAULT_WORKLOAD) != DEFAULT_WORKLOAD}


# ---------- text format ----------

def escape(value):
    """A label value as the text format writes it: backslash, double quote and newline escaped."""
    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def number(v):
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, int):
        return str(v)
    v = float(v)
    return "+Inf" if v == float("inf") else "-Inf" if v == float("-inf") else "NaN" if v != v else repr(v)


def family(name, kind, text, samples):
    """One metric family: its # HELP and # TYPE lines and its samples, each (labels dict, value) or, for a histogram's
    series, (suffix, labels dict, value)."""
    out = [f"# HELP {name} {text}", f"# TYPE {name} {kind}"]
    for s in samples:
        suffix, labels, value = s if len(s) == 3 else ("", *s)
        lab = ",".join(f'{k}="{escape(v)}"' for k, v in labels.items())
        out.append(f"{name}{suffix}{{{lab}}} {number(value)}" if lab else f"{name}{suffix} {number(value)}")
    return "\n".join(out) + "\n"


# ---------- counters ----------

BASE = ("source", "project", "automated", "workload")  # every counter family's labels, in this order


def labels_cte(workloads, user_projects=None):
    """CTEs wl and lab: lab(session_id, source, project, automated, workload) for every session, automated 'true' or 'false'
    by the pages' rule (metrics.automated_session with no project filter). workloads: {session_id: name}, the sessions not
    in it are DEFAULT_WORKLOAD. Returns (sql, params)."""
    auto, ap = metrics.automated_session("", user_projects)
    return (f"""wl AS (SELECT unnest(?::VARCHAR[]) AS session_id, unnest(?::VARCHAR[]) AS workload),
        lab AS (SELECT s.session_id, coalesce(s.source, 'claude') AS source, coalesce(s.project, '{UNKNOWN}') AS project,
                       CASE WHEN {auto} THEN 'true' ELSE 'false' END AS automated, coalesce(wl.workload, '{DEFAULT_WORKLOAD}') AS workload
                FROM sessions s LEFT JOIN wl USING (session_id))""", [list(workloads), list(workloads.values()), *ap])


def counters(cur, workloads, prices=None, user_projects=None):
    """The counter and histogram families over the whole store, as text. workloads: {session_id: name} (see labels_cte)."""
    prices = metrics.load_prices() if prices is None else prices
    lab, lp = labels_cte(workloads, user_projects)
    base = lambda r: dict(zip(BASE, r[:4]))
    pcte, pparams = metrics.price_cte(prices)
    req = cur.execute(f"""{metrics.requests_cte(pcte, "true")}, {lab}
        SELECT l.source, l.project, l.automated, l.workload, coalesce(rq.model, '{UNKNOWN}'), count(*),
               count(*) FILTER (WHERE rq.cost IS NULL), coalesce(sum(rq.cost), 0),
               {", ".join(f"coalesce(sum(rq.{k}), 0)" for k in metrics.TOKEN_KINDS)}
        FROM rq JOIN lab l USING (session_id) GROUP BY ALL ORDER BY ALL""", pparams + lp).fetchall()
    ses = cur.execute(f"""WITH {lab},
        pr AS (SELECT session_id, count(*) AS n FROM prompts GROUP BY 1),
        tc AS (SELECT session_id, count(*) FILTER (WHERE is_commit AND test_passed) AS commits,
                      count(*) FILTER (WHERE is_test AND test_passed) AS passed, count(*) FILTER (WHERE is_test AND NOT test_passed) AS failed
               FROM tool_calls GROUP BY 1),
        {metrics.runs_cte("SELECT session_id FROM sessions")}
        SELECT l.source, l.project, l.automated, l.workload, count(*), coalesce(sum(s.compactions), 0), coalesce(sum(pr.n), 0),
               coalesce(sum(tc.commits), 0), coalesce(sum(tc.passed), 0), coalesce(sum(tc.failed), 0), coalesce(sum(runs.model_ms), 0)
        FROM lab l JOIN sessions s USING (session_id) LEFT JOIN pr USING (session_id) LEFT JOIN tc USING (session_id)
        LEFT JOIN runs USING (session_id) GROUP BY ALL ORDER BY ALL""", lp).fetchall()
    # A call counts once it has a result, so a running call never moves from ok to error.
    calls = cur.execute(f"""WITH {lab} SELECT l.source, l.project, l.automated, l.workload, coalesce(t.tool, '{UNKNOWN}'),
        count(*) FILTER (WHERE NOT t.is_error), count(*) FILTER (WHERE t.is_error)
        FROM tool_calls t JOIN lab l USING (session_id) WHERE t.is_error IS NOT NULL GROUP BY ALL ORDER BY ALL""", lp).fetchall()
    errors = cur.execute(f"""WITH {lab} SELECT l.source, l.project, l.automated, l.workload, coalesce(t.category, 'other'), count(*)
        FROM tool_calls t JOIN lab l USING (session_id) WHERE t.is_error GROUP BY ALL ORDER BY ALL""", lp).fetchall()
    # Calls with usable timing (metrics.latency), as the pages time them.
    hist = cur.execute(f"""WITH {lab} SELECT l.source, l.workload, coalesce(t.tool, '{UNKNOWN}'),
        {", ".join(f"count(*) FILTER (WHERE t.ms <= {round(b * 1000)})" for b in BUCKETS)}, count(*), sum(t.ms)
        FROM (SELECT session_id, tool, {metrics.latency()} AS ms FROM tool_calls) t JOIN lab l USING (session_id)
        WHERE t.ms IS NOT NULL GROUP BY ALL ORDER BY ALL""", lp).fetchall()

    with_model = lambda r: dict(base(r), model=r[4])
    tokens = [(dict(with_model(r), kind=k), r[8 + i]) for r in req for i, k in enumerate(metrics.TOKEN_KINDS)]
    tests = [(dict(base(r), result=res), r[i]) for r in ses if r[8] or r[9] for res, i in (("passed", 8), ("failed", 9))]
    tool_calls = [(dict(base(r), tool=r[4], result=res), r[i]) for r in calls for res, i in (("ok", 5), ("error", 6))]
    buckets = []
    for r in hist:
        lb = dict(source=r[0], workload=r[1], tool=r[2])
        buckets += [("_bucket", dict(lb, le=f"{b:g}"), r[3 + i]) for i, b in enumerate(BUCKETS)]
        n = len(BUCKETS)
        buckets += [("_bucket", dict(lb, le="+Inf"), r[3 + n]), ("_sum", lb, r[4 + n] / 1000), ("_count", lb, r[3 + n])]
    return "".join([
        family("ai_ledger_requests_total", "counter", "Model requests.", [(with_model(r), r[5]) for r in req]),
        family("ai_ledger_unpriced_requests_total", "counter", "Model requests with no reported cost and no list price.",
               [(with_model(r), r[6]) for r in req]),
        family("ai_ledger_cost_usd_total", "counter", "Cost in USD: the reported cost, else the list-price estimate.",
               [(with_model(r), r[7]) for r in req]),
        family("ai_ledger_tokens_total", "counter", "Tokens by kind.", tokens),
        family("ai_ledger_sessions_total", "counter", "Sessions.", [(base(r), r[4]) for r in ses]),
        family("ai_ledger_prompts_total", "counter", "Human prompts.", [(base(r), r[6]) for r in ses]),
        family("ai_ledger_compactions_total", "counter", "Context compactions.", [(base(r), r[5]) for r in ses]),
        family("ai_ledger_commits_total", "counter", "Commits that succeeded.", [(base(r), r[7]) for r in ses]),
        family("ai_ledger_model_seconds_total", "counter", "Model time in seconds, as the session sheet shows it.",
               [(base(r), r[10] / 1000) for r in ses]),
        family("ai_ledger_test_runs_total", "counter", "Test and build runs by result.", tests),
        family("ai_ledger_tool_calls_total", "counter", "Tool calls with a result, by tool and result.", tool_calls),
        family("ai_ledger_tool_errors_total", "counter", "Failed tool calls by error category.",
               [(dict(base(r), category=r[4]), r[5]) for r in errors]),
        family("ai_ledger_tool_call_duration_seconds", "histogram", "Tool-call durations in seconds.", buckets),
    ])


# ---------- gauges ----------

def unix(ts):
    """Unix time of an ISO timestamp; one without a zone is UTC, as the store keeps time."""
    t = datetime.fromisoformat(ts)
    return (t if t.tzinfo else t.replace(tzinfo=timezone.utc)).timestamp()


def gauges(active, workloads, windows, state, version):
    """The gauge families as text. active: live.states rows; workloads: {session_id: name} for them; windows: the open
    windows of a Limits payload; state: App.state."""
    counts = {}
    for a in active:
        k = (a["source"] or "claude", a["project"] or UNKNOWN, workloads.get(a["session_id"], DEFAULT_WORKLOAD), a["state"])
        counts[k] = counts.get(k, 0) + 1
    sessions = [(dict(zip(("source", "project", "workload", "state"), k)), n) for k, n in sorted(counts.items())]
    lw = lambda w: dict(provider=w["provider"], limit=w["limit_id"] + (f"/{w['scope']}" if w["scope"] else ""), window=w["label"])
    used = [(lw(w), w["current"] / 100) for w in windows if w["current"] is not None]
    resets = [(lw(w), unix(w["resets_at"])) for w in windows if w["resets_at"]]
    last = [({}, unix(state["last_ingest"]))] if state["last_ingest"] else []
    return "".join([
        family("ai_ledger_active_sessions", "gauge", "Active sessions by live state, as the Live page lists them.", sessions),
        family("ai_ledger_limit_used_ratio", "gauge", "Used share of each open plan-limit window, 0 to 1.", used),
        family("ai_ledger_limit_resets_timestamp_seconds", "gauge", "Unix time each open plan-limit window resets.", resets),
        family("ai_ledger_last_ingest_timestamp_seconds", "gauge", "Unix time of the last ingest that finished.", last),
        family("ai_ledger_ingest_failed", "gauge", "1 when the last ingest failed, else 0.", [({}, 1 if state["error"] else 0)]),
        family("ai_ledger_build_info", "gauge", "The app version.", [(dict(version=version), 1)]),
    ])
