"""The Context page's payload: how much context sessions start with, how it grows, what fills it, what that costs, and the
tips the figures give. Everything comes from the derived tables and the price table, through metrics.view as the other pages
do. Token figures from tool result sizes are estimates (bytes / BYTES_PER_TOKEN)."""
from dataclasses import dataclass, field
from typing import Callable

from . import metrics
from .categorize import SHELL_TOOLS

START_MIN_TOKENS = 2000  # a main-thread request with fewer prompt tokens is a side request, not a turn: it did not carry the context
BYTES_PER_TOKEN = 4  # estimated tokens of a tool result: its bytes // this
GROWTH_MAX_TURN = 100  # the growth curve stops at this turn
GROWTH_MIN_SESSIONS = 5  # a curve point needs at least this many sessions
GROWTH_PROJECTS = 5  # the projects that get a curve of their own
FILL_BINS = (0.25, 0.5, 0.75, 0.9)  # peak context as a share of the window: <25%, 25-50%, 50-75%, 75-90%, >=90%
LARGEST_RESULTS = 25  # the largest main-thread tool results listed
CACHE_MIN_PROMPT = 20_000  # a request with fewer prompt tokens is no cache break
CACHE_BREAK_SHARE = 0.5  # a cache break reads less than this share of its prompt from the cache
CACHE_TTL_S = 300  # the prompt cache lives 5 minutes; a longer pause before a break is an expiry
CACHE_TTL_1H_S = 3600  # ... an hour when the previous request wrote 1-hour cache entries
BREAK_SESSIONS = 25  # the sessions with the most uncached tokens listed

START_LARGE_TOKENS = 30_000  # large_start: a project's median starting context
COMPACTIONS_MANY = 3  # frequent_compactions: warn at this many compactions in a session
COMPACTIONS_CRITICAL = 6  # ... critical at this many
RESULT_LARGE_BYTES = 100_000  # large_results: warn at a main-thread result this big
RESULT_HUGE_BYTES = 400_000  # ... critical at this big
CACHE_BREAKS_MANY = 2  # cache_breaks: breaks in one session
LONG_TIER_MIN_USD = 1.0  # long_tier: long-prompt-tier cost at least this
LONG_TIER_SHARE = 0.10  # ... and at least this share of the view's cost
TIP_SESSIONS = 20  # the newest matching sessions a tip lists
TIP_PROJECTS = 5  # large_start names the projects with the largest medians, and counts the rest


# ---------- the shared CTEs ----------

def ctes(rq):
    """rq (metrics.requests_cte) followed by the CTEs every section shares: sess (the view's sessions with their window),
    turns (the main-thread requests of those sessions with at least START_MIN_TOKENS prompt tokens, numbered per session)
    and starts (each session's first turn)."""
    return f"""{rq},
      sess AS (
        SELECT s.session_id, s.project, coalesce(s.source, 'claude') AS source, s.first_ts, s.compactions, s.peak_context,
               s.first_compaction_ts, coalesce(s.context_window, p.context) AS win
        FROM sessions s LEFT JOIN price p ON p.model = s.peak_model
        WHERE s.session_id IN (SELECT session_id FROM rq)),
      turns AS (
        SELECT r.session_id, sess.project, r.message_id, r.ts, r.model, r.input + r.cache_read + r.cache_5m + r.cache_1h AS prompt,
               r.cache_read, r.input, r.cache_1h, row_number() OVER (PARTITION BY r.session_id ORDER BY r.ts, r.message_id) AS turn
        FROM requests r JOIN sess USING (session_id)
        WHERE NOT r.subagent AND r.ts IS NOT NULL AND r.input + r.cache_read + r.cache_5m + r.cache_1h >= {START_MIN_TOKENS}),
      starts AS (SELECT session_id, prompt AS start_prompt, ts AS start_ts FROM turns WHERE turn = 1)"""


def _key(project):
    return (project is None, project or "")


# ---------- starting context ----------

def starting(q):
    stat = lambda by: f"""SELECT {by}count(*) AS sessions, quantile_cont(start_prompt, 0.5) AS median,
        quantile_cont(start_prompt, 0.1) AS p10, quantile_cont(start_prompt, 0.9) AS p90,
        mode(win) AS win, quantile_cont(start_prompt / win, 0.5) AS window_share
        FROM starts JOIN sess USING (session_id)"""
    total = q(stat(""))[0]
    by_project = q(stat("project, ") + " GROUP BY project ORDER BY sessions DESC, project NULLS LAST")
    for r in by_project:
        r["window"] = r.pop("win")
    trend = q(f"""SELECT {metrics.week('first_ts')} AS week, quantile_cont(start_prompt, 0.5) AS median, count(*) AS sessions
        FROM starts JOIN sess USING (session_id) WHERE first_ts IS NOT NULL GROUP BY 1 ORDER BY 1""")
    return dict(sessions=total["sessions"], median=total["median"], p10=total["p10"], p90=total["p90"],
                window_share=total["window_share"], by_project=by_project, trend=trend)


# ---------- growth ----------

def curve_rows(rs):
    return [dict(turn=r["turn"], median=r["median"], p25=r["p25"], p75=r["p75"], sessions=r["sessions"]) for r in rs]


def growth(q):
    point = f"""quantile_cont(prompt, 0.5) AS median, quantile_cont(prompt, 0.25) AS p25, quantile_cont(prompt, 0.75) AS p75,
        count(*) AS sessions FROM turns WHERE turn <= {GROWTH_MAX_TURN}"""
    having = f"HAVING count(*) >= {GROWTH_MIN_SESSIONS}"
    curve = curve_rows(q(f"SELECT turn, {point} GROUP BY turn {having} ORDER BY turn"))
    curves = {}
    for r in q(f"SELECT project, turn, {point} GROUP BY project, turn {having} ORDER BY turn"):
        curves.setdefault(r["project"], []).append(r)
    top = q(f"SELECT project, count(*) AS sessions FROM sess GROUP BY project ORDER BY sessions DESC, project NULLS LAST LIMIT {GROWTH_PROJECTS}")
    by_project_curves = [dict(project=r["project"], sessions=r["sessions"], curve=curve_rows(curves[r["project"]]))
                         for r in top if r["project"] in curves]

    # Tokens added per prompt: the rises between consecutive turns of a session over its prompts; a fall adds nothing.
    per = """per AS (
        SELECT a.session_id, sess.project, a.added / n.prompts AS per_prompt
        FROM (SELECT session_id, sum(greatest(prompt - prev, 0)) AS added
              FROM (SELECT session_id, prompt, lag(prompt) OVER (PARTITION BY session_id ORDER BY turn) AS prev FROM turns)
              WHERE prev IS NOT NULL GROUP BY 1) a
        JOIN (SELECT session_id, count(*) AS prompts FROM prompts GROUP BY 1) n USING (session_id) JOIN sess USING (session_id))"""
    added_total = q("SELECT quantile_cont(per_prompt, 0.5) AS median FROM per", pre=per)[0]["median"]
    added = {r["project"]: r["median"] for r in q("SELECT project, quantile_cont(per_prompt, 0.5) AS median FROM per GROUP BY project", pre=per)}

    # The way to the first compaction: turns and active minutes (the gaps up to IDLE_GAP_S between a session's main-thread
    # requests and tool calls, as metrics.active_cte) before it.
    comp = f"""cs AS (SELECT session_id, project, first_compaction_ts AS fc FROM sess WHERE first_compaction_ts IS NOT NULL),
      ev AS (SELECT session_id, ts AS t FROM requests WHERE NOT subagent AND ts IS NOT NULL
               AND session_id IN (SELECT session_id FROM cs)
             UNION ALL SELECT session_id, coalesce(start_ts, end_ts) FROM tool_calls
               WHERE coalesce(start_ts, end_ts) IS NOT NULL AND session_id IN (SELECT session_id FROM cs)),
      gap AS (SELECT session_id, t, date_diff('millisecond', lag(t) OVER (PARTITION BY session_id ORDER BY t), t) AS ms FROM ev),
      cturns AS (SELECT cs.session_id, count(t.session_id) AS turns FROM cs LEFT JOIN turns t ON t.session_id = cs.session_id AND t.ts < cs.fc
                 GROUP BY 1),
      cact AS (SELECT cs.session_id, coalesce(sum(ms) FILTER (WHERE ms <= {metrics.IDLE_GAP_S * 1000}), 0) / 60000.0 AS minutes
               FROM cs LEFT JOIN gap ON gap.session_id = cs.session_id AND gap.t < cs.fc GROUP BY 1),
      comp AS (SELECT cs.session_id, cs.project, cturns.turns, cact.minutes FROM cs JOIN cturns USING (session_id) JOIN cact USING (session_id))"""
    stat = "count(*) AS sessions, quantile_cont(turns, 0.5) AS turns, quantile_cont(minutes, 0.5) AS minutes FROM comp"
    to_compaction = q(f"SELECT {stat}", pre=comp)[0]
    compacted = {r["project"]: r for r in q(f"SELECT project, {stat} GROUP BY project", pre=comp)}

    counts = q("SELECT project, count(*) AS sessions FROM sess GROUP BY project ORDER BY sessions DESC, project NULLS LAST")
    by_project = []
    for r in counts:
        c = compacted.get(r["project"])
        by_project.append(dict(project=r["project"], sessions=r["sessions"], added_per_prompt=added.get(r["project"]),
                               compacted=c["sessions"] if c else 0, turns_to_compaction=c and c["turns"],
                               minutes_to_compaction=c and c["minutes"]))

    # Peak fill by window: each session's peak context over its window, binned at FILL_BINS.
    over = " + ".join(f"CAST(peak_context / win >= {b} AS INTEGER)" for b in FILL_BINS)
    fill = {}
    for r in q(f"SELECT win, {over} AS bin, count(*) AS n FROM sess WHERE win IS NOT NULL AND peak_context IS NOT NULL GROUP BY 1, 2"):
        fill.setdefault(r["win"], [0] * (len(FILL_BINS) + 1))[r["bin"]] = r["n"]
    return dict(curve=curve, by_project_curves=by_project_curves, added_per_prompt=added_total, by_project=by_project,
                to_compaction=to_compaction, fill=[dict(window=w, sessions=sum(b), bins=b) for w, b in sorted(fill.items())])


# ---------- what fills context ----------

def fill_rows(rs):
    for r in rs:
        r["est_tokens"] = r["bytes"] // BYTES_PER_TOKEN
        r["p50_bytes"] = None if r["p50_bytes"] is None else round(r["p50_bytes"])
    return rs


def fills(cur, W, fp):
    calls = f"tool_calls t JOIN sessions s USING (session_id) WHERE {W('coalesce(t.start_ts, t.end_ts)')}"
    one = lambda by, extra: metrics.rows(cur, f"""SELECT {by} AS name, count(*) AS calls, count(t.result_bytes) AS with_bytes,
        sum(t.result_bytes) AS bytes, quantile_cont(t.result_bytes, 0.5) AS p50_bytes, max(t.result_bytes) AS max_bytes
        FROM {calls} AND NOT t.subagent {extra} GROUP BY 1 HAVING count(t.result_bytes) > 0 ORDER BY bytes DESC, name""", fp)
    tools = fill_rows(one("t.tool", ""))
    mcp = fill_rows(one("t.mcp_server", "AND t.mcp_server IS NOT NULL"))
    main, sub = metrics.rows(cur, f"""SELECT coalesce(sum(t.result_bytes) FILTER (WHERE NOT t.subagent), 0) AS main_bytes,
        coalesce(sum(t.result_bytes) FILTER (WHERE t.subagent), 0) AS subagent_bytes FROM {calls}""", fp)[0].values()
    largest = metrics.rows(cur, f"""SELECT t.tool_use_id AS id, t.session_id, s.project, coalesce(s.source, 'claude') AS source, t.tool,
        t.mcp_server, left(coalesce(t.input_summary, ''), 200) AS input, t.result_bytes AS bytes,
        coalesce(t.start_ts, t.end_ts) AS ts FROM {calls} AND NOT t.subagent AND t.result_bytes IS NOT NULL
        ORDER BY t.result_bytes DESC, t.tool_use_id LIMIT {LARGEST_RESULTS}""", fp)
    for r in largest:
        r["est_tokens"] = r["bytes"] // BYTES_PER_TOKEN
        r["ts"] = metrics.iso(r["ts"])
    return dict(main_bytes=main, subagent_bytes=sub, tools=tools, mcp=mcp, largest=largest)


# ---------- cost and cache breaks ----------

def cost(q):
    sums = """sum(cost) AS cost, sum(cost_cache_read) AS cache_read_cost, sum(cost) FILTER (WHERE lg) AS long_cost,
        count(*) FILTER (WHERE lg) AS long_requests, sum(cache_read) AS cache_read,
        sum(input + cache_read + cache_5m + cache_1h) AS prompt_tokens FROM rq"""
    total = q(f"SELECT {sums}")[0]
    by_project = q(f"SELECT project, {sums} GROUP BY project ORDER BY cost DESC NULLS LAST, project NULLS LAST")
    for r in by_project:
        r["cache_hit_ratio"] = r["cache_read"] / r["prompt_tokens"] if r["prompt_tokens"] else None
    return dict(cost=total["cost"], cache_read_cost=total["cache_read_cost"], long_cost=total["long_cost"],
                long_requests=total["long_requests"], cache_hit_ratio=total["cache_read"] / total["prompt_tokens"] if total["prompt_tokens"] else None,
                by_project=by_project)


def session_breaks(q):
    """Every session with a cache break (a main-thread turn after the first with at least CACHE_MIN_PROMPT prompt tokens, less than
    CACHE_BREAK_SHARE of them read from the cache) in the view's range, most uncached tokens first."""
    pre = f"""lagged AS (SELECT session_id, message_id, model, ts, prompt, input, cache_read, turn,
          lag(model) OVER w AS prev_model, lag(ts) OVER w AS prev_ts, lag(cache_1h) OVER w AS prev_1h FROM turns WINDOW w AS (PARTITION BY session_id ORDER BY turn)),
        brk AS (SELECT l.session_id, l.prompt - l.cache_read AS uncached, rq.cost_input + rq.cost_cache_5m + rq.cost_cache_1h AS uncached_cost,
            CASE WHEN l.model <> l.prev_model THEN 'model_switch'
                 WHEN date_diff('second', l.prev_ts, l.ts) > CASE WHEN l.prev_1h > 0 THEN {CACHE_TTL_1H_S} ELSE {CACHE_TTL_S} END THEN 'expired' ELSE 'other' END AS cause
          FROM lagged l JOIN rq ON rq.message_id = l.message_id
          WHERE l.turn > 1 AND l.prompt >= {CACHE_MIN_PROMPT} AND l.cache_read < {CACHE_BREAK_SHARE} * l.prompt)"""
    return q("""SELECT sess.session_id, sess.project, sess.source, sess.first_ts, count(*) AS breaks,
          count(*) FILTER (WHERE cause = 'model_switch') AS model_switch, count(*) FILTER (WHERE cause = 'expired') AS expired,
          count(*) FILTER (WHERE cause = 'other') AS other, sum(brk.uncached) AS uncached_tokens, sum(brk.uncached_cost) AS cost
        FROM brk JOIN sess USING (session_id) GROUP BY ALL ORDER BY uncached_tokens DESC, session_id""", pre=pre)


# ---------- coverage ----------

NO_RESULT_TEXT = ("apply_patch", "web_search")  # Codex tools whose items carry no result text, so never a size


def coverage(cur, q, W, fp):
    s = q("""SELECT count(*) AS sessions, count(win) AS with_window, count(*) FILTER (WHERE compactions > 0) AS compacted,
        count(*) FILTER (WHERE compactions > 0 AND first_compaction_ts IS NOT NULL) AS with_first_compaction FROM sess""")[0]
    # Calls that completed and could carry a size; a call still running, a failed Codex MCP call or a Codex file change has none.
    t = metrics.rows(cur, f"""SELECT count(*) AS calls, count(t.result_bytes) AS with_bytes FROM tool_calls t JOIN sessions s USING (session_id)
        WHERE {W('coalesce(t.start_ts, t.end_ts)')} AND t.end_ts IS NOT NULL AND NOT coalesce(t.is_error, false) AND t.tool NOT IN ({",".join("?" * len(NO_RESULT_TEXT))})""",
                     fp + list(NO_RESULT_TEXT))[0]
    return dict(**s, **t, rebuild_needed=t["with_bytes"] < t["calls"] or s["with_first_compaction"] < s["compacted"])


# ---------- tips ----------

tokens = lambda n: f"{round(n):,} tokens"
percent = lambda x: f"{x:.0%}"
usd = lambda x: f"${x:,.2f}"
counted = lambda pairs: ", ".join(f"{name} {n:,}" for name, n in pairs)


@dataclass
class Ctx:
    """What a rule sees: the computed sections, the full list of sessions with cache breaks, and a way to ask more of the store."""
    cur: object
    q: Callable
    shared: str
    rp: list
    W: Callable
    fp: list
    prices: dict
    data: dict
    breaks: list
    memo: dict = field(default_factory=dict)

    def once(self, key, fn):
        if key not in self.memo:
            self.memo[key] = fn()
        return self.memo[key]

    def calls(self, extra, params=()):
        """The view's tool calls (t, with their session s) that also match extra, an SQL condition; returns rows of the columns tool, mcp_server, result_bytes."""
        return metrics.rows(self.cur, f"""SELECT t.tool, t.mcp_server, t.result_bytes FROM tool_calls t JOIN sessions s USING (session_id)
            WHERE {self.W('coalesce(t.start_ts, t.end_ts)')} AND NOT t.subagent AND {extra}""", self.fp + list(params))


@dataclass(frozen=True)
class Rule:
    """One tip. severity(ctx) is None when the rule does not fire, else "warn" or "critical"; matching(ctx) is an SQL condition over
    sess (alias x) for the sessions that match the rule, with its params."""
    id: str
    title: str
    severity: Callable
    evidence: Callable
    advice: Callable
    matching: Callable


def project_match(names, alias="x"):
    """(SQL, params): the project of alias is one of names (None is the sessions with no project)."""
    return f"(list_contains(?, {alias}.project) OR (? AND {alias}.project IS NULL))", [[n for n in names if n is not None] or [""], None in names]


# large_start
def large_projects(ctx):
    return [r for r in ctx.data["starting"]["by_project"] if r["median"] >= START_LARGE_TOKENS]


def called_servers(ctx):
    """The MCP servers called on the main thread in the large-start projects, with their calls, fewest first."""
    def run():
        names = [r["project"] for r in large_projects(ctx)]
        match, params = project_match(names, "s")
        return metrics.rows(ctx.cur, f"""SELECT t.mcp_server AS name, count(*) AS calls FROM tool_calls t JOIN sessions s USING (session_id)
            WHERE {ctx.W('coalesce(t.start_ts, t.end_ts)')} AND NOT t.subagent AND t.mcp_server IS NOT NULL AND {match}
            GROUP BY 1 ORDER BY calls, name""", ctx.fp + params)
    return ctx.once("servers", run)


def large_start_evidence(ctx):
    out, projects = [], sorted(large_projects(ctx), key=lambda r: (-r["median"], r["project"] or ""))
    for r in projects[:TIP_PROJECTS]:
        value = f"median {tokens(r['median'])}, 10th percentile {tokens(r['p10'])}"
        if r["window_share"] is not None:
            value += f", {percent(r['window_share'])} of the window"
        out.append(dict(label=r["project"] or "(no project)", value=value))
    if len(projects) > TIP_PROJECTS:
        out.append(dict(label="Other projects", value=f"{len(projects) - TIP_PROJECTS:,} more at {tokens(START_LARGE_TOKENS)} or over"))
    servers = called_servers(ctx)
    out.append(dict(label="MCP servers called (fewest calls first)", value=counted((r["name"], r["calls"]) for r in servers) if servers else "none"))
    return out


LARGE_START_ADVICE = ("Trim `CLAUDE.md` or `AGENTS.md` and the files they import, and review the MCP servers configured for the project: "
                      "every server's tool schemas are in every prompt. Servers configured but never called leave no trace in transcripts, "
                      "so the list above shows only the MCP servers that were called; compare it with your `.mcp.json` or `claude mcp list`.")


def large_start_match(ctx):
    match, params = project_match([r["project"] for r in large_projects(ctx)])
    return f"x.session_id IN (SELECT session_id FROM starts WHERE start_prompt >= ?) AND {match}", [START_LARGE_TOKENS, *params]


# frequent_compactions
def compaction_facts(ctx):
    return ctx.once("compactions", lambda: ctx.q("SELECT count(*) AS n, max(compactions) AS most FROM sess WHERE compactions >= ?",
                                                 [COMPACTIONS_MANY])[0])


def compactions_severity(ctx):
    f = compaction_facts(ctx)
    return None if not f["n"] else "critical" if f["most"] >= COMPACTIONS_CRITICAL else "warn"


def compactions_evidence(ctx):
    f, to = compaction_facts(ctx), ctx.data["growth"]["to_compaction"]
    out = [dict(label="Sessions", value=f"{f['n']:,}"), dict(label="Most compactions in one session", value=str(f["most"]))]
    if to["turns"] is not None:
        out.append(dict(label="Median turns before the first compaction (compacted sessions with a known first compaction)", value=f"{round(to['turns']):,}"))
    if to["minutes"] is not None:
        out.append(dict(label="Median active minutes before the first compaction (compacted sessions with a known first compaction)", value=f"{round(to['minutes']):,}"))
    return out


COMPACTIONS_ADVICE = ("Start a new session or `/clear` between tasks; `/compact` before the context fills, while the summary is still cheap; "
                      "hand bulk reading to a subagent, so it compacts there and not in the main thread.")


# near_limit
def near_facts(ctx):
    return ctx.once("near", lambda: ctx.q("""SELECT count(*) AS n, max(peak_context / win) AS top, list(DISTINCT win ORDER BY win) AS wins FROM sess
        WHERE win IS NOT NULL AND peak_context IS NOT NULL AND peak_context / win >= ?""", [metrics.NEAR_LIMIT])[0])


def near_evidence(ctx):
    f = near_facts(ctx)
    return [dict(label="Sessions", value=f"{f['n']:,}"), dict(label="Highest share of the window", value=percent(f["top"])),
            dict(label="Windows", value=", ".join(tokens(w) for w in f["wins"]))]


NEAR_ADVICE = "Start the next task in a new session: the last 20% of the window costs the most and compacts the worst."


# large_results
def large_results(ctx):
    return ctx.once("large", lambda: ctx.calls("t.result_bytes >= ?", [RESULT_LARGE_BYTES]))


def large_results_evidence(ctx):
    rs = large_results(ctx)
    tools, servers = {}, {}
    for r in rs:
        tools[r["tool"]] = tools.get(r["tool"], 0) + 1
        if r["mcp_server"]:
            servers[r["mcp_server"]] = servers.get(r["mcp_server"], 0) + 1
    order = lambda d: sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))
    out = [dict(label="Results", value=f"{len(rs):,}"),
           dict(label="Estimated tokens", value=f"about {sum(r['result_bytes'] for r in rs) // BYTES_PER_TOKEN:,} tokens (estimate)"),
           dict(label="Tools", value=counted(order(tools)))]
    if servers:
        out.append(dict(label="MCP servers", value=counted(order(servers))))
    return out


def large_results_advice(ctx):
    rs = large_results(ctx)
    tools = {r["tool"] for r in rs}
    lines = []
    if "Read" in tools:
        lines.append("Use `Read` with `offset` and `limit` to take only the part you need.")
    if tools & SHELL_TOOLS:
        lines.append("Pipe shell output through `head`, `tail` or `grep`.")
    if tools & {"Grep", "Glob"}:
        lines.append("Cap search results with `head_limit`, or list file names only with `-l`.")
    if any(r["mcp_server"] for r in rs):
        lines.append("Ask MCP tools for a smaller page (a page size or limit argument).")
    lines.append("Hand bulk reading to a subagent, which returns a short report.")
    return " ".join(lines)


def large_results_match(ctx):
    return (f"x.session_id IN (SELECT t.session_id FROM tool_calls t JOIN sessions s USING (session_id) WHERE "
            f"{ctx.W('coalesce(t.start_ts, t.end_ts)')} AND NOT t.subagent AND t.result_bytes >= ?)", ctx.fp + [RESULT_LARGE_BYTES])


# cache_breaks
def break_sessions(ctx):
    return [b for b in ctx.breaks if b["breaks"] >= CACHE_BREAKS_MANY]


def break_causes(ctx):
    bs = break_sessions(ctx)
    return {k: sum(b[k] for b in bs) for k in ("model_switch", "expired", "other")}


def cache_breaks_evidence(ctx):
    bs, causes, cost = break_sessions(ctx), break_causes(ctx), [b["cost"] for b in break_sessions(ctx) if b["cost"] is not None]
    out = [dict(label="Sessions", value=f"{len(bs):,}"),
           dict(label="Breaks by cause", value=f"{causes['model_switch']:,} model switches, {causes['expired']:,} expired, {causes['other']:,} other"),
           dict(label="Uncached tokens", value=tokens(sum(b["uncached_tokens"] for b in bs)))]
    if cost:
        out.append(dict(label="Cost of their uncached input", value=usd(sum(cost))))
    ratio = ctx.data["cost"]["cache_hit_ratio"]
    if ratio is not None:
        out.append(dict(label="Cache-hit ratio of the view", value=percent(ratio)))
    return out


def cache_breaks_advice(ctx):
    causes = break_causes(ctx)
    top = max(causes, key=lambda k: causes[k])  # a tie goes to the first in the order model_switch, expired, other
    if top == "model_switch":
        return "Keep one model through a session: a switch rereads the whole context uncached and writes a new cache."
    if top == "expired":
        return ("Turns more than 5 minutes apart reread the context: that is the cache lifetime, not a mistake, and the figure above is "
                "what it costs. Keep turns within it, or accept the cost.")
    return "Something before the cached part of the prompt changed (the system prompt, the tool set, an edited earlier message)."


# long_tier
def long_tier_facts(ctx):
    c = ctx.data["cost"]
    if c["long_cost"] is None or not c["cost"]:
        return None
    ok = c["long_cost"] >= LONG_TIER_MIN_USD and c["long_cost"] / c["cost"] >= LONG_TIER_SHARE
    return c["long_cost"] / c["cost"] if ok else None


def long_tier_evidence(ctx):
    c, share = ctx.data["cost"], long_tier_facts(ctx)
    models = ctx.once("long_models", lambda: ctx.q("SELECT model, count(*) AS n FROM rq WHERE lg GROUP BY 1 ORDER BY n DESC, model"))
    limits = [(m["model"], (ctx.prices.get(m["model"]) or {}).get("long_above")) for m in models]
    return [dict(label="Long-prompt-tier cost", value=usd(c["long_cost"])), dict(label="Share of the estimated cost", value=percent(share)),
            dict(label="Long-tier requests", value=f"{c['long_requests']:,}"),
            dict(label="Long-prompt thresholds", value=", ".join(f"{m} {tokens(a)}" for m, a in limits if a))]


LONG_TIER_ADVICE = ("`/compact` or start a new session before the prompt passes the model's threshold: every token of the request is "
                    "priced higher once it does.")

RULES = (
    Rule("large_start", "Sessions start with a large context", lambda c: "warn" if large_projects(c) else None,
         large_start_evidence, lambda c: LARGE_START_ADVICE, large_start_match),
    Rule("frequent_compactions", "Sessions compact repeatedly", compactions_severity, compactions_evidence,
         lambda c: COMPACTIONS_ADVICE, lambda c: ("x.compactions >= ?", [COMPACTIONS_MANY])),
    Rule("near_limit", "Sessions reach the limit of the window", lambda c: "critical" if near_facts(c)["n"] else None,
         near_evidence, lambda c: NEAR_ADVICE,
         lambda c: ("x.win IS NOT NULL AND x.peak_context IS NOT NULL AND x.peak_context / x.win >= ?", [metrics.NEAR_LIMIT])),
    Rule("large_results", "Tool results fill the context", lambda c: ("critical" if any(r["result_bytes"] >= RESULT_HUGE_BYTES for r in large_results(c))
                                                                        else "warn") if large_results(c) else None,
         large_results_evidence, large_results_advice, large_results_match),
    Rule("cache_breaks", "The prompt cache breaks within sessions", lambda c: "warn" if break_sessions(c) else None,
         cache_breaks_evidence, cache_breaks_advice,
         lambda c: ("list_contains(?, x.session_id)", [[b["session_id"] for b in break_sessions(c)]])),
    Rule("long_tier", "Requests are priced on the long-prompt tier", lambda c: "warn" if long_tier_facts(c) is not None else None,
         long_tier_evidence, lambda c: LONG_TIER_ADVICE, lambda c: ("x.session_id IN (SELECT session_id FROM rq WHERE lg)", [])),
)


def tips(ctx):
    """The tips whose rules fire on the view, critical first, then in RULES order. Each lists its TIP_SESSIONS newest matching sessions
    (titles are added by the caller) and how many match in all."""
    fired = []
    for i, rule in enumerate(RULES):
        severity = rule.severity(ctx)
        if severity is None:
            continue
        where, params = rule.matching(ctx)
        got = ctx.q(f"""SELECT x.session_id, x.project, x.source, x.first_ts, count(*) OVER () AS matched FROM sess x WHERE {where}
            ORDER BY x.first_ts DESC NULLS LAST, x.session_id LIMIT {TIP_SESSIONS}""", params)
        sessions = [dict(session_id=r["session_id"], project=r["project"], source=r["source"], first_ts=metrics.iso(r["first_ts"])) for r in got]
        fired.append((severity != "critical", i, dict(id=rule.id, severity=severity, title=rule.title, evidence=rule.evidence(ctx),
                                                       advice=rule.advice(ctx), sessions=sessions, matched=got[0]["matched"] if got else 0)))
    return [tip for _, _, tip in sorted(fired, key=lambda f: f[:2])]


# ---------- the payload ----------

def payload(cur, project="", range_days=0, source="", automated=False, today=None, prices=None):
    """The Context page payload (see design D9). Raises ValueError for a bad source or a negative range."""
    prices = metrics.load_prices() if prices is None else prices
    today = today or metrics.local_today(cur)
    af = metrics.automated_file()
    start, _, _, fp, W, rq, rp = metrics.view(project, range_days, prices, today, automated, source, af["projects"])
    shared = ctes(rq)

    def q(sql, params=(), pre=""):
        """A query over the shared CTEs, plus the CTEs in pre (SQL text of more CTEs)."""
        head = f"{shared}, {pre}" if pre else shared
        return metrics.rows(cur, f"{head} {sql}", rp + list(params))

    data = dict(project=project, range=range_days, automated=bool(automated), source=source,
                start=start.isoformat() if start else None, end=today.isoformat(),
                projects=metrics.project_list(cur, automated, af["projects"]), project_order=metrics.project_order(cur, af["projects"]),
                automated_file=af, coverage=coverage(cur, q, W, fp), starting=starting(q), growth=growth(q), fills=fills(cur, W, fp))
    brk = session_breaks(q)
    data["cost"] = dict(cost(q), break_sessions=len(brk), breaks=[{k: v for k, v in r.items() if k != "first_ts"} for r in brk[:BREAK_SESSIONS]])
    data["tips"] = tips(Ctx(cur, q, shared, rp, W, fp, prices, data, brk))
    # One title lookup for every session row on the payload: it reads the first prompt of each session that has no title.
    metrics.with_titles(cur, [*data["fills"]["largest"], *data["cost"]["breaks"], *(x for t in data["tips"] for x in t["sessions"])])
    return data
