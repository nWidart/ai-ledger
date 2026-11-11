"""Claude Code's /insights data: the per-session judgments (facets) and figures (session meta) it writes to
~/.claude/usage-data, kept verbatim in usage_files and derived into session_facets, facet_counts and session_meta.

Facets and session meta hold summaries of transcript content: logs name paths and exception types, never file text.
"""
import json
import os
import re
import sys
from datetime import date, datetime, timezone

from . import metrics, store

KINDS = {"facets": "facet", "session-meta": "meta"}  # directory -> usage_files.kind; report*.html is never read
SESSION_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
COUNT_KINDS = {"goal": "goal_categories", "friction": "friction_counts", "satisfaction": "user_satisfaction_counts"}
OUTCOMES = ["fully_achieved", "mostly_achieved", "partially_achieved", "not_achieved", "unclear_from_transcript"]
HELPFULNESS = ["essential", "very_helpful", "moderately_helpful", "slightly_helpful", "unhelpful"]
SESSION_TYPES = ["multi_task", "iterative_refinement", "single_task", "quick_question"]
SESSION_ROWS = 200  # analysed sessions in the payload, newest first; more sets truncated


def files(root):
    """(path, kind) of every facet and session-meta file under root, by path."""
    out = []
    for d, kind in KINDS.items():
        try:
            names = os.listdir(os.path.join(root, d))
        except OSError:
            continue
        out += [(os.path.join(root, d, n), kind) for n in names if n.endswith(".json")]
    return sorted(out)


def parse(path, text):
    """The session id and the JSON object of a usage-data file, or None when it has neither."""
    d = json.loads(text)
    if not isinstance(d, dict):
        return None
    sid = d.get("session_id")
    if not isinstance(sid, str) or not sid:
        stem = os.path.basename(path)[:-len(".json")]
        sid = stem if SESSION_ID.match(stem) else None
    return (sid, d) if sid else None


def ingest(cur, root, projects, log=None):
    """Store and derive every facet and session-meta file under root that changed since the last ingest, in one
    transaction. A missing root gives zero counts. A file that cannot be read, is not a JSON object or has no session id
    is counted as skipped and not retried until it changes."""
    stats = dict(usage_files=0, usage_skipped=0)
    if not root or not os.path.isdir(root):
        return stats
    known = {r[0]: (r[1], r[2]) for r in cur.execute("SELECT path, size, mtime FROM usage_files").fetchall()}
    rows = []
    for path, kind in files(root):
        try:
            st = os.stat(path)
        except OSError:
            continue
        sig = (st.st_size, st.st_mtime)
        if known.get(path) == sig or store.unreadable.get(path) == sig:
            continue
        try:
            with open(path, "rb") as fh:
                text = fh.read().decode("utf-8")
            got = parse(path, text)
        except Exception as e:  # unreadable, not UTF-8 or not JSON: the message could quote the file, so only its type
            got, err = None, type(e).__name__
        else:
            err = "no session id" if got is None else None
        if got is None:
            store.unreadable[path] = sig
            stats["usage_skipped"] += 1
            print(f"ingest: skipped {path}: {err}", file=sys.stderr, flush=True)
            continue
        store.unreadable.pop(path, None)
        rows.append((path, kind, got[0], st.st_size, st.st_mtime, text))
        if log:
            log(f"{path}: {kind}")
    if not rows:
        return stats
    cur.execute("BEGIN")
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        store.insert(cur, "usage_files", ["path", "kind", "session_id", "size", "mtime", "json", "ingested_at"],
                     [r + (now,) for r in rows],
                     tail="ON CONFLICT (path) DO UPDATE SET kind = excluded.kind, session_id = excluded.session_id, size = excluded.size, "
                          "mtime = excluded.mtime, json = excluded.json, ingested_at = excluded.ingested_at")
        derive(cur, [(kind, sid, mtime, text) for _, kind, sid, _, mtime, text in rows], projects)
        cur.execute("COMMIT")
    except BaseException:
        cur.execute("ROLLBACK")
        raise
    stats["usage_files"] = len(rows)
    return stats


def rederive(cur):
    """Derive every stored usage-data file again (rebuild), without reading the usage-data directory."""
    cur.execute("BEGIN")
    try:
        for t in ("session_facets", "facet_counts", "session_meta"):
            cur.execute(f"DELETE FROM {t}")
        derive(cur, cur.execute("SELECT kind, session_id, mtime, json FROM usage_files ORDER BY path").fetchall())
        cur.execute("COMMIT")
    except BaseException:
        cur.execute("ROLLBACK")
        raise


def text_of(v):
    return v if isinstance(v, str) else None


def int_of(v):
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def derive(cur, rows, projects=None):
    """Replace the derived rows of each (kind, session_id, mtime, json) row: a re-derived session keeps no stale counts."""
    projects = projects or store.Projects(cur)
    facets, counts, metas = {}, {}, {}
    for kind, sid, mtime, text in rows:
        try:
            got = parse(sid + ".json", text)
        except ValueError:
            continue
        if got is None:
            continue
        d = got[1]
        if kind == "facet":
            facets[sid] = (sid, text_of(d.get("outcome")), text_of(d.get("claude_helpfulness")), text_of(d.get("session_type")),
                           text_of(d.get("underlying_goal")), text_of(d.get("brief_summary")), text_of(d.get("friction_detail")),
                           text_of(d.get("primary_success")), datetime.fromtimestamp(mtime, timezone.utc).replace(tzinfo=None))
            counts[sid] = [(sid, k, name, n) for k, key in COUNT_KINDS.items() if isinstance(d.get(key), dict)
                           for name, n in d[key].items() if int_of(n) and n > 0]
        elif kind == "meta":
            path = text_of(d.get("project_path"))
            times = [t for t in d.get("user_response_times") or [] if isinstance(t, (int, float)) and not isinstance(t, bool)] \
                if isinstance(d.get("user_response_times"), list) else []
            langs = d.get("languages")
            metas[sid] = (sid, path, projects.get(cur, path) if path else None, store.ts_of(d.get("start_time")),
                          int_of(d.get("duration_minutes")), int_of(d.get("lines_added")), int_of(d.get("lines_removed")),
                          int_of(d.get("files_modified")), int_of(d.get("git_pushes")),
                          json.dumps(langs) if isinstance(langs, dict) else None, text_of(d.get("permission_mode")),
                          metrics.median(times), int_of(d.get("destructive_command_count")), int_of(d.get("bash_would_prompt_count")))
    for table, got in (("session_facets", facets), ("session_meta", metas)):
        ids = list(got)
        for i in range(0, len(ids), 1000):
            chunk = ids[i:i + 1000]
            cur.execute(f"DELETE FROM {table} WHERE session_id IN ({','.join('?' * len(chunk))})", chunk)
            if table == "session_facets":
                cur.execute(f"DELETE FROM facet_counts WHERE session_id IN ({','.join('?' * len(chunk))})", chunk)
    store.insert(cur, "session_facets", ["session_id", "outcome", "helpfulness", "session_type", "underlying_goal", "brief_summary",
                                         "friction_detail", "primary_success", "file_mtime"], list(facets.values()))
    store.insert(cur, "facet_counts", ["session_id", "kind", "name", "n"], [r for rs in counts.values() for r in rs])
    store.insert(cur, "session_meta", ["session_id", "project_path", "project", "start_time", "duration_minutes", "lines_added",
                                       "lines_removed", "files_modified", "git_pushes", "languages", "permission_mode", "response_p50_s",
                                       "destructive_commands", "bash_would_prompt"], list(metas.values()))


# ---------- the Insights page ----------

# Every facet with the project and start time it filters by: its stored session's, else its session meta's.
FACETS = """f AS (SELECT sf.*, coalesce(se.project, m.project, '(unknown)') AS project, 'claude' AS source,
    coalesce(se.first_ts, m.start_time) AS start, se.session_id IS NOT NULL AS in_store
  FROM session_facets sf LEFT JOIN sessions se USING (session_id) LEFT JOIN session_meta m USING (session_id))"""


def ordered(counts, known):
    """[{name, n}]: the known names in their order (zeros included), then any other name by count."""
    rest = sorted(((n, c) for n, c in counts.items() if n not in known), key=lambda x: (-x[1], x[0]))
    return [dict(name=n, n=counts.get(n, 0)) for n in known] + [dict(name=n, n=c) for n, c in rest]


def payload(cur, project="", range_days=0, source="", automated=False, today=None, usage_dir=None):
    """The JSON the Insights page reads. Only Claude Code sessions have facets: source codex returns coverage alone.
    underlying_goal and primary_success stay in the store. Raises ValueError for an unknown source or a negative range."""
    today = today or date.today()
    start, *_ = metrics.view(project, range_days, {}, today, automated, source)
    sql, sp = metrics.scope(project, automated, source)
    W = f"{sql} AND (CAST(? AS DATE) IS NULL OR s.start >= CAST(? AS DATE))"
    wp = sp + [start, start]
    in_view = f"WITH {FACETS}, v AS (SELECT * FROM f s WHERE {W})"
    ssql, ssp = metrics.scope(project, automated, "")
    per_source = dict(cur.execute(f"""SELECT s.source, count(*) FROM sessions s
        WHERE {ssql} AND (CAST(? AS DATE) IS NULL OR s.first_ts >= CAST(? AS DATE)) AND (? = '' OR s.source = ?) GROUP BY 1""",
                                  ssp + [start, start, source, source]).fetchall())
    facets, analysed, orphans = cur.execute(f"{in_view} SELECT count(*), count(*) FILTER (WHERE in_store), "
                                            f"count(*) FILTER (WHERE NOT in_store) FROM v", wp).fetchone()
    claude = per_source.get("claude", 0)
    newest = cur.execute("SELECT max(file_mtime) FROM session_facets").fetchone()[0]
    coverage = dict(claude_sessions=claude, analysed=analysed, not_analysed=max(claude - analysed, 0),
                    codex_sessions=per_source.get("codex", 0), facets=facets, orphans=orphans, newest_facet=metrics.iso(newest),
                    stored_facets=cur.execute("SELECT count(*) FROM session_facets").fetchone()[0], dir=usage_dir)
    facet_projects = [r[0] for r in cur.execute(f"WITH {FACETS} SELECT DISTINCT project FROM f ORDER BY 1").fetchall()]
    projects = metrics.project_list(cur, automated)
    projects += [p for p in facet_projects if p not in projects]
    out = dict(coverage=coverage, projects=projects, outcomes=[], helpfulness=[], session_types=[], satisfaction=[], friction=[],
               goals=[], sessions=[], truncated=False)
    if not facets:
        return out
    by = lambda col: dict(cur.execute(f"{in_view} SELECT {col}, count(*) FROM v WHERE {col} IS NOT NULL GROUP BY 1", wp).fetchall())
    out.update(outcomes=ordered(by("outcome"), OUTCOMES), helpfulness=ordered(by("helpfulness"), HELPFULNESS),
               session_types=ordered(by("session_type"), SESSION_TYPES))
    for kind, key in (("satisfaction", "satisfaction"), ("friction", "friction"), ("goal", "goals")):
        out[key] = metrics.rows(cur, f"""{in_view} SELECT c.name, sum(c.n)::BIGINT AS n, count(DISTINCT c.session_id) AS sessions
            FROM facet_counts c JOIN v USING (session_id) WHERE c.kind = ? GROUP BY 1 ORDER BY 2 DESC, 3 DESC, 1""", wp + [kind])
    names = {}
    for sid, kind, name in cur.execute(f"""{in_view} SELECT c.session_id, c.kind, c.name FROM facet_counts c JOIN v USING (session_id)
            ORDER BY c.session_id, c.kind, c.n DESC, c.name""", wp).fetchall():
        names.setdefault((sid, kind), []).append(name)
    sess = metrics.rows(cur, f"""{in_view} SELECT session_id, project, start, outcome, helpfulness, session_type, brief_summary,
        friction_detail, in_store FROM v ORDER BY start DESC NULLS LAST, session_id LIMIT ?""", wp + [SESSION_ROWS + 1])
    for r in sess[:SESSION_ROWS]:
        r["start"] = metrics.iso(r["start"])
        for kind, key in (("friction", "friction"), ("goal", "goals"), ("satisfaction", "satisfaction")):
            r[key] = names.get((r["session_id"], kind), [])
    out.update(sessions=sess[:SESSION_ROWS], truncated=len(sess) > SESSION_ROWS)
    return out
