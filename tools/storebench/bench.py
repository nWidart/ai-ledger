"""Store benchmark: the size of a store after it ingests a corpus of real transcripts the way the app does, in rounds
as the files grow, and proof that the store still holds and serves the same thing.

    uv run python tools/storebench/bench.py [--data DIR] [--make-ref]

The last line of output is the score: the bytes of the store file (and its write-ahead log) after the last ingest.
The run fails (exit 1) when anything differs from the reference a run with --make-ref wrote from the code of `main`:

- raw: every stored line's key, columns and exact text (store.raw_rows(cur) when the store defines it, else raw_lines.json)
- derived: every row of every derived table, after ingest and again after a rebuild
- payloads: what the pages read (sessions, prompts, errors, usage, the Live stream with its text)
- an older store: the reference run's store, taken before the last round, opened by this code, then given the last
  round. It must end the same. When the store defines compact(path), the compacted old store must also be no larger
  than 1.15 times the fresh one.
- time: ingest, payloads and rebuild each within 3 times the reference plus 3 seconds

The corpus is real transcript text. Nothing here prints it: only digests, sizes and seconds.
"""
import argparse
import hashlib
import json
import math
import os
import shutil
import sys
import time
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "src"))

from ai_ledger import live, metrics, store  # noqa: E402

ROUNDS = 6
TODAY = date(2026, 11, 12)
RAW_COLS = "key, file, line_no, byte_offset, type, session_id, uuid, ts, subagent, parsed, json"
DERIVED = ("sessions", "requests", "tool_calls", "prompts", "hooks", "limit_snapshots", "session_titles")
SESSIONS = 30  # sessions whose pages are read


def corpus_files(data):
    out = []
    for source in ("claude", "codex"):
        root = os.path.join(data, source)
        for folder, _, names in os.walk(root):
            out += [(source, os.path.relpath(os.path.join(folder, n), root)) for n in names if n.endswith(".jsonl")]
    return sorted(out)


def cuts(path):
    """The byte length of the file's prefix each round holds: whole lines, near r/ROUNDS of its lines."""
    ends, pos = [], 0
    with open(path, "rb") as fh:
        for line in fh:
            pos += len(line)
            ends.append(pos)
    return [ends[max(1, -(-len(ends) * r // ROUNDS)) - 1] if ends else 0 for r in range(1, ROUNDS + 1)]


def grow(data, roots, files, plan, r):
    """Append round r's bytes (1-based) to every file under roots."""
    for source, rel in files:
        start, end = (plan[source, rel][r - 2] if r > 1 else 0), plan[source, rel][r - 1]
        if end <= start:
            continue
        target = os.path.join(roots[source], rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(os.path.join(data, source, rel), "rb") as src, open(target, "ab") as out:
            src.seek(start)
            out.write(src.read(end - start))


def size_of(path):
    return sum(os.path.getsize(p) for p in (path, path + ".wal") if os.path.exists(p))


def digest(rows):
    h = hashlib.sha256()
    for r in sorted(repr(r) for r in rows):
        h.update(r.encode("utf-8", "surrogatepass"))
        h.update(b"\n")
    return h.hexdigest()


def raw_digest(cur, work):
    rows = store.raw_rows(cur) if hasattr(store, "raw_rows") else cur.execute(f"SELECT {RAW_COLS} FROM raw_lines").fetchall()
    out = []
    n = 0
    for r in rows:
        r = list(r)
        r[1] = r[1].replace(work, "")
        if isinstance(r[0], str):
            r[0] = r[0].replace(work, "")
        r[10] = hashlib.sha256(r[10].encode("utf-8", "surrogatepass")).hexdigest()
        out.append(tuple(r))
        n += 1
    return n, digest(out)


def derived_digest(cur, work):
    out = {}
    for t in DERIVED:
        rows = cur.execute(f"SELECT * FROM {t}").fetchall()
        out[t] = [len(rows), digest(tuple(x.replace(work, "") if isinstance(x, str) else x for x in r) for r in rows)]
    return out


def canonical(x):
    """x with every list sorted: the pages' queries leave the order of ties to chance, so two runs of the same code differ."""
    if isinstance(x, dict):
        return {k: canonical(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return sorted((canonical(v) for v in x), key=lambda v: json.dumps(coarse(v), sort_keys=True, default=str))
    return x


def coarse(x):
    """x with its floats rounded to 3 digits, as a sort key: the last digits of a sum change with the order of its rows."""
    if isinstance(x, dict):
        return {k: coarse(v) for k, v in x.items()}
    if isinstance(x, list):
        return [coarse(v) for v in x]
    return float(f"{x:.3g}") if isinstance(x, float) else x


def dump(x):
    """[digest of x without its floats, the floats in order]: floats are compared within a tolerance, not by digest."""
    floats = []

    def strip(v):
        if isinstance(v, dict):
            return {k: strip(w) for k, w in sorted(v.items())}
        if isinstance(v, list):
            return [strip(w) for w in v]
        if isinstance(v, float):
            floats.append(v)
            return "<float>"
        return v
    body = strip(canonical(json.loads(json.dumps(x, default=str))))
    return [hashlib.sha256(json.dumps(body, sort_keys=True).encode("utf-8", "surrogatepass")).hexdigest(), floats]


def same(mine, theirs):
    """Whether two digests, or two dicts of dump() results, agree; floats within 1e-6 of each other."""
    if isinstance(mine, dict) and isinstance(theirs, dict):
        return mine.keys() == theirs.keys() and all(same(mine[k], theirs[k]) for k in mine)
    if isinstance(mine, list) and len(mine) == 2 and isinstance(mine[1], list) and isinstance(theirs, list) and len(theirs) == 2:
        return mine[0] == theirs[0] and len(mine[1]) == len(theirs[1]) and all(
            math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-9) for a, b in zip(mine[1], theirs[1]))
    return mine == theirs


def payloads(cur):
    """Digests of what the pages read. Every time-dependent argument is fixed."""
    prices = metrics.load_prices()
    sids = [r[0] for r in cur.execute("SELECT session_id FROM sessions ORDER BY last_ts DESC, session_id").fetchall()]
    last = cur.execute("SELECT max(last_ts) FROM sessions").fetchone()[0]
    now = (last + timedelta(minutes=1)).replace(tzinfo=timezone.utc) if last else datetime(2026, 11, 12, tzinfo=timezone.utc)
    errors = [r[0] for r in cur.execute("SELECT tool_use_id FROM tool_calls WHERE is_error ORDER BY tool_use_id LIMIT 80").fetchall()]
    out = dict(
        usage=dump(metrics.usage(cur, prices=prices, today=TODAY)),
        usage_week=dump(metrics.usage(cur, range_days=7, prices=prices, today=TODAY)),
        errors=dump(metrics.errors_payload(cur, None, today=TODAY)),
        session_list=dump(metrics.session_list(cur, prices=prices, today=TODAY, limit=500)),
        search=dump(metrics.session_list(cur, q="fix", prices=prices, today=TODAY, limit=500)),
        palette=dump(metrics.palette(cur, today=TODAY)),
        tool=dump(metrics.tool_detail(cur, "tool", "Bash", today=TODAY)),
        live=dump(live.sessions(cur, now=now, prices=prices, text=True)),
        error_detail=dump([metrics.error_detail(cur, e) for e in errors]),
        session=dump([metrics.session(cur, s, prices=prices) for s in sids[:SESSIONS]]),
        prompt=dump([metrics.first_prompt(cur, s, cap=None) for s in sids[:3 * SESSIONS]]),
        stream=dump([live.session(cur, s, text=True, now=now, prices=prices) for s in sids[:SESSIONS]]),
        stream_plain=dump([live.session(cur, s, text=False, now=now, prices=prices) for s in sids[:10]]),
    )
    return out


def run(data, make_ref):
    work = os.path.join(data, "work") + os.sep
    ref_path, old = os.path.join(data, "ref.json"), os.path.join(data, "old.duckdb")
    shutil.rmtree(work, ignore_errors=True)
    roots = dict(claude=os.path.join(work, "claude"), codex=os.path.join(work, "codex"))
    for d in roots.values():
        os.makedirs(d)
    # Fixed for every run: no git lookup of folders that come and go, no user files beside the real store.
    store.resolve_project = lambda cwd: os.path.basename((cwd or "").rstrip("/")) or "(unknown)"
    metrics.USER_PRICES = metrics.USER_AUTOMATED = os.path.join(work, "none.json")
    files = corpus_files(data)
    plan = {(s, rel): cuts(os.path.join(data, s, rel)) for s, rel in files}
    got, seconds = {}, {}

    db = os.path.join(work, "bench.duckdb")
    con = store.open_store(db)
    t = time.time()
    for r in range(1, ROUNDS):
        grow(data, roots, files, plan, r)
        store.ingest(con, roots, usage=False)
    con.close()
    if make_ref:
        shutil.copy(db, old)
    con = store.open_store(db)
    grow(data, roots, files, plan, ROUNDS)
    store.ingest(con, roots, usage=False)
    con.close()
    seconds["ingest"] = time.time() - t
    size = size_of(db)

    con = store.open_store(db)
    cur = con.cursor()
    got["lines"], got["raw"] = raw_digest(cur, work)
    got["derived"] = derived_digest(cur, work)
    t = time.time()
    got["payloads"] = payloads(cur)
    seconds["payloads"] = time.time() - t
    t = time.time()
    store.rebuild(con)
    seconds["rebuild"] = time.time() - t
    cur = con.cursor()
    got["rebuilt"] = derived_digest(cur, work)
    got["rebuilt_payloads"] = payloads(cur)
    got["rebuilt_lines"] = list(raw_digest(cur, work))
    con.close()

    if make_ref:
        with open(ref_path, "w") as fh:
            json.dump(dict(got=got, seconds=seconds, size=size), fh, indent=1, sort_keys=True)
        print(f"reference written: {got['lines']} lines, {size / 1e6:.1f} MB, " + ", ".join(f"{k} {v:.1f}s" for k, v in seconds.items()))
        print(size)
        return 0

    with open(ref_path) as fh:
        ref = json.load(fh)
    with open(os.path.join(HERE, "expected.json")) as fh:
        expected = json.load(fh).get(os.path.basename(os.path.normpath(data)))
    with open(ref_path, "rb") as fh:
        failures = [] if hashlib.sha256(fh.read()).hexdigest() == expected else ["the reference is not the one this check was locked with"]

    def compare(name, mine, theirs):
        mine = json.loads(json.dumps(mine))
        if not same(mine, theirs):
            parts = [k for k in mine if not same(mine[k], theirs.get(k))] if isinstance(mine, dict) and isinstance(theirs, dict) else []
            failures.append(f"{name} differs from the reference" + (f": {', '.join(parts)}" if parts else ""))

    for k in ("lines", "raw", "derived", "payloads", "rebuilt", "rebuilt_payloads", "rebuilt_lines"):
        compare(k, got[k], ref["got"][k])

    # An older store, made by the reference code before the last round: open it, give it the last round.
    # The files are written again at their full length: the old store holds each one's read position, so ingest reads the rest.
    shutil.rmtree(work, ignore_errors=True)
    for r in range(1, ROUNDS + 1):
        grow(data, roots, files, plan, r)
    shutil.copy(old, db)
    t = time.time()
    con = store.open_store(db)
    seconds["open_old"] = time.time() - t
    store.ingest(con, roots, usage=False)
    cur = con.cursor()
    n, raw = raw_digest(cur, work)
    compare("old store: lines", n, ref["got"]["lines"])
    compare("old store: raw", raw, ref["got"]["raw"])
    compare("old store: derived", derived_digest(cur, work), ref["got"]["derived"])
    compare("old store: payloads", payloads(cur), ref["got"]["payloads"])
    con.close()
    old_size = size_of(db)
    if hasattr(store, "compact"):
        t = time.time()
        store.compact(db)
        seconds["compact"] = time.time() - t
        old_size = size_of(db)
        con = store.open_store(db)
        cur = con.cursor()
        compare("compacted old store: raw", raw_digest(cur, work)[1], ref["got"]["raw"])
        compare("compacted old store: derived", derived_digest(cur, work), ref["got"]["derived"])
        compare("compacted old store: payloads", payloads(cur), ref["got"]["payloads"])
        con.close()
        if old_size > 1.15 * size:
            failures.append(f"compacted old store is {old_size / 1e6:.1f} MB, over 1.15 times the fresh store's {size / 1e6:.1f} MB")

    for k in ("ingest", "payloads", "rebuild"):
        if seconds[k] > 3 * ref["seconds"][k] + 3:
            failures.append(f"{k} took {seconds[k]:.1f}s, over 3 times the reference's {ref['seconds'][k]:.1f}s plus 3s")

    print(f"lines {got['lines']}  fresh store {size / 1e6:.2f} MB (reference {ref['size'] / 1e6:.2f} MB)  old store after open"
          f"{' and compact' if hasattr(store, 'compact') else ''} {old_size / 1e6:.2f} MB")
    print("seconds: " + ", ".join(f"{k} {v:.1f}" + (f" (reference {ref['seconds'][k]:.1f})" if k in ref["seconds"] else "") for k, v in seconds.items()))
    for f in failures:
        print("FAIL: " + f)
    shutil.rmtree(work, ignore_errors=True)
    if failures:
        return 1
    print(size)
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(REPO, ".hill-climb", "store-size", "data", "train"))
    ap.add_argument("--make-ref", action="store_true")
    a = ap.parse_args()
    sys.exit(run(os.path.abspath(a.data), a.make_ref))
