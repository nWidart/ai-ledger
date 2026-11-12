"""Build the store benchmark's corpora from a COPY of a real store: a sample of whole sessions, written back as
transcript files. The files hold transcript content, secrets included: they stay under the git-ignored data folder.

    uv run python tools/storebench/sample.py <store copy> <out dir> [per-mille per corpus]
"""
import hashlib
import os
import re
import sys

import duckdb

UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def place(path):
    """(source, path under the source root, session group) of a stored file path, or None."""
    if "/.claude/projects/" in path:
        rel = path.split("/.claude/projects/", 1)[1]
        parts = rel.split("/")
        return "claude", rel, parts[0] + "/" + parts[1].removesuffix(".jsonl")
    if "/.codex/" in path:
        rel = path.split("/.codex/", 1)[1].removesuffix(".zst")
        m = re.search(rf"({UUID})(?:_{UUID})?\.jsonl$", rel)
        return "codex", rel, m.group(1) if m else rel
    return None


def main(db, out, share=45):
    con = duckdb.connect(db, read_only=True)
    files = [r[0] for r in con.execute("SELECT DISTINCT file FROM raw_lines ORDER BY 1").fetchall()]
    stats = {}
    for path in files:
        got = place(path)
        if not got:
            continue
        source, rel, group = got
        h = int.from_bytes(hashlib.blake2b(group.encode(), digest_size=4).digest(), "big") % 1000
        corpus = "train" if h < share else "holdout" if h < 2 * share else None
        if rel == "session_index.jsonl":
            corpus = "train"
        if not corpus:
            continue
        target = os.path.join(out, corpus, source, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        n = 0
        with open(target, "wb") as fh:
            for (text,) in con.execute("SELECT json FROM raw_lines WHERE file = ? ORDER BY byte_offset", [path]).fetchall():
                raw = text.encode("utf-8", "surrogatepass") + b"\n"
                fh.write(raw)
                n += len(raw)
        s = stats.setdefault(corpus, [0, 0])
        s[0] += 1
        s[1] += n
    for corpus, (n, size) in sorted(stats.items()):
        print(f"{corpus}: {n} files, {size / 1e6:.0f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 45)
