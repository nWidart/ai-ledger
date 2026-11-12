"""Big string tokens of transcript lines, kept once and compressed apart from raw_lines.

A line's string token of BIG characters or more is replaced in raw_lines.json by "~b~<hash>", the hash of the characters
between its quotes. The strings themselves go, one per distinct hash, into packs: zstd frames cut into small rows, as DuckDB
rewrites a table's whole last row group at each checkpoint and a row group fills by row count, not by bytes."""
import hashlib
import json
import re
from compression import zstd

BIG = 256
TOKEN = re.compile(r'"(?:[^"\\]|\\.){%d,}"' % BIG, re.S)
REF = re.compile(r'"~b~([0-9a-f]{32})"')
PACK_BYTES = 16 << 20  # raw bytes of a pack
ROW = 256  # bytes of one packs row
BATCH = 1000  # hashes per lookup


def digest(inner):
    """The 128-bit hash of a string token's characters, as an int."""
    return int.from_bytes(hashlib.blake2b(inner.encode("utf-8"), digest_size=16).digest(), "big")


def pack_line(text):
    """(stored text, packed, {hash: characters}) of a line: each big string token replaced by its reference. The line stays
    whole, packed false, when it holds a reference-like text, has no big token, or the residual is not valid JSON (the pattern
    can match the gap between two strings)."""
    if '"~b~' in text:
        return text, False, {}
    found = {}

    def swap(m):
        inner = m.group(0)[1:-1]
        h = digest(inner)
        found[h] = inner
        return '"~b~%032x"' % h

    out = TOKEN.sub(swap, text)
    if not found:
        return text, False, {}
    try:
        json.loads(out)
    except ValueError:
        return text, False, {}
    return out, True, found


def write(cur, found):
    """Store the strings {hash: characters} that are not stored yet, in as few packs as fit PACK_BYTES."""
    hashes = list(found)
    have = set()
    for i in range(0, len(hashes), BATCH):
        have |= {r[0] for r in cur.execute("SELECT hash FROM blobs WHERE hash IN (SELECT unnest(?::UHUGEINT[]))",
                                           [[str(h) for h in hashes[i:i + BATCH]]]).fetchall()}
    new = [h for h in hashes if h not in have]
    pack = cur.execute("SELECT coalesce(max(pack), -1) + 1 FROM packs").fetchone()[0]
    rows, start = [], 0
    while start < len(new):
        data, n = bytearray(), start
        while n < len(new) and (not data or len(data) < PACK_BYTES):
            raw = found[new[n]].encode("utf-8")
            rows.append((new[n], pack, len(data), len(raw)))
            data += raw
            n += 1
        frame = zstd.compress(bytes(data), level=9)
        cur.execute("INSERT INTO packs SELECT ?, generate_subscripts(l, 1), unnest(l) FROM (SELECT ?::BLOB[] l)",
                    [pack, [frame[i:i + ROW] for i in range(0, len(frame), ROW)]])
        start, pack = n, pack + 1
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        cur.execute(f"INSERT INTO blobs VALUES {','.join(['(?,?,?,?)'] * len(chunk))}", [v for r in chunk for v in r])


def expand(cur, rows):
    """The fetched rows, whose last two columns are json and packed, as rows without packed and with the line's full text."""
    refs = {int(h, 16) for r in rows if r[-1] for h in REF.findall(r[-2])}
    text = {}
    if refs:
        where = {}
        wanted = list(refs)
        for i in range(0, len(wanted), BATCH):
            for h, pack, pos, n in cur.execute("SELECT hash, pack, pos, len FROM blobs WHERE hash IN (SELECT unnest(?::UHUGEINT[]))",
                                               [[str(h) for h in wanted[i:i + BATCH]]]).fetchall():
                where[h] = (pack, pos, n)
        for h in refs - where.keys():
            raise LookupError(f"blob {h:032x} is not stored")
        by_pack = {}
        for h, (pack, pos, n) in where.items():
            by_pack.setdefault(pack, []).append((h, pos, n))
        for pack, items in by_pack.items():
            data = zstd.decompress(b"".join(r[0] for r in cur.execute("SELECT data FROM packs WHERE pack = ? ORDER BY seq", [pack]).fetchall()))
            for h, pos, n in items:
                text[h] = '"' + data[pos:pos + n].decode("utf-8") + '"'
    return [(*r[:-2], REF.sub(lambda m: text[int(m.group(1), 16)], r[-2]) if r[-1] else r[-2]) for r in rows]
