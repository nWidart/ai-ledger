"""Big string tokens of transcript lines, kept once and compressed apart from raw_lines.

A line's string token of BIG characters or more is replaced in raw_lines.json by "~b~<hash>", the hash of the characters
between its quotes. The strings themselves go, one per distinct hash, into packs: zstd frames cut into small rows, as DuckDB
rewrites a table's whole last row group at each checkpoint and a row group fills by row count, not by bytes."""
import base64
import hashlib
import json
import re
from compression import zstd

BIG = 256
TOKEN = re.compile(r'"(?:[^"\\]|\\.){%d,}"' % BIG, re.S)
B64 = re.compile(r'[A-Za-z0-9+/]+={0,2}')
REF = re.compile(r'"~b~([0-9a-f]{32})"')
PACK_BYTES = 16 << 20  # raw bytes of a sealed pack
SEAL_BYTES = 16 << 20  # raw bytes in open packs that get them sealed
OPEN_LEVEL = 3  # open packs are short-lived: fast
SEALED = {zstd.CompressionParameter.compression_level: 19, zstd.CompressionParameter.window_log: 24}
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


def binary(inner):
    """The bytes a base64 token stands for, or None when encoding them again would not give the token back exactly."""
    if len(inner) % 4 or not B64.fullmatch(inner):
        return None
    try:
        raw = base64.b64decode(inner, validate=True)
    except ValueError:
        return None
    return raw if base64.b64encode(raw).decode() == inner else None


def put(cur, pack, data, table, options):
    """Store the bytes as one zstd frame in the pack of table, cut into ROW-byte rows by one statement."""
    frame = zstd.compress(data, options=options)
    cur.execute(f"INSERT INTO {table} SELECT ?, generate_subscripts(l, 1), unnest(l) FROM (SELECT ?::BLOB[] l)",
                [pack, [frame[i:i + ROW] for i in range(0, len(frame), ROW)]])


def get(cur, pack):
    """The decompressed bytes of a pack, sealed or open; None when it has no rows (a seal may have moved its blobs on)."""
    rows = cur.execute("SELECT seq, data FROM packs WHERE pack = ? UNION ALL SELECT seq, data FROM packs_open WHERE pack = ? ORDER BY 1",
                       [pack, pack]).fetchall()
    return zstd.decompress(b"".join(r[1] for r in rows)) if rows else None


def next_pack(cur):
    """The next pack id: one sequence over packs and packs_open."""
    return cur.execute("SELECT coalesce(max(p), -1) + 1 FROM (SELECT max(pack) p FROM packs UNION ALL SELECT max(pack) FROM packs_open)").fetchone()[0]


def payload(inner):
    """(bytes, binary) a pack holds for the token's characters."""
    raw = binary(inner)
    return (inner.encode("utf-8"), False) if raw is None else (raw, True)


def write(cur, found):
    """Store the strings {hash: characters} that are not stored yet in one open pack (fast level), then seal if enough is open.
    Returns the hashes whose stored token is not this one (same hash, other length or kind): their lines must stay whole."""
    hashes = list(found)
    have = {}
    for i in range(0, len(hashes), BATCH):
        have |= {r[0]: r[1:] for r in cur.execute("SELECT hash, len, b64 FROM blobs WHERE hash IN (SELECT unnest(?::UHUGEINT[]))",
                                                  [[str(h) for h in hashes[i:i + BATCH]]]).fetchall()}
    refused = {h for h, (n, b64) in have.items() if (len(payload(found[h])[0]), payload(found[h])[1]) != (n, bool(b64))}
    new = [h for h in hashes if h not in have]
    if new:
        pack = next_pack(cur)
        data, rows = bytearray(), []
        for h in new:
            raw, b64 = payload(found[h])
            rows.append((h, pack, len(data), len(raw), b64))
            data += raw
        put(cur, pack, bytes(data), "packs_open", {zstd.CompressionParameter.compression_level: OPEN_LEVEL})
        for i in range(0, len(rows), 500):
            chunk = rows[i:i + 500]
            cur.execute(f"INSERT INTO blobs VALUES {','.join(['(?,?,?,?,?)'] * len(chunk))}", [v for r in chunk for v in r])
    seal(cur)
    return refused


def seal(cur, force=False):
    """Move the open packs' blobs into sealed packs, text and binary apart, once SEAL_BYTES of them are open (always when
    force). Open packs always have lower ids than the sealed packs made after them, so the blobs at or above the lowest open id
    are the open ones."""
    open_bytes = cur.execute("SELECT coalesce(sum(len), 0) FROM blobs WHERE pack >= (SELECT min(pack) FROM packs_open)").fetchone()[0]
    if not open_bytes or open_bytes < SEAL_BYTES and not force:
        return
    packs = [r[0] for r in cur.execute("SELECT DISTINCT pack FROM packs_open ORDER BY 1").fetchall()]
    data = {p: get(cur, p) for p in packs}
    kinds = {False: [], True: []}
    for h, pack, pos, n, b64 in cur.execute("SELECT hash, pack, pos, len, b64 FROM blobs WHERE pack IN (SELECT pack FROM packs_open) "
                                            "ORDER BY pack, pos").fetchall():
        kinds[bool(b64)].append((h, data[pack][pos:pos + n]))
    pack = next_pack(cur)
    moved = []
    for items in kinds.values():
        buf = bytearray()
        for i, (h, raw) in enumerate(items):
            moved.append((str(h), pack, len(buf)))
            buf += raw
            if len(buf) >= PACK_BYTES or i == len(items) - 1:
                put(cur, pack, bytes(buf), "packs", SEALED)
                buf, pack = bytearray(), pack + 1
    for i in range(0, len(moved), 500):
        chunk = moved[i:i + 500]
        cur.execute(f"UPDATE blobs SET pack = v.pack, pos = v.pos FROM (VALUES {','.join(['(?::UHUGEINT,?,?)'] * len(chunk))}) v(k, pack, pos) "
                    "WHERE blobs.hash = v.k", [x for r in chunk for x in r])
    cur.execute("DELETE FROM packs_open")


def substitute(text, strings):
    """The line text with each reference replaced by its token, strings being {hash: token with its quotes}."""
    return REF.sub(lambda m: strings[int(m.group(1), 16)], text)


def tokens(cur, refs):
    """{hash: token with its quotes} for the hashes. A seal that commits between the lookup and the pack read moves a blob to
    another pack and empties its open one, so a miss is tried once more: ids are never reused, a second miss is real."""
    for attempt in (0, 1):
        where, text = {}, {}
        wanted = list(refs)
        for i in range(0, len(wanted), BATCH):
            for h, pack, pos, n, b64 in cur.execute("SELECT hash, pack, pos, len, b64 FROM blobs WHERE hash IN (SELECT unnest(?::UHUGEINT[]))",
                                                    [[str(h) for h in wanted[i:i + BATCH]]]).fetchall():
                where[h] = (pack, pos, n, b64)
        by_pack = {}
        for h, (pack, pos, n, b64) in where.items():
            by_pack.setdefault(pack, []).append((h, pos, n, b64))
        for pack, items in by_pack.items():
            data = get(cur, pack)
            if data is None:
                break
            for h, pos, n, b64 in items:
                raw = data[pos:pos + n]
                text[h] = '"' + (base64.b64encode(raw).decode() if b64 else raw.decode("utf-8")) + '"'
        else:
            if len(where) == len(refs):
                return text
    raise LookupError(f"blob {min(set(refs) - text.keys()):032x} is not stored")


def expand(cur, rows):
    """The fetched rows, whose last two columns are json and packed, as rows without packed and with the line's full text."""
    refs = {int(h, 16) for r in rows if r[-1] for h in REF.findall(r[-2])}
    text = tokens(cur, refs) if refs else {}
    return [(*r[:-2], substitute(r[-2], text) if r[-1] else r[-2]) for r in rows]


def verify(cur):
    """Check every blob: its bytes in its pack hash back to its hash, and no blob points at a missing pack. Returns the blobs
    checked; raises ValueError naming the hash of the first that does not."""
    n = 0
    for (pack,) in cur.execute("SELECT pack FROM packs UNION SELECT pack FROM packs_open ORDER BY 1").fetchall():
        data = get(cur, pack)
        for h, pos, size, b64 in cur.execute("SELECT hash, pos, len, b64 FROM blobs WHERE pack = ?", [pack]).fetchall():
            raw = data[pos:pos + size]
            if len(raw) != size or digest(base64.b64encode(raw).decode() if b64 else raw.decode("utf-8", "replace")) != h:
                raise ValueError(f"blob {h:032x} does not match its hash")
            n += 1
    lost = cur.execute("SELECT hash FROM blobs WHERE pack NOT IN (SELECT pack FROM packs UNION SELECT pack FROM packs_open) LIMIT 1").fetchone()
    if lost:
        raise ValueError(f"blob {lost[0]:032x} is in a pack that is not stored")
    return n


def unresolved(cur):
    """The references in raw_lines that have no blobs row, as a count."""
    return cur.execute("""SELECT count(*) FROM (SELECT unnest(regexp_extract_all(json, '"~b~([0-9a-f]{32})"', 1)) AS h
        FROM raw_lines WHERE packed) r WHERE NOT EXISTS (SELECT 1 FROM blobs b WHERE b.hash = ('0x' || r.h)::UHUGEINT)""").fetchone()[0]
