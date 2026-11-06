"""Queries behind the dashboards: the errors payload and the usage metrics. SQL over the derived tables."""
import json
import os
from datetime import date, timedelta

from categorize import RULES

HERE = os.path.dirname(os.path.abspath(__file__))
NEAR_LIMIT = 0.8  # share of the context window that counts as "near the limit"
TOKEN_KINDS = ["input", "output", "thinking", "cache_read", "cache_5m", "cache_1h"]


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
    """The JSON shape dashboard_template.html has always read. today anchors its ranges, as in usage()."""
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
    calls = cur.execute("""
        SELECT strftime(t.start_ts, '%Y-%m-%d') AS d, coalesce(s.project, '(unknown)') AS p, count(*),
               count(*) FILTER (WHERE t.subagent)
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.start_ts IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()
    return dict(generated=last_ingest, today=(today or date.today()).isoformat(), categories=[{k: r[k] for k in ("id", "label", "why", "fix", "snippet")} for r in RULES],
                errors=errs, calls=[list(c) for c in calls])


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


def view(project, range_days, prices, today):
    """The filter shared by every usage query: a row belongs to the view when its session's project matches and its time is in range."""
    if range_days < 0:
        raise ValueError("range must be >= 0")
    start = today - timedelta(days=range_days - 1) if range_days else None
    pcte, pparams = price_cte(prices)
    sel = "(? = '' OR s.project = ?) AND (CAST(? AS DATE) IS NULL OR {ts} >= CAST(? AS DATE))"
    fp = [project, project, start, start]
    W = lambda ts: sel.format(ts=ts)
    return start, pcte, pparams, fp, W, requests_cte(pcte, W("r.ts")), pparams + fp


def usage(cur, project="", range_days=0, session="", prices=None, today=None):
    prices = load_prices() if prices is None else prices
    today = today or date.today()
    start, pcte, pparams, fp, W, rq, rp = view(project, range_days, prices, today)
    sums = ", ".join(f"coalesce(sum({k}), 0) AS {k}" for k in TOKEN_KINDS)

    daily = rows(cur, f"{rq} SELECT strftime(ts, '%Y-%m-%d') AS day, {sums}, sum(cost) AS cost, "
                      f"count(*) FILTER (WHERE cost IS NULL) AS unpriced FROM rq GROUP BY 1 ORDER BY 1", rp)
    tot = rows(cur, f"""{rq} SELECT {sums}, coalesce(sum(tokens), 0) AS tokens, sum(cost) AS cost,
        count(*) AS requests, count(*) FILTER (WHERE NOT subagent) AS main_requests,
        coalesce(sum(tokens) FILTER (WHERE subagent), 0) AS sub_tokens, sum(cost) FILTER (WHERE subagent) AS sub_cost,
        coalesce(sum(thinking_ms), 0) AS thinking_ms FROM rq""", rp)[0]
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
    out = dict(project=project, range=range_days, start=start.isoformat() if start else None, end=today.isoformat(),
               projects=project_list(cur), totals=totals, daily=daily, unpriced=unpriced, models=models,
               by_project=by_project, tools=rate_rows(tools), mcp=rate_rows(mcp), skills=rate_rows(skills),
               hooks=rate_rows(hooks, "runs"), error_loops=loops[:50],
               sessions=sorted(sess, key=lambda x: x["first_ts"] or "", reverse=True)[:300],
               top_sessions=sorted(sess, key=lambda x: -(x["cost"] or 0))[:50],
               near_limit=sorted((x for x in sess if x["near_limit"]), key=lambda x: -x["context_share"]))
    if session:
        out["session"] = session_detail(cur, session, requests_cte(pcte, "r.session_id = ?"), pparams + [session], prices)
    return out


def session_list(cur, project="", range_days=0, q="", near=False, offset=0, limit=100, prices=None, today=None):
    """One page of the view's sessions, newest first (or nearest the context limit first), matching q on id, project or branch."""
    prices = load_prices() if prices is None else prices
    _, _, _, fp, W, rq, rp = view(project, range_days, prices, today or date.today())
    sess = sessions(cur, rq, rp, W, fp, prices)
    q = q.strip().lower()
    hits = [x for x in sess if (not near or x["near_limit"])
            and (not q or q in f"{x['session_id']} {x['project']} {x['git_branch'] or ''}".lower())]
    hits.sort(key=(lambda x: -x["context_share"]) if near else (lambda x: x["first_ts"] or ""), reverse=not near)
    return dict(total=len(hits), offset=offset, sessions=hits[offset:offset + limit])


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


def project_list(cur):
    return [r[0] for r in cur.execute("SELECT project FROM sessions WHERE project IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC").fetchall()]


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
                 sum(cache_5m + cache_1h) AS cache_writes, sum(tokens) FILTER (WHERE subagent) AS sub_tokens
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
        error_loops=error_loops(cur, lambda ts: "t.session_id = ?", [sid]))
