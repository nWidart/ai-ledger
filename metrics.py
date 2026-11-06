"""Queries behind the dashboards: the errors payload and the usage metrics. SQL over the derived tables."""
import json
import os
import re
from datetime import date, timedelta

from categorize import RULES

HERE = os.path.dirname(os.path.abspath(__file__))
NEAR_LIMIT = 0.8  # share of the context window that counts as "near the limit"
TOKEN_KINDS = ["input", "output", "thinking", "cache_read", "cache_5m", "cache_1h"]
AUTOMATED_PROJECTS = ("observer-sessions",)  # projects whose sessions a tool starts, left out of usage unless asked for


def load_prices(path=os.path.join(HERE, "prices.json")):
    with open(path) as fh:
        return json.load(fh)["models"]


def rows(cur, sql, params=()):
    cur.execute(sql, list(params))
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def iso(ts):
    return ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z" if ts else None


# ---------- errors dashboard ----------

def errors_payload(cur, last_ingest=None, today=None):
    """The JSON shape the Errors page reads (the same shape the old static page read). today anchors its ranges, as in usage()."""
    errs = rows(cur, """
        SELECT t.tool_use_id AS id, t.end_ts AS ts, coalesce(s.project, '(unknown)') AS p, t.session_id AS s,
               t.tool AS t, t.category AS c, left(t.input_summary, 400) AS i, t.error AS e, coalesce(t.followup, '') AS r,
               CASE WHEN t.subagent THEN 1 ELSE 0 END AS sub
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.is_error AND t.end_ts IS NOT NULL ORDER BY t.end_ts""")
    for e in errs:
        e["d"] = e["ts"].strftime("%Y-%m-%d")
        e["ts"] = iso(e["ts"])
        e["e"] = e["e"] or ""
    inc, of = incidents(cur)
    for e in errs:
        e["n"] = of.get(e["id"])
    calls = cur.execute("""
        SELECT strftime(t.start_ts, '%Y-%m-%d') AS d, coalesce(s.project, '(unknown)') AS p, count(*),
               count(*) FILTER (WHERE t.subagent)
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.start_ts IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()
    return dict(generated=last_ingest, today=(today or date.today()).isoformat(), project_order=project_order(cur), categories=[{k: r[k] for k in ("id", "label", "why", "fix", "snippet")} for r in RULES],
                errors=errs, calls=[list(c) for c in calls], error_days=error_days(cur), incidents=inc,
                incident_gap_minutes=INCIDENT_GAP_MINUTES)


INCIDENT_GAP_MINUTES = 10  # a failure more than this long after the previous one of the same tool starts a new incident


def incidents(cur):
    """Failed calls grouped into incidents: failures of one tool in one session (main thread and subagents apart) with the
    same category, each starting at most INCIDENT_GAP_MINUTES after the previous one ended. Calls of that tool that succeed in
    between don't end an incident (ok counts them), so an intermittent problem reads as one episode.
    Returns (incidents, {tool_use_id: incident index}). Each incident: s session, t tool, c category, p project, sub,
    first/last (ISO start of the first failure, end of the last), ok, outcome of the tool's next call in the session after the
    last failure ("recovered": it succeeded; "failed_again": it failed with another error, or later than the gap; "gave_up":
    the session never called that tool again), and for a recovery rid, ri (its input, cut to 400) and rts (its start)."""
    got = cur.execute(f"""
        WITH seq AS (
          SELECT tool_use_id AS id, session_id, tool, subagent, category, is_error, end_ts, coalesce(start_ts, end_ts) AS ts,
                 sum(CASE WHEN is_error THEN 0 ELSE 1 END) OVER w AS oks,
                 lead(tool_use_id) OVER w AS n_id, lead(is_error) OVER w AS n_err
          FROM tool_calls WHERE coalesce(start_ts, end_ts) IS NOT NULL
          WINDOW w AS (PARTITION BY session_id, subagent, tool ORDER BY coalesce(start_ts, end_ts), tool_use_id)),
        fails AS (
          SELECT *, CASE WHEN ts - lag(end_ts) OVER f <= INTERVAL {INCIDENT_GAP_MINUTES} MINUTE THEN 0 ELSE 1 END AS brk
          FROM seq WHERE is_error AND end_ts IS NOT NULL
          WINDOW f AS (PARTITION BY session_id, subagent, tool, category ORDER BY ts, id)),
        grp AS (
          SELECT *, sum(brk) OVER (PARTITION BY session_id, subagent, tool, category ORDER BY ts, id) AS g FROM fails),
        inc AS (
          SELECT session_id, subagent, tool, category AS c, g, list(id ORDER BY ts, id) AS ids, min(ts) AS first,
                 max(end_ts) AS last, max(oks) - min(oks) AS ok, list(n_id ORDER BY ts, id)[-1] AS n_id,
                 list(n_err ORDER BY ts, id)[-1] AS n_err
          FROM grp GROUP BY 1, 2, 3, 4, 5)
        SELECT i.session_id, i.tool, i.c, coalesce(s.project, '(unknown)'), i.subagent, i.first, i.last, i.ok, i.ids,
               CASE WHEN i.n_id IS NULL THEN 'gave_up' WHEN NOT i.n_err THEN 'recovered' ELSE 'failed_again' END,
               CASE WHEN NOT i.n_err THEN i.n_id END, CASE WHEN NOT i.n_err THEN left(r.input_summary, 400) END,
               CASE WHEN NOT i.n_err THEN coalesce(r.start_ts, r.end_ts) END
        FROM inc i LEFT JOIN sessions s USING (session_id) LEFT JOIN tool_calls r ON r.tool_use_id = i.n_id
        ORDER BY i.first, i.session_id, i.tool, i.c""").fetchall()
    out, of = [], {}
    for sid, tool, c, p, sub, first, last, ok, ids, outcome, rid, ri, rts in got:
        for x in ids:
            of[x] = len(out)
        out.append(dict(s=sid, t=tool, c=c, p=p, sub=1 if sub else 0, first=iso(first), last=iso(last), ok=ok, outcome=outcome,
                        rid=rid, ri=ri or "", rts=iso(rts)))
    return out, of


def error_days(cur):
    """Failed calls per [day, project, category, errors, subagent errors], dated like an error's d (its end time),
    so the stacked chart sums counts instead of walking every error."""
    return [list(r) for r in cur.execute("""
        SELECT strftime(t.end_ts, '%Y-%m-%d') AS d, coalesce(s.project, '(unknown)') AS p, t.category AS c, count(*),
               count(*) FILTER (WHERE t.subagent)
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.is_error AND t.end_ts IS NOT NULL GROUP BY 1, 2, 3 ORDER BY 1, 2, 3""").fetchall()]


# Ingest caps (store.py, categorize.summarize_input): text at its cap may have been cut when recorded.
RECORD_CAPS = dict(e=700, r=500)
JSON_INPUT_CAP = 300


def error_detail(cur, tool_use_id):
    """The full recorded input, error and followup of one tool call, or None. cut: the fields that hit an ingest cap."""
    r = rows(cur, "SELECT input_summary AS i, error AS e, followup AS r FROM tool_calls WHERE tool_use_id = ?", [tool_use_id])
    if not r:
        return None
    d = {k: v or "" for k, v in r[0].items()}
    cut = [k for k, n in RECORD_CAPS.items() if len(d[k]) >= n]
    if d["i"].startswith("{") and len(d["i"]) >= JSON_INPUT_CAP:
        cut.insert(0, "i")
    return dict(id=tool_use_id, **d, cut=cut)


# ---------- usage dashboard ----------

def price_cte(prices):
    """A VALUES table of prices per model. Each model has a base tier and, optionally, a long-prompt tier."""
    vals, params = [], []
    for model, p in prices.items():
        long = p.get("long") or {}
        vals.append("(" + ",".join("?" * 13) + ")")
        params += [model, p["context"], p.get("long_above"), p["input"], p["output"], p["cache_read"], p["cache_5m"], p["cache_1h"],
                   long.get("input"), long.get("output"), long.get("cache_read"), long.get("cache_5m"), long.get("cache_1h")]
    if not vals:
        vals, params = ["(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)"], []
    sql = ("price(model, context, long_above, p_in, p_out, p_cr, p_5m, p_1h, l_in, l_out, l_cr, l_5m, l_1h) AS "
           f"(SELECT * FROM (VALUES {','.join(vals)}))")
    return sql, params


def requests_cte(pcte, where):
    """Requests with their session's project, total tokens and estimated cost (NULL when the model is unpriced)."""
    return f"""WITH {pcte}, rq AS (
        SELECT r.*, s.project, r.input + r.output + r.cache_read + r.cache_5m + r.cache_1h AS tokens,
          CASE WHEN p.model IS NULL THEN NULL
               WHEN p.long_above IS NOT NULL AND r.input + r.cache_read + r.cache_5m + r.cache_1h > p.long_above
               THEN (r.input * p.l_in + r.output * p.l_out + r.cache_read * p.l_cr + r.cache_5m * p.l_5m + r.cache_1h * p.l_1h) / 1e6
               ELSE (r.input * p.p_in + r.output * p.p_out + r.cache_read * p.p_cr + r.cache_5m * p.p_5m + r.cache_1h * p.p_1h) / 1e6 END AS cost
        FROM requests r JOIN sessions s USING (session_id) LEFT JOIN price p ON p.model = r.model
        WHERE {where})"""


def scope(project, automated):
    """The project part of every usage filter, over sessions s: the project matches ('' is all of them), and sessions of
    AUTOMATED_PROJECTS are left out unless automated or the filter names that project. Returns (sql, params)."""
    marks = ",".join("?" * len(AUTOMATED_PROJECTS))
    return (f"(? = '' OR s.project = ?) AND (? OR s.project = ? OR coalesce(s.project, '') NOT IN ({marks}))",
            [project, project, bool(automated), project, *AUTOMATED_PROJECTS])


def view(project, range_days, prices, today, automated=False):
    """The filter shared by every usage query: a row belongs to the view when its session is in scope() and its time is in range."""
    if range_days < 0:
        raise ValueError("range must be >= 0")
    start = today - timedelta(days=range_days - 1) if range_days else None
    pcte, pparams = price_cte(prices)
    sql, sp = scope(project, automated)
    sel = sql + " AND (CAST(? AS DATE) IS NULL OR {ts} >= CAST(? AS DATE))"
    fp = sp + [start, start]
    W = lambda ts: sel.format(ts=ts)
    return start, pcte, pparams, fp, W, requests_cte(pcte, W("r.ts")), pparams + fp


def usage(cur, project="", range_days=0, session="", prices=None, today=None, automated=False):
    prices = load_prices() if prices is None else prices
    today = today or date.today()
    start, pcte, pparams, fp, W, rq, rp = view(project, range_days, prices, today, automated)
    sums = ", ".join(f"coalesce(sum({k}), 0) AS {k}" for k in TOKEN_KINDS)

    daily = rows(cur, f"{rq} SELECT strftime(ts, '%Y-%m-%d') AS day, {sums}, sum(cost) AS cost, "
                      f"count(*) FILTER (WHERE cost IS NULL) AS unpriced FROM rq GROUP BY 1 ORDER BY 1", rp)
    # The same days split by project, for the stacked cost chart.
    daily_projects = rows(cur, f"{rq} SELECT strftime(ts, '%Y-%m-%d') AS day, project, sum(cost) AS cost, sum(tokens) AS tokens "
                               f"FROM rq GROUP BY 1, 2 ORDER BY 1, 2", rp)
    tot = rows(cur, f"""{rq} SELECT {sums}, coalesce(sum(tokens), 0) AS tokens, sum(cost) AS cost,
        count(*) AS requests, count(*) FILTER (WHERE NOT subagent) AS main_requests,
        coalesce(sum(tokens) FILTER (WHERE subagent), 0) AS sub_tokens, sum(cost) FILTER (WHERE subagent) AS sub_cost,
        coalesce(sum(thinking_ms), 0) AS thinking_ms, count(DISTINCT CAST(ts AS DATE)) AS active_days FROM rq""", rp)[0]
    unpriced = rows(cur, f"{rq} SELECT model, count(*) AS requests, sum(tokens) AS tokens FROM rq WHERE cost IS NULL GROUP BY 1 ORDER BY 3 DESC", rp)
    models = rows(cur, f"""{rq} SELECT model, coalesce(effort, '(none)') AS effort, count(*) AS requests, sum(tokens) AS tokens,
        sum(cost) AS cost FROM rq GROUP BY 1, 2 ORDER BY requests DESC""", rp)

    tc = f"tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')}"
    calls = rows(cur, f"""SELECT count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
        count(*) FILTER (WHERE is_commit AND test_passed) AS commits,
        count(*) FILTER (WHERE is_test AND end_ts IS NOT NULL) AS test_runs,
        count(*) FILTER (WHERE is_test AND test_passed) AS tests_passed,
        count(*) FILTER (WHERE is_test AND NOT test_passed) AS tests_failed,
        count(*) FILTER (WHERE NOT t.subagent) AS main_calls FROM {tc}""", fp)[0]
    tools = rows(cur, f"""SELECT tool, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
        quantile_cont(date_diff('millisecond', start_ts, end_ts), 0.5) AS p50_ms,
        quantile_cont(date_diff('millisecond', start_ts, end_ts), 0.95) AS p95_ms
        FROM {tc} GROUP BY 1 ORDER BY calls DESC""", fp)
    mcp = rows(cur, f"SELECT mcp_server AS name, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors "
                    f"FROM {tc} AND mcp_server IS NOT NULL GROUP BY 1 ORDER BY calls DESC", fp)
    skills = rows(cur, f"SELECT skill AS name, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors "
                       f"FROM {tc} AND skill IS NOT NULL GROUP BY 1 ORDER BY calls DESC", fp)
    hooks = rows(cur, f"""SELECT coalesce(h.command, h.hook) AS name, h.hook AS event, count(*) AS runs,
        count(*) FILTER (WHERE h.is_error) AS errors, avg(h.duration_ms) AS avg_ms
        FROM hooks h JOIN sessions s USING (session_id) WHERE {W('h.ts')} GROUP BY 1, 2 ORDER BY runs DESC""", fp)
    pr = rows(cur, f"""SELECT count(*) AS prompts, count(*) FILTER (WHERE interrupted) AS interrupted
        FROM prompts p JOIN sessions s USING (session_id) WHERE {W('p.ts')}""", fp)[0]
    loops = error_loops(cur, W, fp)
    work = daily_work(cur, rq, rp, W, fp)

    sess = sessions(cur, rq, rp, W, fp, prices)
    sessions_by_id = {x["session_id"]: x for x in sess}
    for lp in loops:
        if lp["session_id"] in sessions_by_id:
            sessions_by_id[lp["session_id"]]["error_loops"] += 1
    by_project = projects(cur, rq, rp, W, fp, loops)

    per = lambda a, b: a / b if b else None
    totals = dict(
        tot, **calls, **pr, error_loops=len(loops), sessions=len(sess),
        cache_hit_ratio=per(tot["cache_read"], tot["input"] + tot["cache_read"] + tot["cache_5m"] + tot["cache_1h"]),
        write_1h_share=per(tot["cache_1h"], tot["cache_5m"] + tot["cache_1h"]),
        subagent_token_share=per(tot["sub_tokens"], tot["tokens"]),
        subagent_cost_share=per(tot["sub_cost"] or 0, tot["cost"]) if tot["cost"] else None,
        tokens_per_prompt=per(tot["tokens"], pr["prompts"]), cost_per_prompt=per(tot["cost"] or 0, pr["prompts"]),
        turns_per_prompt=per(tot["main_requests"], pr["prompts"]), tool_calls_per_prompt=per(calls["main_calls"], pr["prompts"]),
        interruption_rate=per(pr["interrupted"], pr["prompts"]),
        tokens_per_commit=per(tot["tokens"], calls["commits"]), cost_per_commit=per(tot["cost"] or 0, calls["commits"]) if calls["commits"] else None,
        errors_per_100_calls=per(100 * calls["errors"], calls["calls"]),
        session_seconds=sum(x["duration_s"] or 0 for x in sess),
        median_session_seconds=median([x["duration_s"] for x in sess if x["duration_s"] is not None]),
        near_limit=sum(1 for x in sess if x["near_limit"]))
    out = dict(project=project, range=range_days, automated=bool(automated), start=start.isoformat() if start else None, end=today.isoformat(),
               projects=project_list(cur, automated), project_order=project_order(cur), totals=totals, daily=daily, daily_projects=daily_projects,
               daily_work=work, unpriced=unpriced, models=models,
               by_project=by_project, tools=rate_rows(tools), mcp=rate_rows(mcp), skills=rate_rows(skills),
               hooks=rate_rows(hooks, "runs"), error_loops=loops[:50],
               sessions=sorted(sess, key=lambda x: x["first_ts"] or "", reverse=True)[:300],
               top_sessions=with_titles(cur, sorted(sess, key=lambda x: -(x["cost"] or 0))[:50]),
               near_limit=sorted((x for x in sess if x["near_limit"]), key=lambda x: -x["context_share"]),
               previous=previous_period(cur, project, range_days, prices, today, automated))
    out["changes"] = project_changes(by_project, out["previous"])
    if session:
        out["session"] = session_detail(cur, session, requests_cte(pcte, "r.session_id = ?"), pparams + [session], prices)
    return out


def previous_period(cur, project, range_days, prices, today, automated=False):
    """The equal-length period just before the view (same scope()), for the headline comparison and its sparkline.
    None for the all-time view, which has nothing before it."""
    if not range_days:
        return None
    end = today - timedelta(days=range_days)  # last day of the previous period
    start = end - timedelta(days=range_days - 1)
    pcte, pparams = price_cte(prices)
    sql, sp = scope(project, automated)
    rq = requests_cte(pcte, f"{sql} AND r.ts >= CAST(? AS DATE) AND r.ts < CAST(? AS DATE) + INTERVAL 1 DAY")
    p = pparams + sp + [start, end]
    tot = rows(cur, f"""{rq} SELECT coalesce(sum(tokens), 0) AS tokens, sum(cost) AS cost, count(*) AS requests,
        count(DISTINCT session_id) AS sessions, count(DISTINCT CAST(ts AS DATE)) AS active_days FROM rq""", p)[0]
    daily = rows(cur, f"{rq} SELECT strftime(ts, '%Y-%m-%d') AS day, sum(cost) AS cost, sum(tokens) AS tokens FROM rq GROUP BY 1 ORDER BY 1", p)
    by_project = rows(cur, f"{rq} SELECT project, sum(cost) AS cost, sum(tokens) AS tokens, count(*) AS requests FROM rq GROUP BY 1", p)
    return dict(tot, start=start.isoformat(), end=end.isoformat(), daily=daily, by_project=by_project)


def project_changes(by_project, previous):
    """Each project's estimated-cost change against the previous period, biggest move first, for the "what changed" chart.
    new: the project had no requests at all in the previous period. Projects active only before the view count too (cost 0 now).
    None for the all-time view."""
    if previous is None:
        return None
    now = {r["project"]: r for r in by_project}
    before = {r["project"]: r for r in previous["by_project"]}
    out = []
    for name in now.keys() | before.keys():
        c, b = (now.get(name) or {}).get("cost") or 0, (before.get(name) or {}).get("cost") or 0
        out.append(dict(project=name, cost=c, prev_cost=b, delta=c - b, new=name not in before))
    return sorted(out, key=lambda r: (-abs(r["delta"]), r["project"] or ""))


def session_list(cur, project="", range_days=0, q="", near=False, offset=0, limit=100, prices=None, today=None, day="", automated=False):
    """One page of the view's sessions, newest first (or nearest the context limit first), matching q on id, project or branch.
    day (YYYY-MM-DD): only sessions with requests on that day."""
    prices = load_prices() if prices is None else prices
    _, _, _, fp, W, rq, rp = view(project, range_days, prices, today or date.today(), automated)
    sess = sessions(cur, rq, rp, W, fp, prices)
    q = q.strip().lower()
    on_day = {r[0] for r in cur.execute("SELECT DISTINCT session_id FROM requests WHERE CAST(ts AS DATE) = ?",
                                        [date.fromisoformat(day)]).fetchall()} if day else None
    hits = [x for x in sess if (not near or x["near_limit"]) and (on_day is None or x["session_id"] in on_day)
            and (not q or q in f"{x['session_id']} {x['project']} {x['git_branch'] or ''}".lower())]
    hits.sort(key=(lambda x: -x["context_share"]) if near else (lambda x: x["first_ts"] or ""), reverse=not near)
    return dict(total=len(hits), offset=offset, sessions=with_titles(cur, hits[offset:offset + limit]))


def median(xs):
    xs = sorted(xs)
    if not xs:
        return None
    m = len(xs) // 2
    return xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2


def rate_rows(rs, n="calls"):
    for r in rs:
        r["failure_rate"] = r["errors"] / r[n] if r[n] else None
    return rs


def project_list(cur, automated=False):
    sql, sp = scope("", automated)
    return [r[0] for r in cur.execute(f"SELECT project FROM sessions s WHERE project IS NOT NULL AND {sql} GROUP BY 1 ORDER BY count(*) DESC",
                                      sp).fetchall()]


def project_order(cur):
    """Projects by all-time tokens, busiest first. Both pages hand out project colors in this order, so it ignores every filter,
    except that automated projects are always left out: they never take a project color."""
    sql, sp = scope("", False)
    return [r[0] for r in cur.execute(f"""SELECT s.project FROM requests r JOIN sessions s USING (session_id) WHERE s.project IS NOT NULL
        AND {sql} GROUP BY 1 ORDER BY sum(r.input + r.output + r.cache_read + r.cache_5m + r.cache_1h) DESC, 1""", sp).fetchall()]


def daily_work(cur, rq, rp, W, fp):
    """Work per day in the view: sessions with a request that day, prompts, commits (as in totals) and failed calls.
    A session active on two days counts on both. Days with none of these are left out."""
    days = {}
    for got in (rows(cur, f"{rq} SELECT strftime(ts, '%Y-%m-%d') AS day, count(DISTINCT session_id) AS sessions FROM rq GROUP BY 1", rp),
                rows(cur, f"""SELECT strftime(p.ts, '%Y-%m-%d') AS day, count(*) AS prompts
                    FROM prompts p JOIN sessions s USING (session_id) WHERE {W('p.ts')} GROUP BY 1""", fp),
                rows(cur, f"""SELECT strftime(coalesce(t.start_ts, t.end_ts), '%Y-%m-%d') AS day,
                    count(*) FILTER (WHERE is_commit AND test_passed) AS commits, count(*) FILTER (WHERE is_error) AS failed_calls
                    FROM tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')} GROUP BY 1""", fp)):
        for r in got:
            if r["day"]:
                days.setdefault(r["day"], dict(day=r["day"], sessions=0, prompts=0, commits=0, failed_calls=0)).update(r)
    return [days[d] for d in sorted(days)]


def error_loops(cur, W, fp):
    """Runs of three or more consecutive failed calls of the same tool in one session, ordered by start time."""
    return rows(cur, f"""
        WITH c AS (
          SELECT t.session_id, t.tool, t.is_error, t.tool_use_id, t.start_ts, s.project,
                 row_number() OVER w - row_number() OVER (PARTITION BY t.session_id, t.tool, t.is_error ORDER BY t.start_ts, t.tool_use_id) AS grp
          FROM tool_calls t JOIN sessions s USING (session_id)
          WHERE t.start_ts IS NOT NULL AND {W('t.start_ts')}
          WINDOW w AS (PARTITION BY t.session_id ORDER BY t.start_ts, t.tool_use_id))
        SELECT session_id, project, tool, count(*) AS failures, arg_min(tool_use_id, start_ts) AS first_id, min(start_ts) AS start_ts
        FROM c WHERE is_error GROUP BY session_id, project, tool, grp HAVING count(*) >= 3 ORDER BY start_ts DESC""", fp)


def sessions(cur, rq, rp, W, fp, prices):
    """Sessions with requests in the view; every count is limited to the view's range."""
    rs = rows(cur, f"""{rq}, agg AS (
          SELECT session_id, count(*) AS requests, sum(tokens) AS tokens, sum(cost) AS cost,
                 count(*) FILTER (WHERE cost IS NULL) AS unpriced, coalesce(sum(thinking_ms), 0) AS thinking_ms
          FROM rq GROUP BY 1),
        tc AS (SELECT session_id, count(*) AS tool_calls, count(*) FILTER (WHERE is_error) AS errors,
                 count(*) FILTER (WHERE is_commit AND test_passed) AS commits,
                 count(*) FILTER (WHERE is_test AND test_passed) AS tests_passed,
                 count(*) FILTER (WHERE is_test AND NOT test_passed) AS tests_failed
               FROM tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')} GROUP BY 1),
        pr AS (SELECT session_id, count(*) AS prompts, count(*) FILTER (WHERE interrupted) AS interrupted
               FROM prompts p JOIN sessions s USING (session_id) WHERE {W('p.ts')} GROUP BY 1)
        SELECT s.session_id, s.project, s.git_branch, s.first_ts, s.last_ts, date_diff('second', s.first_ts, s.last_ts) AS duration_s,
               s.compactions, s.peak_context, s.peak_model, agg.requests, agg.tokens, agg.cost, agg.unpriced, agg.thinking_ms,
               coalesce(tc.tool_calls, 0) AS tool_calls, coalesce(tc.errors, 0) AS errors, coalesce(tc.commits, 0) AS commits,
               coalesce(tc.tests_passed, 0) AS tests_passed, coalesce(tc.tests_failed, 0) AS tests_failed,
               coalesce(pr.prompts, 0) AS prompts, coalesce(pr.interrupted, 0) AS interrupted
        FROM agg JOIN sessions s USING (session_id) LEFT JOIN tc USING (session_id) LEFT JOIN pr USING (session_id)""", rp + fp + fp)
    for r in rs:
        limit = (prices.get(r["peak_model"]) or {}).get("context")
        r["context_limit"] = limit
        r["context_share"] = r["peak_context"] / limit if limit and r["peak_context"] else None
        r["near_limit"] = bool(r["context_share"] and r["context_share"] >= NEAR_LIMIT)
        r["tokens_per_prompt"] = r["tokens"] / r["prompts"] if r["prompts"] else None
        r["error_loops"] = 0
        r["first_ts"], r["last_ts"] = iso(r["first_ts"]), iso(r["last_ts"])
    return rs


def projects(cur, rq, rp, W, fp, loops):
    rs = rows(cur, f"""{rq}, agg AS (
          SELECT project, count(DISTINCT session_id) AS sessions, sum(tokens) AS tokens, sum(cost) AS cost,
                 count(*) FILTER (WHERE cost IS NULL) AS unpriced, sum(cache_read) AS cache_read,
                 sum(input + cache_read + cache_5m + cache_1h) AS prompt_tokens, sum(cache_1h) AS cache_1h,
                 sum(cache_5m + cache_1h) AS cache_writes, sum(tokens) FILTER (WHERE subagent) AS sub_tokens,
                 sum(cost) FILTER (WHERE subagent) AS sub_cost
          FROM rq GROUP BY 1)
        SELECT * FROM agg ORDER BY coalesce(cost, 0) DESC, tokens DESC""", rp)
    calls = {r["project"]: r for r in rows(cur, f"""SELECT s.project, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
        count(*) FILTER (WHERE is_commit AND test_passed) AS commits FROM tool_calls t JOIN sessions s USING (session_id)
        WHERE {W('coalesce(t.start_ts, t.end_ts)')} GROUP BY 1""", fp)}
    prompts = dict(cur.execute(f"""SELECT s.project, count(*) FROM prompts p JOIN sessions s USING (session_id)
        WHERE {W('p.ts')} GROUP BY 1""", fp).fetchall())
    nloops = {}
    for lp in loops:
        nloops[lp["project"]] = nloops.get(lp["project"], 0) + 1
    per = lambda a, b: a / b if b else None
    for r in rs:
        c = calls.get(r["project"], dict(calls=0, errors=0, commits=0))
        r.update(calls=c["calls"], errors=c["errors"], commits=c["commits"], prompts=prompts.get(r["project"], 0),
                 error_loops=nloops.get(r["project"], 0),
                 cache_hit_ratio=per(r["cache_read"], r["prompt_tokens"]), write_1h_share=per(r["cache_1h"], r["cache_writes"]),
                 subagent_share=per(r["sub_tokens"] or 0, r["tokens"]),
                 subagent_cost_share=per(r["sub_cost"] or 0, r["cost"]) if r["cost"] else None,
                 tokens_per_commit=per(r["tokens"], c["commits"]), cost_per_commit=per(r["cost"] or 0, c["commits"]) if c["commits"] else None,
                 errors_per_100_calls=per(100 * c["errors"], c["calls"]), tokens_per_prompt=per(r["tokens"], prompts.get(r["project"], 0)))
    return rs


def session(cur, sid, prices=None):
    """One session's drill-in on its own, for the session sheet."""
    prices = load_prices() if prices is None else prices
    pcte, pparams = price_cte(prices)
    return session_detail(cur, sid, requests_cte(pcte, "r.session_id = ?"), pparams + [sid], prices)


def session_detail(cur, sid, allq, p, prices):
    """The drill-in ignores the page filters: it shows the whole session."""
    info = rows(cur, "SELECT * FROM sessions WHERE session_id = ?", [sid])
    if not info:
        return None
    info = info[0]
    info["first_ts"], info["last_ts"] = iso(info["first_ts"]), iso(info["last_ts"])
    info["context_limit"] = (prices.get(info["peak_model"]) or {}).get("context")
    sums = ", ".join(f"sum({k}) AS {k}" for k in TOKEN_KINDS)
    return dict(
        info=info,
        models=rows(cur, f"{allq} SELECT model, coalesce(effort, '(none)') AS effort, subagent, count(*) AS requests, {sums}, "
                         f"sum(tokens) AS tokens, sum(cost) AS cost FROM rq GROUP BY 1, 2, 3 ORDER BY tokens DESC", p),
        timeline=rows(cur, f"{allq} SELECT strftime(date_trunc('minute', ts), '%Y-%m-%dT%H:%M:00Z') AS minute, "
                           f"sum(tokens) AS tokens, sum(cost) AS cost, max(input + cache_read + cache_5m + cache_1h) AS context "
                           f"FROM rq GROUP BY 1 ORDER BY 1", p),
        tools=rate_rows(rows(cur, """SELECT tool, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
            quantile_cont(date_diff('millisecond', start_ts, end_ts), 0.5) AS p50_ms FROM tool_calls WHERE session_id = ?
            GROUP BY 1 ORDER BY calls DESC""", [sid])),
        commits=rows(cur, """SELECT tool_use_id, start_ts, left(input_summary, 200) AS command FROM tool_calls
            WHERE session_id = ? AND is_commit AND test_passed ORDER BY start_ts""", [sid]),
        prompts=rows(cur, "SELECT count(*) AS prompts, count(*) FILTER (WHERE interrupted) AS interrupted FROM prompts WHERE session_id = ?", [sid])[0],
        error_loops=error_loops(cur, lambda ts: "t.session_id = ?", [sid]),
        **session_timeline(cur, sid, allq, p))


TIMELINE_CAP = 5000  # rows per series in the session timeline; longer sessions keep their first rows
FIRST_PROMPT_CAP = 600


def session_timeline(cur, sid, allq, p):
    """Per-request and per-tool-call rows for the session sheet's timeline, plus compaction times and the first prompt.
    context: the prompt size of each request (input plus cache), the same measure as sessions.peak_context."""
    reqs = rows(cur, f"""{allq} SELECT ts, model, subagent, input + cache_read + cache_5m + cache_1h AS context, output, cost
        FROM rq ORDER BY ts, message_id LIMIT {TIMELINE_CAP}""", p)
    calls = rows(cur, f"""SELECT tool_use_id AS id, tool, start_ts, end_ts, is_error, category, subagent,
        is_commit AND coalesce(test_passed, false) AS is_commit
        FROM tool_calls WHERE session_id = ? AND coalesce(start_ts, end_ts) IS NOT NULL
        ORDER BY coalesce(start_ts, end_ts), tool_use_id LIMIT {TIMELINE_CAP}""", [sid])
    for r in reqs:
        r["ts"] = iso(r["ts"])
    for c in calls:
        c["start_ts"], c["end_ts"] = iso(c["start_ts"]), iso(c["end_ts"])
    compactions = [r[0] for r in cur.execute("""SELECT ts FROM raw_lines WHERE session_id = ? AND type = 'system'
        AND json LIKE '%"compact_boundary"%' ORDER BY ts""", [sid]).fetchall()]
    full = first_prompts(cur, [sid]).get(sid)
    return dict(requests=reqs, calls=calls, compaction_ts=compactions, first_prompt=cap_prompt(full),
                first_prompt_cut=bool(full and len(full) > FIRST_PROMPT_CAP), title=prompt_title(full),
                truncated=len(reqs) >= TIMELINE_CAP or len(calls) >= TIMELINE_CAP)


def first_prompts(cur, sids):
    """{session_id: full text of its first human prompt} (the earliest row in prompts), for the sessions that have one stored."""
    if not sids:
        return {}
    found = {}
    for sid, pid, line in cur.execute("""
            WITH fp AS (SELECT session_id, arg_min(prompt_id, ts) AS pid FROM prompts WHERE list_contains(?, session_id) GROUP BY 1)
            SELECT r.session_id, fp.pid, r.json FROM raw_lines r JOIN fp USING (session_id)
            WHERE r.type = 'user' AND contains(r.json, fp.pid)
            QUALIFY row_number() OVER (PARTITION BY r.session_id ORDER BY r.ts) <= 20
            ORDER BY r.session_id, r.ts""", [list(sids)]).fetchall():
        if sid in found:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("promptId") != pid or d.get("isMeta"):
            continue
        content = (d.get("message") or {}).get("content")
        text = content if isinstance(content, str) else "\n".join(
            x.get("text") or "" for x in content if isinstance(x, dict) and x.get("type") == "text") if isinstance(content, list) else ""
        if text.strip():
            found[sid] = text.strip()
    return found


def cap_prompt(text, cap=FIRST_PROMPT_CAP):
    return None if text is None else text[:cap] + ("…" if len(text) > cap else "")


def first_prompt(cur, sid, cap=FIRST_PROMPT_CAP):
    """The text of the session's first human prompt, cut to cap characters (None: the whole text), or None."""
    text = first_prompts(cur, [sid]).get(sid)
    return text if cap is None else cap_prompt(text, cap)


TITLE_LEN = 80
# Claude Code wraps slash commands and injected context in hyphenated tags: <command-name>, <command-args>, <system-reminder>, ...
CMD_TAG = lambda tag: re.compile(rf"<{tag}>\s*(.*?)\s*</{tag}>", re.S)
WRAPPER_BLOCK = re.compile(r"<([a-z]+(?:-[a-z]+)+)>.*?</\1>", re.S)
WRAPPER_TAG = re.compile(r"</?[a-z]+(?:-[a-z]+)+>")


def prompt_title(text, n=TITLE_LEN):
    """A short readable name for a session from its first prompt: "/ship add tests" for a slash command (its tags stripped),
    else the first sentence of the first line, cut to n characters. None when nothing readable is left."""
    if not text:
        return None
    name, msg, args = (CMD_TAG(t).search(text) for t in ("command-name", "command-message", "command-args"))
    if name or msg:
        cmd = name.group(1).strip() if name else (msg.group(1).split() or [""])[0]
        title = ("" if cmd.startswith("/") else "/") + cmd + (" " + args.group(1) if args and args.group(1).strip() else "")
    else:
        body = WRAPPER_TAG.sub(" ", WRAPPER_BLOCK.sub(" ", text))
        line = next((ln.strip() for ln in body.splitlines() if ln.strip()), "")
        line = re.sub(r"^[#>*\-\s]+", "", line)
        m = re.search(r"[.!?](?=\s|$)", line)
        title = line[:m.end()] if m and m.end() > 12 else line
    title = " ".join(title.split())
    if not title:
        return None
    return title if len(title) <= n else title[:n - 1].rstrip() + "…"


def with_titles(cur, sess):
    """Adds title (from the first prompt, see prompt_title) to each session row; returns the rows."""
    texts = first_prompts(cur, [x["session_id"] for x in sess])
    for x in sess:
        x["title"] = prompt_title(texts.get(x["session_id"]))
    return sess
