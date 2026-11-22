"""Queries behind the dashboards: the errors payload and the usage metrics. SQL over the derived tables."""
import json
import math
import os
from datetime import date, timedelta

from . import store, titles
from .categorize import RULES, SHELL_TOOLS, input_pattern

HERE = os.path.dirname(os.path.abspath(__file__))
NEAR_LIMIT = 0.8  # share of the context window that counts as "near the limit"
TOKEN_KINDS = ["input", "output", "thinking", "cache_read", "cache_5m", "cache_1h"]
AUTOMATED_PROJECTS = ("observer-sessions",)  # projects whose sessions a tool starts, left out of usage unless asked for
TEMP_PROJECT = "(temp)"  # store.project_of's name for a temporary folder, where apps run their one-prompt helpers
# Sessions a tool started, in any project: no prompt at all, or at most one in a temporary folder (titles and other helpers
# an app runs). Counts the whole session's prompts, so a session is automated or not whatever the range.
HELPER_SESSIONS = f"""SELECT a.session_id FROM sessions a LEFT JOIN prompts ap USING (session_id) GROUP BY a.session_id, a.project
    HAVING count(ap.prompt_id) < CASE WHEN a.project = '{TEMP_PROJECT}' THEN 2 ELSE 1 END"""
SOURCES = ("claude", "codex", "grok")  # the coding agents a session can come from (sessions.source); '' in a filter is all of them


PRICE_KINDS = ("input", "output", "cache_read", "cache_5m", "cache_1h")  # USD per million tokens, every price entry has each
# The user's prices file: the packaged prices.json's shape, its models added to or replacing the packaged ones. It sits next
# to the store; the app points it at the --db folder.
USER_PRICES = os.path.join(store.data_dir(), "prices.json")


def load_prices(path=os.path.join(HERE, "prices.json"), user=None):
    """Prices per model: the packaged file's, with the user prices file's (user, default USER_PRICES) over them. A missing,
    unreadable or malformed user file adds nothing (prices_file says why)."""
    with open(path) as fh:
        return json.load(fh)["models"] | user_prices(user)[0]


def load_plans(path=os.path.join(HERE, "prices.json"), user=None):
    """Subscription plans, {provider: {plan: {label, monthly}}}: the packaged file's, with the user prices file's over them."""
    with open(path) as fh:
        packaged = json.load(fh)["plans"]
    mine = read_user_prices(user)[1]
    return {p: packaged.get(p, {}) | mine.get(p, {}) for p in packaged.keys() | mine.keys()}


def user_prices(path=None):
    """(models, error) from the user prices file: ({}, None) when there is none; ({}, a message) when it cannot be read or
    an entry lacks a price, so a bad edit is reported and ignored instead of breaking every page."""
    models, _, error = read_user_prices(path)
    return models, error


def read_user_prices(path=None):
    """(models, plans, error) from the user prices file; a file with any bad entry gives ({}, {}, a message), so it is ignored whole."""
    try:
        with open(path or USER_PRICES) as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return {}, {}, None
    except (OSError, ValueError) as e:  # JSONDecodeError is a ValueError
        return {}, {}, str(e)
    if not isinstance(data, dict) or not (isinstance(data.get("models"), dict) or isinstance(data.get("plans"), dict)):
        return {}, {}, 'no "models" object'
    models, plans = data.get("models", {}), data.get("plans", {})
    if not isinstance(models, dict) or not isinstance(plans, dict):
        return {}, {}, '"models" and "plans" must be objects'
    number = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)  # 1e309 parses to inf, which is not JSON
    for model, p in models.items():
        ok = isinstance(p, dict)
        tiers = [("", p)] + ([("", p.get("long"))] if ok and p.get("long_above") is not None else []) \
            + ([("fast.", p["fast"])] if ok and p.get("fast") is not None else [])
        bad = [f"{pre}{k}" for pre, t in tiers for k in PRICE_KINDS if not isinstance(t, dict) or not number(t.get(k))]
        bad += [k for k in ("context", "long_above") if isinstance(p, dict) and p.get(k) is not None and not number(p[k])]
        if bad:
            return {}, {}, f"{model}: {', '.join(dict.fromkeys(bad))} must be a number"
    for provider, by_plan in plans.items():
        if not isinstance(by_plan, dict):
            return {}, {}, f"plans.{provider} must be an object"
        for plan, p in by_plan.items():
            if not isinstance(p, dict) or not number(p.get("monthly")) or not isinstance(p.get("label"), str):
                return {}, {}, f"plans.{provider}.{plan}: needs a label (text) and a monthly price (number)"
    return {m: dict(p, context=p.get("context")) for m, p in models.items()}, plans, None


def plan_for(plans, provider, plan):
    """The plan entry for a snapshot's plan string ("max/default_claude_max_20x"): an exact match, else its part before the "/"."""
    by_plan = plans.get(provider, {})
    return by_plan.get(plan) or by_plan.get(plan.split("/")[0])


def view_plans(cur, source=""):
    """The plans that apply to a view: each provider's newest plan on a limit snapshot (only the source's when one is chosen)
    that the plan prices know. [{provider, label, monthly}]; none when no snapshot names a known plan."""
    seen = rows(cur, "SELECT provider, arg_max(plan, observed_at) AS plan FROM limit_snapshots WHERE coalesce(plan, '') <> '' "
                     "AND (? = '' OR provider = ?) GROUP BY provider ORDER BY provider", [source, source])
    plans = load_plans()
    found = [(r["provider"], plan_for(plans, r["provider"], r["plan"])) for r in seen]
    return [dict(provider=p, label=e["label"], monthly=e["monthly"]) for p, e in found if e]


def prices_file():
    """Where the user prices file is and why it was ignored (error is None when it was read, or there is none)."""
    return dict(path=USER_PRICES, error=user_prices()[1])


# The user's automated projects file, {"projects": [name, ...]}: projects whose sessions count as automated beside
# AUTOMATED_PROJECTS. It sits next to the store, like USER_PRICES, and is read on every request.
USER_AUTOMATED = os.path.join(store.data_dir(), "automated.json")


def user_automated(path=None):
    """(projects, error) from the user automated file: ([], None) when there is none; ([], a message) when it cannot be
    read or is malformed, so a bad edit is reported and ignored."""
    try:
        with open(path or USER_AUTOMATED) as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return [], None
    except (OSError, ValueError) as e:
        return [], str(e)
    projects = data.get("projects") if isinstance(data, dict) else None
    if not isinstance(projects, list):
        return [], 'no "projects" list'
    if not all(isinstance(p, str) for p in projects):
        return [], "projects must be strings"
    return projects, None


def automated_file():
    """Where the user automated file is, why it was ignored (None when read or absent) and the projects it adds."""
    projects, error = user_automated()
    return dict(path=USER_AUTOMATED, error=error, projects=projects)


def rows(cur, sql, params=()):
    cur.execute(sql, list(params))
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def iso(ts):
    return ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z" if ts else None


# Stored timestamps are naive UTC. A day is a calendar day in the connection's TimeZone (DuckDB's ICU zone, the system's
# unless set), DST included, so the server buckets and bounds days on the user's own clock. Every day goes through these.
def day(ts):
    """SQL: the local day ('YYYY-MM-DD') of the stored timestamp ts."""
    return f"strftime(CAST(timezone('UTC', {ts}) AS DATE), '%Y-%m-%d')"


def week(ts):
    """SQL: the local day ('YYYY-MM-DD') of the Monday that starts the week of the stored timestamp ts."""
    return f"strftime(date_trunc('week', CAST(timezone('UTC', {ts}) AS DATE)), '%Y-%m-%d')"


def day_start(d):
    """SQL: the stored (naive UTC) timestamp at which the local day d, a DATE expression, starts."""
    return f"timezone('UTC', CAST({d} AS TIMESTAMPTZ))"


def local_today(cur):
    """The local date in the connection's zone, the end of every range."""
    return cur.execute("SELECT current_date").fetchone()[0]


def latency(t=""):
    """SQL: a tool call's duration in ms, from the columns of table alias t (e.g. "t."). NULL when the source gave no
    usable timing: the call does not start before it ends (Codex records some calls with no duration)."""
    return f"CASE WHEN {t}end_ts > {t}start_ts THEN date_diff('millisecond', {t}start_ts, {t}end_ts) END"


def start_ts(cur, d):
    """The stored (naive UTC) timestamp at which the local date d starts; None for None."""
    return cur.execute(f"SELECT {day_start('CAST(? AS DATE)')}", [d]).fetchone()[0] if d else None


# ---------- errors dashboard ----------

def error_fixes(cur):
    """The fix markers the user set on the Errors page: {error type: "YYYY-MM-DD"}."""
    return {c: d.isoformat() for c, d in cur.execute("SELECT category, fixed_on FROM error_marks WHERE fixed_on IS NOT NULL ORDER BY 1").fetchall()}


def error_muted(cur):
    """The error types the user muted on the Errors page, sorted."""
    return [c for (c,) in cur.execute("SELECT category FROM error_marks WHERE muted ORDER BY 1").fetchall()]


def error_marks(cur):
    """What the user told the Errors page, the one shape every marks endpoint answers: {fixes: {type: day}, muted: [type]}."""
    return dict(fixes=error_fixes(cur), muted=error_muted(cur))


def errors_payload(cur, last_ingest=None, today=None):
    """The JSON shape the Errors page reads (the same shape the old static page read). today anchors its ranges, as in usage()."""
    errs = rows(cur, f"""
        SELECT t.tool_use_id AS id, t.end_ts AS ts, {day('t.end_ts')} AS d, coalesce(s.project, '(unknown)') AS p, t.session_id AS s,
               t.tool AS t, t.category AS c, left(t.input_summary, 400) AS i, t.error AS e, coalesce(t.followup, '') AS r,
               CASE WHEN t.subagent THEN 1 ELSE 0 END AS sub, coalesce(s.source, 'claude') AS src
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.is_error AND t.end_ts IS NOT NULL ORDER BY t.end_ts""")
    for e in errs:
        e["ts"] = iso(e["ts"])
        e["e"] = e["e"] or ""
    inc, of = incidents(cur)
    for e in errs:
        e["n"] = of.get(e["id"])
    calls = cur.execute(f"""
        SELECT {day('t.start_ts')} AS d, coalesce(s.project, '(unknown)') AS p, count(*),
               count(*) FILTER (WHERE t.subagent), coalesce(s.source, 'claude') AS src
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.start_ts IS NOT NULL GROUP BY 1, 2, 5 ORDER BY 1, 2, 5""").fetchall()
    return dict(generated=last_ingest, today=(today or local_today(cur)).isoformat(), project_order=project_order(cur), categories=[{k: r[k] for k in ("id", "label", "why", "fix", "snippet")} for r in RULES],
                errors=errs, calls=[list(c) for c in calls], error_days=error_days(cur), incidents=inc, **error_marks(cur),
                incident_gap_minutes=INCIDENT_GAP_MINUTES, incident_max_ok=INCIDENT_MAX_OK)


INCIDENT_GAP_MINUTES = 10  # a failure more than this long after the previous one of the same tool starts a new incident
INCIDENT_MAX_OK = 2  # more successful calls of the tool than this between two failures start a new incident


def incidents(cur):
    """Failed calls grouped into incidents, a retry loop on one thing: failures of one tool by one agent (the main thread or
    one subagent, told apart by the transcript file that holds its results) with the same category, each starting at most
    INCIDENT_GAP_MINUTES after the previous one ended and with at most INCIDENT_MAX_OK successful calls of that tool in
    between (ok counts them over the incident). More successes than that mean the agent moved on: a later failure is a new
    attempt. Returns (incidents, {tool_use_id: incident index}). Each incident: s session, t tool, c category, p project, sub,
    first/last (ISO start of the first failure, end of the last), ok, outcome of the agent's next call of that tool that
    starts after the last failure ended ("recovered": it succeeded; "failed_again": it failed with another error, or later
    than the gap or the successes allow; "gave_up": the agent never called that tool again), and for a recovery rid, ri
    (its input, cut to 400) and rts (its start). Calls without a result yet take no part."""
    got = cur.execute(f"""
        WITH seq AS (
          SELECT tool_use_id AS id, session_id, subagent, coalesce(result_file, '') AS agent, tool, category, is_error, end_ts,
                 coalesce(start_ts, end_ts) AS ts, sum(CASE WHEN is_error THEN 0 ELSE 1 END) OVER w AS oks
          FROM tool_calls WHERE end_ts IS NOT NULL
          WINDOW w AS (PARTITION BY session_id, subagent, coalesce(result_file, ''), tool ORDER BY coalesce(start_ts, end_ts), tool_use_id)),
        fails AS (
          SELECT *, CASE WHEN ts - lag(end_ts) OVER f <= INTERVAL {INCIDENT_GAP_MINUTES} MINUTE
                          AND oks - lag(oks) OVER f <= {INCIDENT_MAX_OK} THEN 0 ELSE 1 END AS brk
          FROM seq WHERE is_error
          WINDOW f AS (PARTITION BY session_id, subagent, agent, tool, category ORDER BY ts, id)),
        grp AS (
          SELECT *, sum(brk) OVER (PARTITION BY session_id, subagent, agent, tool, category ORDER BY ts, id) AS g FROM fails),
        inc AS (
          SELECT session_id, subagent, agent, tool, category AS c, g, list(id ORDER BY ts, id) AS ids, min(ts) AS first,
                 max(end_ts) AS last, max(oks) - min(oks) AS ok
          FROM grp GROUP BY 1, 2, 3, 4, 5, 6),
        nxt AS (
          SELECT i.*, n.id AS n_id, n.is_error AS n_err FROM inc i ASOF LEFT JOIN seq n
            ON n.session_id = i.session_id AND n.subagent = i.subagent AND n.agent = i.agent AND n.tool = i.tool AND n.ts > i.last)
        SELECT i.session_id, i.tool, i.c, coalesce(s.project, '(unknown)'), i.subagent, i.first, i.last, i.ok, i.ids,
               CASE WHEN i.n_id IS NULL THEN 'gave_up' WHEN NOT i.n_err THEN 'recovered' ELSE 'failed_again' END,
               CASE WHEN NOT i.n_err THEN i.n_id END, CASE WHEN NOT i.n_err THEN left(r.input_summary, 400) END,
               CASE WHEN NOT i.n_err THEN coalesce(r.start_ts, r.end_ts) END
        FROM nxt i LEFT JOIN sessions s USING (session_id) LEFT JOIN tool_calls r ON r.tool_use_id = i.n_id
        ORDER BY i.first, i.session_id, i.tool, i.c, i.ids[1]""").fetchall()
    out, of = [], {}
    for sid, tool, c, p, sub, first, last, ok, ids, outcome, rid, ri, rts in got:
        for x in ids:
            of[x] = len(out)
        out.append(dict(s=sid, t=tool, c=c, p=p, sub=1 if sub else 0, first=iso(first), last=iso(last), ok=ok, outcome=outcome,
                        rid=rid, ri=ri or "", rts=iso(rts)))
    return out, of


def error_days(cur):
    """Failed calls per [day, project, category, errors, subagent errors, source], dated like an error's d (its end time),
    so the stacked chart sums counts instead of walking every error."""
    return [list(r) for r in cur.execute(f"""
        SELECT {day('t.end_ts')} AS d, coalesce(s.project, '(unknown)') AS p, t.category AS c, count(*),
               count(*) FILTER (WHERE t.subagent), coalesce(s.source, 'claude') AS src
        FROM tool_calls t LEFT JOIN sessions s USING (session_id)
        WHERE t.is_error AND t.end_ts IS NOT NULL GROUP BY 1, 2, 3, 6 ORDER BY 1, 2, 3, 6""").fetchall()]


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
    """A VALUES table of prices per model. Each model has a base tier and, optionally, a long-prompt tier and a fast-mode tier.
    A packaged entry with no rates (only a context window) gives NULL rates, so its requests have no estimate."""
    vals, params = [], []
    for model, p in prices.items():
        long, fast = p.get("long") or {}, p.get("fast") or {}
        vals.append("(" + ",".join("?" * 18) + ")")
        params += [model, p.get("context"), p.get("long_above"), *(p.get(k) for k in PRICE_KINDS),
                   *(long.get(k) for k in PRICE_KINDS), *(fast.get(k) for k in PRICE_KINDS)]
    if not vals:
        vals, params = ["(" + ",".join(["NULL"] * 18) + ")"], []
    sql = ("price(model, context, long_above, p_in, p_out, p_cr, p_5m, p_1h, l_in, l_out, l_cr, l_5m, l_1h, f_in, f_out, f_cr, f_5m, f_1h) AS "
           f"(SELECT * FROM (VALUES {','.join(vals)}))")
    return sql, params


# The price columns of each kind (base tier, long-prompt tier, fast-mode tier).
_RATE = dict(input=("p_in", "l_in", "f_in"), output=("p_out", "l_out", "f_out"), cache_read=("p_cr", "l_cr", "f_cr"),
             cache_5m=("p_5m", "l_5m", "f_5m"), cache_1h=("p_1h", "l_1h", "f_1h"))


def context_of(alias=""):
    """SQL: the context a request read, for every reader of a request as a context or prompt size. It is the context
    size the source stated (context_tokens: Grok's, whose token columns are a share of its turn's usage); NULL, unknown,
    when that is 0 (a Grok request whose tokens are not one call's states none); else, for a source that states none
    (context_tokens NULL), its input and cache tokens. alias is the table's alias with its dot. Sums of token usage and
    cost read the token columns."""
    a = alias
    return (f"CASE WHEN {a}context_tokens IS NULL THEN {a}input + {a}cache_read + {a}cache_5m + {a}cache_1h "
            f"ELSE nullif({a}context_tokens, 0) END")


def requests_cte(pcte, where):
    """Requests with their session's project and source, total tokens, the estimated cost of each priced kind (cost_input, cost_output,
    cost_cache_read, cost_cache_5m, cost_cache_1h) and their sum as cost. All are NULL when the model is unpriced; the tier
    is chosen once per request, so the kinds add up to cost. A request whose source reported its cost (reported_cost) costs
    that instead: cost is unknown only with neither, and the kinds of such a request are NULL even when its model has
    rates (a user can price a Grok model), as the web reads the kinds as the estimated part of cost.
    Thinking tokens are billed as output.
    A fast-mode request (speed 'fast') on a model with fast rates costs those rates at any prompt size: fast pricing applies
    across the full context window, so it replaces the long-prompt tier. Without fast rates it costs as any other request."""
    rate = lambda k: f"CASE WHEN fst THEN p.{_RATE[k][2]} WHEN lg THEN p.{_RATE[k][1]} ELSE p.{_RATE[k][0]} END"
    parts = ", ".join(f"CASE WHEN r.reported_cost IS NULL THEN r.{k} * {rate(k)} / 1e6 END AS cost_{k}" for k in PRICE_KINDS)
    return f"""WITH {pcte}, rq AS (
        SELECT *, coalesce(reported_cost, {" + ".join(f"cost_{k}" for k in PRICE_KINDS)}) AS cost FROM (
          SELECT r.*, s.project, coalesce(s.source, 'claude') AS source, r.input + r.output + r.cache_read + r.cache_5m + r.cache_1h AS tokens,
            coalesce(r.speed = 'fast' AND p.f_in IS NOT NULL, false) AS fst,
            coalesce(p.long_above IS NOT NULL AND r.input + r.cache_read + r.cache_5m + r.cache_1h > p.long_above, false) AS lg,
            {parts}
          FROM requests r JOIN sessions s USING (session_id) LEFT JOIN price p ON p.model = r.model
          WHERE {where}))"""


def scope(project, automated, source="", user_projects=None):
    """The session part of every usage filter, over sessions s: the project and the source match ('' is all of them), and
    automated sessions are left out unless automated: those of AUTOMATED_PROJECTS and the user automated file's projects
    (user_projects, read from the file when None; unless the filter names that project) and HELPER_SESSIONS. Returns
    (sql, params). Raises ValueError for a source not in SOURCES."""
    if source and source not in SOURCES:
        raise ValueError(f"unknown source: {source}")
    auto, ap = automated_session(project, user_projects)
    return (f"(? = '' OR s.project = ?) AND (? OR NOT {auto}) AND (? = '' OR s.source = ?)",
            [project, project, bool(automated), *ap, source, source])


def automated_session(project="", user_projects=None):
    """SQL over sessions s, true for an automated session: one of AUTOMATED_PROJECTS or the user automated file's projects
    (user_projects, read from the file when None), unless project names its project, or one of HELPER_SESSIONS. Never NULL.
    Returns (sql, params)."""
    names = [*AUTOMATED_PROJECTS, *(user_automated()[0] if user_projects is None else user_projects)]
    marks = ",".join("?" * len(names))
    return (f"((coalesce(s.project, '') IN ({marks}) AND s.project IS DISTINCT FROM ?) OR s.session_id IN ({HELPER_SESSIONS}))",
            [*names, project])


def view(project, range_days, prices, today, automated=False, source="", user_projects=None):
    """The filter shared by every usage query: a row belongs to the view when its session is in scope() and its time is in range."""
    if range_days < 0:
        raise ValueError("range must be >= 0")
    start = today - timedelta(days=range_days - 1) if range_days else None
    pcte, pparams = price_cte(prices)
    sql, sp = scope(project, automated, source, user_projects)
    fp = sp + [start, start]
    W = lambda ts: f"{sql} AND (CAST(? AS DATE) IS NULL OR {ts} >= {day_start('CAST(? AS DATE)')})"
    return start, pcte, pparams, fp, W, requests_cte(pcte, W("r.ts")), pparams + fp


RUN_RATE_DAYS = 7  # the complete days whose mean cost projects the rest of the month


def run_rate(cur, project, prices, today, automated=False, source="", user_projects=None):
    """The month's run rate under the view's scope (project, source, automated; not its range): the cost so far this month up
    to yesterday, the mean daily cost of the last 7 complete days, the days left counting today, and their projection. None
    without 7 complete days of history or without a priced request among them. by_source: the cost so far and projection of
    each agent with a cost in either window, over the same days, so a plan can be set against the agents it covers."""
    _, _, _, _, _, rq, rp = view(project, 0, prices, today, automated, source, user_projects)
    first_of = today.replace(day=1)
    since = today - timedelta(days=RUN_RATE_DAYS)
    by = rows(cur, f"""{rq} SELECT source, min(day) AS first, sum(cost) FILTER (WHERE day >= ? AND day < ?) AS avg_sum,
        sum(cost) FILTER (WHERE day >= ? AND day < ?) AS month_sum FROM (SELECT {day('ts')} AS day, source, cost FROM rq)
        GROUP BY 1 ORDER BY 1""", rp + [since.isoformat(), today.isoformat(), first_of.isoformat(), today.isoformat()])
    first = min((r["first"] for r in by), default=None)
    priced = [r for r in by if r["avg_sum"] is not None or r["month_sum"] is not None]
    if first is None or first > since.isoformat() or all(r["avg_sum"] is None for r in by):
        return None
    left = (first_of.replace(year=first_of.year + first_of.month // 12, month=first_of.month % 12 + 1) - today).days

    def rate(avg_sum, month_sum):
        daily_avg, month_cost = (avg_sum or 0) / RUN_RATE_DAYS, month_sum or 0
        return dict(month_cost=month_cost, daily_avg=daily_avg, projected=month_cost + daily_avg * left)

    total = rate(sum(r["avg_sum"] or 0 for r in by), sum(r["month_sum"] or 0 for r in by))
    return dict(total, days_left=left, by_source=[dict(source=r["source"], **rate(r["avg_sum"], r["month_sum"])) for r in priced])


def usage(cur, project="", range_days=0, session="", prices=None, today=None, automated=False, source=""):
    """The usage payload, every figure read in one transaction: an ingest that commits while it is built changes none of
    them, so the heading's total, the cost flow, the charts and the tables agree. The transaction only reads: it takes no
    lock, the ingest's writes go on, and it is rolled back at the end."""
    cur.execute("BEGIN")
    try:
        return usage_payload(cur, project, range_days, session, prices, today, automated, source)
    finally:
        cur.execute("ROLLBACK")


def usage_payload(cur, project, range_days, session, prices, today, automated, source):
    prices = load_prices() if prices is None else prices
    today = today or local_today(cur)
    # The user automated file, read once so the whole payload leaves out the same projects.
    af = automated_file()
    start, pcte, pparams, fp, W, rq, rp = view(project, range_days, prices, today, automated, source, af["projects"])
    sums = ", ".join(f"coalesce(sum({k}), 0) AS {k}" for k in TOKEN_KINDS)

    daily = rows(cur, f"{rq} SELECT {day('ts')} AS day, {sums}, sum(cost) AS cost, "
                      f"count(*) FILTER (WHERE cost IS NULL) AS unpriced FROM rq GROUP BY 1 ORDER BY 1", rp)
    # The same days split by project, for the stacked cost chart.
    daily_projects = rows(cur, f"{rq} SELECT {day('ts')} AS day, project, sum(cost) AS cost, sum(tokens) AS tokens "
                               f"FROM rq GROUP BY 1, 2 ORDER BY 1, 2", rp)
    costs = ", ".join(f"sum(cost_{k}) AS cost_{k}" for k in PRICE_KINDS)
    # And by model and by agent (a Codex session is source 'codex'); unpriced requests add no row, as they add no cost.
    daily_models = rows(cur, f"{rq} SELECT {day('ts')} AS day, model, sum(cost) AS cost FROM rq WHERE cost IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2", rp)
    daily_sources = rows(cur, f"{rq} SELECT {day('ts')} AS day, source, sum(cost) AS cost FROM rq WHERE cost IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2", rp)
    tot = rows(cur, f"""{rq} SELECT {sums}, coalesce(sum(tokens), 0) AS tokens, sum(cost) AS cost,
        count(*) AS requests, count(*) FILTER (WHERE NOT subagent) AS main_requests,
        coalesce(sum(tokens) FILTER (WHERE subagent), 0) AS sub_tokens, sum(cost) FILTER (WHERE subagent) AS sub_cost,
        coalesce(sum(thinking_ms), 0) AS thinking_ms, {costs} FROM rq""", rp)[0]
    # The cost flow, from project to model to token kind: one scan grouped by project and model (the pairs) and by model
    # alone (with its kinds and its reported cost). grouping(project) tells a model's row from a pair whose session has no
    # project. Unpriced requests add no row; a model whose requests all carry a reported cost has its kinds NULL, and one
    # with none its cost_reported. A request costs its kinds or its reported cost, so a model's row adds up to its cost.
    flow = rows(cur, f"""{rq} SELECT project, model, grouping(project) AS whole, sum(cost) AS cost, {costs},
        sum(reported_cost) AS cost_reported
        FROM rq WHERE cost IS NOT NULL GROUP BY GROUPING SETS ((project, model), (model))
        ORDER BY whole, cost DESC, project, model""", rp)
    kinds = ["model", "cost"] + [f"cost_{k}" for k in PRICE_KINDS] + ["cost_reported"]
    cost_flow = dict(pairs=[dict(project=r["project"], model=r["model"], cost=r["cost"]) for r in flow if not r["whole"]],
                     models=[{k: r[k] for k in kinds} for r in flow if r["whole"]])
    unpriced = rows(cur, f"{rq} SELECT model, count(*) AS requests, sum(tokens) AS tokens FROM rq WHERE cost IS NULL GROUP BY 1 ORDER BY 3 DESC, 1", rp)
    models = rows(cur, f"""{rq} SELECT model, coalesce(effort, '(none)') AS effort, coalesce(speed = 'fast', false) AS fast,
        count(*) AS requests, sum(tokens) AS tokens, sum(cost) AS cost FROM rq GROUP BY 1, 2, 3
        ORDER BY requests DESC, tokens DESC, model, effort, fast""", rp)

    calls, pr = call_totals(cur, W, fp), prompt_totals(cur, W, fp)
    failed_tests = failed_test_runs(cur, W, fp)
    loops = error_loops(cur, W, fp)
    work = daily_work(cur, rq, rp, W, fp)
    first = next((r["day"] for r in work if r["sessions"]), None)
    bucket = "week" if first and (today - date.fromisoformat(first)).days > WEEKLY_AFTER_DAYS else "day"
    by = week if bucket == "week" else day

    sess = sessions(cur, rq, rp, W, fp, prices)
    sessions_by_id = {x["session_id"]: x for x in sess}
    for lp in loops:
        if lp["session_id"] in sessions_by_id:
            sessions_by_id[lp["session_id"]]["error_loops"] += 1
    by_project = projects(cur, rq, rp, W, fp, loops)
    recent = sorted(sess, key=lambda x: x["first_ts"] or "", reverse=True)[:300]
    top = sorted(sess, key=lambda x: -(x["cost"] or 0))[:50]
    # One lookup over both lists (they share rows). The fallback to the first prompt scans raw lines per session: for one
    # project (the Project page names each sessions row) every row may take it; over all projects only top_sessions may,
    # and the other sessions rows take a stored title or None.
    titles.with_titles(cur, recent + top, prompts=True if project else [x["session_id"] for x in top])

    per = lambda a, b: a / b if b else None
    totals = dict(
        tot, **calls, **pr, error_loops=len(loops), sessions=len(sess),
        cache_hit_ratio=per(tot["cache_read"], tot["input"] + tot["cache_read"] + tot["cache_5m"] + tot["cache_1h"]),
        write_1h_share=per(tot["cache_1h"], tot["cache_5m"] + tot["cache_1h"]),
        subagent_token_share=per(tot["sub_tokens"], tot["tokens"]),
        subagent_cost_share=per(tot["sub_cost"] or 0, tot["cost"]) if tot["cost"] else None,
        tokens_per_prompt=per(tot["tokens"], pr["prompts"]), cost_per_prompt=per(tot["cost"], pr["prompts"]) if tot["cost"] is not None else None,
        turns_per_prompt=per(tot["main_requests"], pr["prompts"]), tool_calls_per_prompt=per(calls["main_calls"], pr["prompts"]),
        interruption_rate=per(pr["interrupted"], pr["prompts"]),
        tokens_per_commit=per(tot["tokens"], calls["commits"]), cost_per_commit=per(tot["cost"], calls["commits"]) if calls["commits"] and tot["cost"] is not None else None,
        errors_per_100_calls=per(100 * calls["errors"], calls["calls"]),
        session_seconds=sum(x["duration_s"] or 0 for x in sess),
        median_session_seconds=median([x["duration_s"] for x in sess if x["duration_s"] is not None]),
        near_limit=sum(1 for x in sess if x["near_limit"]), **timing(cur, rq, rp))
    out = dict(project=project, range=range_days, automated=bool(automated), source=source, start=start.isoformat() if start else None, end=today.isoformat(),
               projects=project_list(cur, automated, af["projects"]), project_order=project_order(cur, af["projects"]), totals=totals, daily=daily, daily_projects=daily_projects,
               daily_models=daily_models, daily_sources=daily_sources, cost_flow=cost_flow,
               daily_work=work, work_bucket=bucket, work=work if by is day else daily_work(cur, rq, rp, W, fp, by),
               work_projects=daily_work(cur, rq, rp, W, fp, by, by_project=True), speed_trend=speed_trend(cur, rq, rp, by),
               unpriced=unpriced, models=models, by_project=by_project, **tool_rates(cur, W, fp),
               error_loops=titles.with_titles(cur, loops[:50]), failed_tests=titles.with_titles(cur, failed_tests),
               sessions=recent, top_sessions=top,
               near_limit=sorted((x for x in sess if x["near_limit"]), key=lambda x: -x["context_share"]),
               previous=previous_period(cur, project, range_days, prices, today, automated, source, af["projects"]))
    out["changes"] = project_changes(by_project, out["previous"])
    out["run_rate"] = run_rate(cur, project, prices, today, automated, source, af["projects"])
    out["prices_file"] = prices_file()
    out["plans"] = view_plans(cur, source)
    out["automated_file"] = af
    if session:
        out["session"] = session_detail(cur, session, requests_cte(pcte, "r.session_id = ?"), pparams + [session], prices)
    return out


FAILED_TESTS = 50  # the newest failed test runs on the payload
WEEKLY_AFTER_DAYS = 60  # work is bucketed by week when it spans more days than this


def failed_test_runs(cur, W, fp):
    """The newest FAILED_TESTS failed test and build runs over the filter W (params fp), newest first."""
    out = rows(cur, f"""SELECT t.tool_use_id AS id, t.session_id, s.project, coalesce(s.source, 'claude') AS source,
        left(coalesce(t.input_summary, ''), 400) AS command, coalesce(t.start_ts, t.end_ts) AS ts
        FROM tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')} AND t.is_test AND NOT t.test_passed
        ORDER BY ts DESC NULLS LAST, id DESC LIMIT {FAILED_TESTS}""", fp)
    for r in out:
        r["ts"] = iso(r["ts"])
    return out


def call_totals(cur, W, fp):
    """Tool call counts over the filter W (params fp): calls, errors, commits (a passing commit), test runs and outcomes."""
    return rows(cur, f"""SELECT count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
        count(*) FILTER (WHERE is_commit AND test_passed) AS commits,
        count(*) FILTER (WHERE is_test AND end_ts IS NOT NULL) AS test_runs,
        count(*) FILTER (WHERE is_test AND test_passed) AS tests_passed,
        count(*) FILTER (WHERE is_test AND NOT test_passed) AS tests_failed,
        count(*) FILTER (WHERE NOT t.subagent) AS main_calls
        FROM tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')}""", fp)[0]


def prompt_totals(cur, W, fp):
    """Prompts, interrupted prompts and active days over the filter W (params fp). An active day is a day with a prompt: a
    session that only works on its own (a resumed one, a background task) adds none."""
    return rows(cur, f"""SELECT count(*) AS prompts, count(*) FILTER (WHERE interrupted) AS interrupted,
        count(DISTINCT {day('p.ts')}) AS active_days FROM prompts p JOIN sessions s USING (session_id) WHERE {W('p.ts')}""", fp)[0]


def tool_rates(cur, W, fp):
    """Calls and failures per tool (with latency), MCP server and skill, and runs per hook, over the filter W (params fp)."""
    tc = f"tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')}"
    tools = rows(cur, f"""SELECT tool, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
        quantile_cont({latency()}, 0.5) AS p50_ms, quantile_cont({latency()}, 0.95) AS p95_ms
        FROM {tc} GROUP BY 1 ORDER BY calls DESC, 1""", fp)
    mcp = rows(cur, f"SELECT mcp_server AS name, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors "
                    f"FROM {tc} AND mcp_server IS NOT NULL GROUP BY 1 ORDER BY calls DESC", fp)
    skills = rows(cur, f"SELECT skill AS name, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors "
                       f"FROM {tc} AND skill IS NOT NULL GROUP BY 1 ORDER BY calls DESC", fp)
    hooks = rows(cur, f"""SELECT coalesce(h.command, h.hook) AS name, h.hook AS event, count(*) AS runs,
        count(*) FILTER (WHERE h.is_error) AS errors, avg(h.duration_ms) AS avg_ms
        FROM hooks h JOIN sessions s USING (session_id) WHERE {W('h.ts')} GROUP BY 1, 2 ORDER BY runs DESC""", fp)
    return dict(tools=rate_rows(tools), mcp=rate_rows(mcp), skills=rate_rows(skills), hooks=rate_rows(hooks, "runs"))


SPANS = (1, 7)  # the days a selection covers: one day of the work chart, or one of its weeks


def on_day(d, start, today, pcte, pparams, W, fp, days=1):
    """A view's filter (view(), whose range runs from start, None for all time, to today) limited to the local days d
    (YYYY-MM-DD) to d + days - 1 that fall in the range: (date, (first, last), W, fp, rq, rp), first and last the clipped
    days. days is one of SPANS. Raises ValueError for a bad day or span."""
    if days not in SPANS:
        raise ValueError(f"days must be one of {SPANS}")
    d, by_view = date.fromisoformat(d), W
    first, last = max(d, start) if start else d, min(d + timedelta(days=days - 1), today)
    W = lambda ts: f"{by_view(ts)} AND {ts} >= {day_start('CAST(? AS DATE)')} AND {ts} < {day_start('CAST(? AS DATE) + 1')}"
    fp = fp + [first, last]
    return d, (first, last), W, fp, requests_cte(pcte, W("r.ts")), pparams + fp


def day_view(cur, project="", range_days=0, day="", today=None, automated=False, source="", days=1, prices=None):
    """Project metrics, tools, MCP servers, skills, hooks, error loops and failed test runs as usage() has them, limited to
    the view's local days from day (YYYY-MM-DD): one, or a week of the work chart (days=7), clipped to the range; start and
    end name the days counted. Raises ValueError for a bad day, span or source."""
    prices = load_prices() if prices is None else prices
    today = today or local_today(cur)
    start, pcte, pparams, fp, W, _, _ = view(project, range_days, prices, today, automated, source)
    d, (first, last), W, fp, rq, rp = on_day(day, start, today, pcte, pparams, W, fp, days)
    loops = error_loops(cur, W, fp)
    tests = failed_test_runs(cur, W, fp)
    return dict(day=d.isoformat(), days=days, start=first.isoformat(), end=last.isoformat(), **tool_rates(cur, W, fp),
                by_project=projects(cur, rq, rp, W, fp, loops),
                error_loops=titles.with_titles(cur, loops[:50]), error_loops_total=len(loops),
                failed_tests=titles.with_titles(cur, tests), tests_failed=call_totals(cur, W, fp)["tests_failed"])


CALENDAR_WEEKS = 53  # the weeks of the activity calendar, the current one last: a whole year is always there


def calendar(cur, project="", today=None, automated=False, source=""):
    """The work per day (daily_work(), as usage() counts it) from the Monday 52 weeks before this week's to today, whatever
    the page's range, and first: the first day with a request under the same filters over all time, or None. Nothing after
    today: no row, and first is None when nothing is recorded up to today. No prices are read. Raises ValueError for a bad source."""
    today = today or local_today(cur)
    start = today - timedelta(days=today.weekday() + 7 * (CALENDAR_WEEKS - 1))  # weekday() is 0 on Monday
    ap = user_automated()[0]  # read once, so the rows and first leave out the same projects
    _, _, _, fp, W, rq, rp = view(project, (today - start).days + 1, {}, today, automated, source, ap)
    _, _, _, _, _, all_rq, all_rp = view(project, 0, {}, today, automated, source, ap)
    end = today.isoformat()
    first = cur.execute(f"{all_rq} SELECT min({day('ts')}) FROM rq", all_rp).fetchone()[0]
    # view() bounds the time below only: a day after today (a machine with a fast clock) is dropped, here rather than in the
    # shared filter, so the rows stay usage()'s up to today, and no first is after end.
    days = [r for r in daily_work(cur, rq, rp, W, fp) if r["day"] <= end]
    if first and first > end:
        first = None
    # A prompt or a tool call can fall on a local day before its session's first request: no row is dated before first.
    if days and (first is None or days[0]["day"] < first):
        first = days[0]["day"]
    return dict(project=project, automated=bool(automated), source=source, start=start.isoformat(), end=end,
                first=first, days=days)


def previous_dates(range_days, today):
    """(first day, last day) of the equal-length period just before a view of range_days ending today; None for all time."""
    if not range_days:
        return None
    end = today - timedelta(days=range_days)
    return end - timedelta(days=range_days - 1), end


def previous_period(cur, project, range_days, prices, today, automated=False, source="", user_projects=None):
    """The equal-length period just before the view (same scope()), for the headline comparison and its sparkline.
    None for the all-time view, which has nothing before it."""
    dates = previous_dates(range_days, today)
    if dates is None:
        return None
    start, end = dates
    pcte, pparams = price_cte(prices)
    sql, sp = scope(project, automated, source, user_projects)
    W = lambda ts: f"{sql} AND {ts} >= {day_start('CAST(? AS DATE)')} AND {ts} < {day_start('CAST(? AS DATE) + 1')}"
    fp = sp + [start, end]
    rq, p = requests_cte(pcte, W("r.ts")), pparams + fp
    tot = rows(cur, f"""{rq} SELECT coalesce(sum(tokens), 0) AS tokens, sum(cost) AS cost, count(*) AS requests,
        count(DISTINCT session_id) AS sessions, coalesce(sum(tokens) FILTER (WHERE subagent), 0) AS sub_tokens FROM rq""", p)[0]
    calls = call_totals(cur, W, fp)
    sess = sessions(cur, rq, p, W, fp, prices)
    daily = rows(cur, f"{rq} SELECT {day('ts')} AS day, sum(cost) AS cost, sum(tokens) AS tokens FROM rq GROUP BY 1 ORDER BY 1", p)
    by_project = rows(cur, f"{rq} SELECT project, sum(cost) AS cost, sum(tokens) AS tokens, count(*) AS requests FROM rq GROUP BY 1", p)
    return dict(tot, **prompt_totals(cur, W, fp), **{k: calls[k] for k in ("calls", "errors", "commits", "test_runs", "tests_passed")},
                median_session_seconds=median([x["duration_s"] for x in sess if x["duration_s"] is not None]),
                output_per_s=timing(cur, rq, p)["output_per_s"],
                start=start.isoformat(), end=end.isoformat(), daily=daily, by_project=by_project)


SUBJECTS = dict(tool="t.tool", mcp="t.mcp_server", skill="t.skill")  # what an inspector kind matches its name against
TOP_PATTERNS = 15  # input-pattern groups on the tool inspector; the rest fold into "other"
RECENT_CALLS = 50


def tool_detail(cur, kind, name, project="", range_days=0, today=None, automated=False, source=""):
    """The tool inspector: every section for one tool, MCP server or skill (kind, matched against SUBJECTS) over the view.
    A skill covers its Skill invocations only: the store does not link the calls made while a skill runs.
    previous: calls and failures in the period before (None for all time). recovery: the outcomes of the subject's incidents
    (as on the Errors page) that start in the view. Raises ValueError for an unknown kind or source."""
    if kind not in SUBJECTS:
        raise ValueError(f"unknown kind: {kind}")
    today = today or local_today(cur)
    start, _, _, fp, W, _, _ = view(project, range_days, {}, today, automated, source)
    ts = "coalesce(t.start_ts, t.end_ts)"
    tc = f"tool_calls t JOIN sessions s USING (session_id) WHERE {W(ts)} AND {SUBJECTS[kind]} = ?"
    p = fp + [name]
    rate = "count(*) AS calls, count(*) FILTER (WHERE t.is_error) AS errors"
    per = lambda a, b: a / b if b else None

    tot = rows(cur, f"""SELECT {rate}, count(*) FILTER (WHERE t.subagent) AS subagent_calls,
        quantile_cont({latency('t.')}, 0.5) AS p50_ms, quantile_cont({latency('t.')}, 0.95) AS p95_ms FROM {tc}""", p)[0]
    tot.update(failure_rate=per(tot["errors"], tot["calls"]), subagent_share=per(tot["subagent_calls"], tot["calls"]))
    previous = None
    if (dates := previous_dates(range_days, today)) is not None:
        sql, sp = scope(project, automated, source)
        previous = rows(cur, f"""SELECT {rate} FROM tool_calls t JOIN sessions s USING (session_id) WHERE {sql}
            AND {ts} >= {day_start('CAST(? AS DATE)')} AND {ts} < {day_start('CAST(? AS DATE) + 1')} AND {SUBJECTS[kind]} = ?""", sp + [*dates, name])[0]
        previous.update(start=dates[0].isoformat(), end=dates[1].isoformat(), failure_rate=per(previous["errors"], previous["calls"]))
    by = lambda col, alias: rate_rows(rows(cur, f"SELECT {col} AS {alias}, {rate} FROM {tc} GROUP BY 1 ORDER BY calls DESC, 1", p))
    daily = rows(cur, f"""SELECT {day(ts)} AS day, count(*) FILTER (WHERE NOT t.is_error) AS ok,
        count(*) FILTER (WHERE t.is_error) AS failed FROM {tc} AND {ts} IS NOT NULL GROUP BY 1 ORDER BY 1""", p)

    # One pass over the subject's calls: input patterns in Python (categorize.input_pattern), failed ids for incidents and loops.
    groups, failed = {}, set()
    for tid, tool, summary, is_error in cur.execute(f"SELECT t.tool_use_id, t.tool, t.input_summary, t.is_error FROM {tc}", p).fetchall():
        g = groups.setdefault(input_pattern(tool, summary), [0, 0])
        g[0] += 1
        if is_error:
            g[1] += 1
            failed.add(tid)
    patterns = None
    if kind != "skill":
        other = groups.pop("other", [0, 0])
        ranked = sorted(groups.items(), key=lambda kv: (-kv[1][0], kv[0]))
        for _, (n, e) in ranked[TOP_PATTERNS:]:
            other = [other[0] + n, other[1] + e]
        patterns = rate_rows([dict(pattern=k, calls=n, errors=e) for k, (n, e) in ranked[:TOP_PATTERNS] + ([("other", other)] if other[0] else [])])

    rules = {r["id"]: r for r in RULES}
    categories = [dict(id=c, label=rules.get(c, {}).get("label", c), why=rules.get(c, {}).get("why", ""), fix=rules.get(c, {}).get("fix", ""),
                       errors=n)
                  for c, n in cur.execute(f"SELECT t.category, count(*) FROM {tc} AND t.is_error GROUP BY 1 ORDER BY 2 DESC, 1", p).fetchall()]
    inc, of = incidents(cur)
    first = iso(start_ts(cur, start)) or ""
    recovery = dict(incidents=0, recovered=0, failed_again=0, gave_up=0)
    for i in {of[x] for x in failed if x in of}:
        if (inc[i]["first"] or "") >= first:
            recovery["incidents"] += 1
            recovery[inc[i]["outcome"]] += 1
    loops = [lp for lp in error_loops(cur, W, fp) if lp["first_id"] in failed]
    shell = None
    if kind == "tool" and name in SHELL_TOOLS:
        shell = rows(cur, f"""SELECT count(*) FILTER (WHERE t.is_test AND t.end_ts IS NOT NULL) AS test_runs,
            count(*) FILTER (WHERE t.is_test AND t.test_passed) AS tests_passed,
            count(*) FILTER (WHERE t.is_test AND NOT t.test_passed) AS tests_failed,
            count(*) FILTER (WHERE t.is_commit AND t.test_passed) AS commits FROM {tc}""", p)[0]
        shell["pass_rate"] = per(shell["tests_passed"], shell["test_runs"])
    recent = rows(cur, f"""SELECT t.tool_use_id AS id, {ts} AS ts, t.session_id, s.project, coalesce(s.source, 'claude') AS source,
        t.tool, left(t.input_summary, 400) AS input, t.is_error, t.category, t.subagent,
        {latency('t.')} AS duration_ms FROM {tc} ORDER BY {ts} DESC NULLS LAST, t.tool_use_id DESC
        LIMIT {RECENT_CALLS}""", p)
    for r in titles.with_titles(cur, recent):
        r["ts"], r["input"] = iso(r["ts"]), r["input"] or ""
    tools = None
    if kind == "mcp":
        tools = rate_rows(rows(cur, f"""SELECT t.tool, {rate}, quantile_cont({latency('t.')}, 0.5) AS p50_ms
            FROM {tc} GROUP BY 1 ORDER BY calls DESC, 1""", p))
    return dict(kind=kind, name=name, project=project, range=range_days, automated=bool(automated), source=source,
                start=start.isoformat() if start else None, end=today.isoformat(), totals=tot, previous=previous, daily=daily,
                projects=by("s.project", "project"), sources=by("coalesce(s.source, 'claude')", "source"),
                threads=by("t.subagent", "subagent"), patterns=patterns, categories=categories, recovery=recovery,
                error_loops=titles.with_titles(cur, loops), shell=shell, recent=recent, tools=tools)


def palette(cur, project="", range_days=0, today=None, automated=False, source=""):
    """The command palette's suggestions with their counts for a view. projects and sources count the view's sessions (those
    with requests in range), each leaving its own facet out, so another project's count shows while one is chosen. tools, mcp
    and skills: calls, failures and failure rate with usage()'s filter, called ones only. categories: failed calls per
    category as the Errors page counts them (by end time, automated sessions always in). Raises ValueError for an unknown source."""
    today = today or local_today(cur)
    _, _, _, fp, W, _, _ = view(project, range_days, {}, today, automated, source)

    def sessions_by(col, p, src):
        _, _, _, sfp, SW, _, _ = view(p, range_days, {}, today, automated, src)
        return cur.execute(f"""SELECT {col}, count(DISTINCT r.session_id) FROM requests r JOIN sessions s USING (session_id)
            WHERE {SW('r.ts')} AND {col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1""", sfp).fetchall()

    tc = f"tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')}"
    rate = lambda col: rate_rows(rows(cur, f"""SELECT {col} AS name, count(*) AS calls, count(*) FILTER (WHERE t.is_error) AS errors
        FROM {tc} AND {col} IS NOT NULL GROUP BY 1 ORDER BY calls DESC, 1""", fp))
    _, _, _, efp, EW, _, _ = view(project, range_days, {}, today, True, source)
    labels = {r["id"]: r["label"] for r in RULES}
    cats = cur.execute(f"""SELECT t.category, count(*) FROM tool_calls t JOIN sessions s USING (session_id)
        WHERE t.is_error AND t.end_ts IS NOT NULL AND {EW('t.end_ts')} GROUP BY 1 ORDER BY 2 DESC, 1""", efp).fetchall()
    return dict(project=project, range=range_days, automated=bool(automated), source=source,
                projects=[dict(name=n, sessions=c) for n, c in sessions_by("s.project", "", source)],
                sources=[dict(source=n, sessions=c) for n, c in sessions_by("coalesce(s.source, 'claude')", project, "")],
                tools=rate("t.tool"), mcp=rate("t.mcp_server"), skills=rate("t.skill"),
                categories=[dict(id=c, label=labels.get(c, c), errors=n) for c, n in cats])


def project_changes(by_project, previous):
    """Each project's estimated-cost change against the previous period, biggest move first, for the "what changed" chart.
    new: the project had no requests at all in the previous period. Projects active only before the view count too (cost 0 now).
    A period whose requests were all on unpriced models has an unknown (None) cost, and then the delta is None too; those
    projects sort by the cost that is known. None for the all-time view."""
    if previous is None:
        return None
    now = {r["project"]: r for r in by_project}
    before = {r["project"]: r for r in previous["by_project"]}
    out = []
    for name in now.keys() | before.keys():
        c, b = (now[name]["cost"] if name in now else 0), (before[name]["cost"] if name in before else 0)
        out.append(dict(project=name, cost=c, prev_cost=b, delta=None if c is None or b is None else c - b, new=name not in before))
    return sorted(out, key=lambda r: (-abs(r["delta"] if r["delta"] is not None else r["cost"] or r["prev_cost"] or 0), r["project"] or ""))


SESSION_SORTS = ("first_ts", "duration_s", "prompts", "tokens", "cost", "peak_context", "errors", "compactions", "commits", "tests_failed",
                 "model_ms", "output_per_s")


MAX_SESSION_SORTS = 3


def parse_session_sort(sort, desc=False):
    """The (key, descending) pairs of a sessions sort: one to MAX_SESSION_SORTS keys of SESSION_SORTS, comma-separated, each
    with a leading "-" for descending. A single key without "-" is descending when desc. No sort ("") gives no pairs.
    Raises ValueError for an unknown, repeated or empty key, more keys than MAX_SESSION_SORTS, and desc beside a list or a "-" key."""
    if not sort:
        return []
    items = sort.split(",")
    if len(items) > MAX_SESSION_SORTS:
        raise ValueError(f"too many sort keys: at most {MAX_SESSION_SORTS}")
    keys = []
    for item in items:
        down = item.startswith("-")
        key = item[1:] if down else item
        if not key:
            raise ValueError("empty sort key")
        if key not in SESSION_SORTS:
            raise ValueError(f"unknown sort: {key}")
        if any(key == k for k, _ in keys):
            raise ValueError(f"repeated sort key: {key}")
        keys.append((key, down))
    if desc and (len(keys) > 1 or keys[0][1]):
        raise ValueError("desc cannot go with a sort list or a - key")
    return [(keys[0][0], True)] if desc else keys


def session_list(cur, project="", range_days=0, q="", near=False, offset=0, limit=100, prices=None, today=None, day="", automated=False,
                 source="", sort="", desc=False, days=None):
    """One page of the view's sessions, newest first (or nearest the context limit first), matching q on title, id, project
    or branch. day (YYYY-MM-DD): the sessions with requests on that day, or in the week from it (days=7), every figure (active
    time included) limited to those days in the range, costliest first and all of them, so their costs add up to the days'.
    sort (parse_session_sort: one to three keys of SESSION_SORTS, "-" for descending, ascending otherwise, or one key with
    desc) orders them instead, before the page, by the first key, then by each next one among the rows that are tied; rows
    without a value come last for each key. The list's own order, then the session id, breaks the last ties, so pages never
    repeat or skip a session. Each row also carries its whole-session model time and output speed (add_runs). Raises
    ValueError for a sort it cannot read, another span, or a span without a day."""
    order = parse_session_sort(sort, desc)
    prices = load_prices() if prices is None else prices
    if days is not None and not day:
        raise ValueError("days needs a day")
    today = today or local_today(cur)
    start, pcte, pparams, fp, W, rq, rp = view(project, range_days, prices, today, automated, source)
    on = None
    if day:
        _, on, W, fp, rq, rp = on_day(day, start, today, pcte, pparams, W, fp, days or 1)
    sess = sessions(cur, rq, rp, W, fp, prices, on)
    q = q.strip().lower()
    hits = [x for x in sess if not near or x["near_limit"]]
    named = titles.titles(cur, [x["session_id"] for x in hits]) if q else {}
    hits = [x for x in hits if not q or q in f"{(named.get(x['session_id']) or ('',))[0]} {x['session_id']} {x['project']} {x['git_branch'] or ''}".lower()]
    hits.sort(key=lambda x: x["session_id"])  # the last tie-break: the sorts below are stable
    if near:
        hits.sort(key=lambda x: -x["context_share"])
    elif day:
        hits.sort(key=lambda x: -(x["cost"] or 0))
        offset, limit = 0, len(hits)
    else:
        hits.sort(key=lambda x: x["first_ts"] or "", reverse=True)
    add_runs(cur, hits)
    for key, down in reversed(order):  # the last key first, so the first one ends up deciding
        hits = sorted((x for x in hits if x[key] is not None), key=lambda x: x[key], reverse=down) + [x for x in hits if x[key] is None]
    return dict(total=len(hits), offset=offset, sessions=titles.with_titles(cur, hits[offset:offset + limit]))


def add_runs(cur, xs):
    """Set model_ms and output_per_s on each session row in xs: its whole-session figures (runs_cte), None for a session that
    records no run (every Codex session, older Claude Code ones) or no model time. Only the sessions list carries them."""
    ids = [x["session_id"] for x in xs]
    runs = {r["session_id"]: r for r in rows(cur, f"WITH {runs_cte('SELECT unnest(?::VARCHAR[])')} SELECT * FROM runs", [ids])} if ids else {}
    for x in xs:
        r = runs.get(x["session_id"])
        x["model_ms"] = r["model_ms"] if r and r["model_ms"] else None
        x["output_per_s"] = speed(r["output"], r["model_ms"]) if r else None


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


def project_list(cur, automated=False, user_projects=None):
    sql, sp = scope("", automated, "", user_projects)
    return [r[0] for r in cur.execute(f"SELECT project FROM sessions s WHERE project IS NOT NULL AND {sql} GROUP BY 1 ORDER BY count(*) DESC, 1",
                                      sp).fetchall()]


def project_order(cur, user_projects=None):
    """Projects by all-time tokens, busiest first. Both pages hand out project colors in this order, so it ignores every filter,
    except that automated projects are always left out: they never take a project color."""
    sql, sp = scope("", False, "", user_projects)
    return [r[0] for r in cur.execute(f"""SELECT s.project FROM requests r JOIN sessions s USING (session_id) WHERE s.project IS NOT NULL
        AND {sql} GROUP BY 1 ORDER BY sum(r.input + r.output + r.cache_read + r.cache_5m + r.cache_1h) DESC, 1""", sp).fetchall()]


def daily_work(cur, rq, rp, W, fp, bucket=day, by_project=False):
    """Work per bucket (day, or week: a bucket SQL helper) in the view: sessions with a request in it, prompts, commits (as
    in totals), tool calls and failed calls. A session active in two buckets counts in both, but once in one. by_project:
    a row per bucket and project, summing to the bucket's. Buckets with none of these are left out."""
    g, col, rq_col = ("1, 2", ", s.project", ", project") if by_project else ("1", "", "")
    ts = "coalesce(t.start_ts, t.end_ts)"
    out = {}
    for got in (rows(cur, f"{rq} SELECT {bucket('ts')} AS day{rq_col}, count(DISTINCT session_id) AS sessions FROM rq GROUP BY {g}", rp),
                rows(cur, f"""SELECT {bucket('p.ts')} AS day{col}, count(*) AS prompts
                    FROM prompts p JOIN sessions s USING (session_id) WHERE {W('p.ts')} GROUP BY {g}""", fp),
                rows(cur, f"""SELECT {bucket(ts)} AS day{col}, count(*) FILTER (WHERE is_commit AND test_passed) AS commits,
                    count(*) AS calls, count(*) FILTER (WHERE is_error) AS failed_calls
                    FROM tool_calls t JOIN sessions s USING (session_id) WHERE {W(ts)} GROUP BY {g}""", fp)):
        for r in got:
            if r["day"]:
                key = (r["day"], r.get("project")) if by_project else r["day"]
                out.setdefault(key, dict(day=r["day"], **({"project": r["project"]} if by_project else {}),
                                         sessions=0, prompts=0, commits=0, calls=0, failed_calls=0)).update(r)
    return [out[k] for k in sorted(out, key=lambda k: (k[0], k[1] is not None, k[1] or "") if by_project else k)]


def speed_trend(cur, rq, rp, bucket=day):
    """Output speed per bucket (day, or week: a bucket SQL helper) over the view's sessions that record runs, as timing()
    totals it: each session counts in the bucket of its first request in the view, with its whole-session output and model
    time. Buckets with no such session are left out."""
    got = rows(cur, f"""{rq}, {runs_cte("SELECT session_id FROM rq")}, firsts AS (SELECT session_id, min(ts) AS ts FROM rq GROUP BY 1)
        SELECT {bucket('firsts.ts')} AS day, sum(model_ms) AS model_ms, sum(output) AS output, count(*) AS sessions
        FROM runs JOIN firsts USING (session_id) GROUP BY 1 ORDER BY 1""", rp)
    return [dict(day=r["day"], output_per_s=speed(r["output"], r["model_ms"]), sessions=r["sessions"]) for r in got if r["model_ms"]]


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


IDLE_GAP_S = 20 * 60  # a pause longer than this between a session's requests and tool calls is idle, as on its timeline


def active_cte(ids, on_days=False):
    """CTEs ending in act(session_id, active_s): the whole active time of each session that ids (SQL) selects, the time
    between its main-thread requests and tool calls less every pause over IDLE_GAP_S. on_days: only the time between events
    of the local days from a first to a last day, given as two more params."""
    within = f"WHERE t >= {day_start('CAST(? AS DATE)')} AND t < {day_start('CAST(? AS DATE) + 1')}" if on_days else ""
    return f"""ev AS (SELECT session_id, ts AS t FROM requests WHERE NOT subagent AND ts IS NOT NULL AND session_id IN ({ids})
               UNION ALL SELECT session_id, coalesce(start_ts, end_ts) FROM tool_calls
               WHERE coalesce(start_ts, end_ts) IS NOT NULL AND session_id IN ({ids})),
        gap AS (SELECT session_id, date_diff('millisecond', lag(t) OVER (PARTITION BY session_id ORDER BY t), t) AS ms FROM ev {within}),
        act AS (SELECT session_id, CAST(round(coalesce(sum(ms) FILTER (WHERE ms <= {IDLE_GAP_S * 1000}), 0) / 1000) AS BIGINT) AS active_s
                FROM gap GROUP BY 1)"""


def runs_cte(ids):
    """CTEs ending in runs(session_id, model_ms, tool_ms, lines_added, lines_removed, output) for each session that ids (SQL)
    selects and that has a run (session_runs): its figures summed over its runs, and output its whole output, subagents
    included, to match; 0 for a session with no model time, so a speed's output and model time come from the same sessions.
    Output tokens include thinking tokens, as Claude Code reports them. ids is used once."""
    return f"""run_sums AS (SELECT session_id, sum(api_ms) AS model_ms, sum(tool_ms) AS tool_ms, sum(lines_added) AS lines_added,
                   sum(lines_removed) AS lines_removed FROM session_runs WHERE session_id IN ({ids}) GROUP BY 1),
        run_output AS (SELECT session_id, sum(output) AS output FROM requests
                       WHERE session_id IN (SELECT session_id FROM run_sums WHERE model_ms > 0) GROUP BY 1),
        runs AS (SELECT run_sums.*, coalesce(run_output.output, 0) AS output FROM run_sums LEFT JOIN run_output USING (session_id))"""


def speed(output, model_ms):
    """Output tokens per second of model time; None without model time."""
    return output / (model_ms / 1000) if model_ms else None


def timing(cur, rq, rp):
    """Model time, tool time and output speed over the view's sessions (those with requests in rq, params rp) that record
    runs, each whole-session (runs_cte); the others count in none. session_sources: the sources of the view's sessions, which
    say why none records model time (Codex transcripts never do). tool_ms is None when the timed sessions state no tool time
    (Grok runs state none)."""
    t = rows(cur, f"""{rq}, {runs_cte("SELECT session_id FROM rq")} SELECT coalesce(sum(model_ms), 0) AS model_ms,
        CASE WHEN count(*) = 0 THEN 0 ELSE sum(tool_ms) END AS tool_ms, count(*) AS timed_sessions,
        coalesce(sum(output), 0) AS output FROM runs""", rp)[0]
    srcs = [r["source"] for r in rows(cur, f"{rq} SELECT DISTINCT source FROM rq ORDER BY 1", rp)]
    return dict(model_ms=t["model_ms"], tool_ms=t["tool_ms"], timed_sessions=t["timed_sessions"],
                output_per_s=speed(t["output"], t["model_ms"]), session_sources=srcs)


def sessions(cur, rq, rp, W, fp, prices, on=None):
    """Sessions with requests in the view; every count is limited to the view's range. duration_s is the whole session's
    active time (active_cte), or that of the local days from on[0] to on[1] alone."""
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
               FROM prompts p JOIN sessions s USING (session_id) WHERE {W('p.ts')} GROUP BY 1),
        {active_cte("SELECT session_id FROM agg", on is not None)}
        SELECT s.session_id, s.project, s.git_branch, s.first_ts, s.last_ts, act.active_s AS duration_s,
               s.compactions, s.peak_context, s.peak_model, agg.requests, agg.tokens, agg.cost, agg.unpriced, agg.thinking_ms,
               coalesce(tc.tool_calls, 0) AS tool_calls, coalesce(tc.errors, 0) AS errors, coalesce(tc.commits, 0) AS commits,
               coalesce(tc.tests_passed, 0) AS tests_passed, coalesce(tc.tests_failed, 0) AS tests_failed,
               coalesce(pr.prompts, 0) AS prompts, coalesce(pr.interrupted, 0) AS interrupted
        FROM agg JOIN sessions s USING (session_id) LEFT JOIN tc USING (session_id) LEFT JOIN pr USING (session_id)
        LEFT JOIN act USING (session_id)""", rp + fp + fp + (list(on) if on else []))
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
                 tokens_per_commit=per(r["tokens"], c["commits"]), cost_per_commit=per(r["cost"], c["commits"]) if c["commits"] and r["cost"] is not None else None,
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
    info["active_s"] = (cur.execute(f"WITH {active_cte('?')} SELECT active_s FROM act", [sid, sid]).fetchone() or (None,))[0]
    # Its runs' figures (runs_cte), None without a run: every Codex session. A Grok run states no tool time or lines: None.
    run = rows(cur, f"WITH {runs_cte('?')} SELECT * FROM runs", [sid])
    info["runs"] = dict({k: run[0][k] for k in ("model_ms", "tool_ms", "lines_added", "lines_removed")},
                        output_per_s=speed(run[0]["output"], run[0]["model_ms"])) if run else None
    sums = ", ".join(f"sum({k}) AS {k}" for k in TOKEN_KINDS)
    from . import insights  # insights imports this module
    return dict(
        info=info,
        insight=insights.insight(cur, sid),
        models=rows(cur, f"{allq} SELECT model, coalesce(effort, '(none)') AS effort, subagent, count(*) AS requests, {sums}, "
                         f"sum(tokens) AS tokens, sum(cost) AS cost FROM rq GROUP BY 1, 2, 3 ORDER BY tokens DESC, model, effort, subagent", p),
        timeline=rows(cur, f"{allq} SELECT strftime(date_trunc('minute', ts), '%Y-%m-%dT%H:%M:00Z') AS minute, "
                           f"sum(tokens) AS tokens, sum(cost) AS cost, max({context_of()}) AS context "
                           f"FROM rq GROUP BY 1 ORDER BY 1", p),
        tools=rate_rows(rows(cur, f"""SELECT tool, count(*) AS calls, count(*) FILTER (WHERE is_error) AS errors,
            quantile_cont({latency()}, 0.5) AS p50_ms FROM tool_calls WHERE session_id = ?
            GROUP BY 1 ORDER BY calls DESC, 1""", [sid])),
        commits=rows(cur, """SELECT tool_use_id, start_ts, left(input_summary, 200) AS command FROM tool_calls
            WHERE session_id = ? AND is_commit AND test_passed ORDER BY start_ts""", [sid]),
        prompts=rows(cur, "SELECT count(*) AS prompts, count(*) FILTER (WHERE interrupted) AS interrupted FROM prompts WHERE session_id = ?", [sid])[0],
        error_loops=error_loops(cur, lambda ts: "t.session_id = ?", [sid]),
        **session_timeline(cur, sid, allq, p))


TIMELINE_CAP = 5000  # rows per series in the session timeline; longer sessions keep their first rows


def session_timeline(cur, sid, allq, p):
    """Per-request and per-tool-call rows for the session sheet's timeline, plus compaction times and the first prompt.
    context: the prompt size of each request (context_of), the same measure as sessions.peak_context."""
    reqs = rows(cur, f"""{allq} SELECT ts, model, subagent, {context_of()} AS context, output, cost
        FROM rq ORDER BY ts, message_id LIMIT {TIMELINE_CAP}""", p)
    calls = rows(cur, f"""SELECT tool_use_id AS id, tool, start_ts, end_ts, is_error, category, subagent,
        is_commit AND coalesce(test_passed, false) AS is_commit
        FROM tool_calls WHERE session_id = ? AND coalesce(start_ts, end_ts) IS NOT NULL
        ORDER BY coalesce(start_ts, end_ts), tool_use_id LIMIT {TIMELINE_CAP}""", [sid])
    for r in reqs:
        r["ts"] = iso(r["ts"])
    for c in calls:
        c["start_ts"], c["end_ts"] = iso(c["start_ts"]), iso(c["end_ts"])
    # Each source marks a compaction with a line of its own (Source.compaction): Claude Code with a compact_boundary
    # system line, Codex with a compacted line.
    where, params = store.compaction_filter()
    compactions = [r[0] for r in cur.execute(f"SELECT ts FROM raw_lines WHERE session_id = ? AND {where} ORDER BY ts",
                                             [sid] + params).fetchall()]
    full = titles.first_prompts(cur, [sid]).get(sid)
    return dict(requests=reqs, calls=calls, compaction_ts=compactions, first_prompt=titles.cap_prompt(full),
                first_prompt_cut=bool(full and len(full) > titles.FIRST_PROMPT_CAP), title=titles.titles(cur, [sid]).get(sid, (None,))[0],
                truncated=len(reqs) >= TIMELINE_CAP or len(calls) >= TIMELINE_CAP)
