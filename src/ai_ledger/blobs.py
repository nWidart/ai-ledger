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
    """The decompressed bytes of a pack, sealed or open."""
    rows = cur.execute("SELECT seq, data FROM packs WHERE pack = ? UNION ALL SELECT seq, data FROM packs_open WHERE pack = ? ORDER BY 1",
                       [pack, pack]).fetchall()
    return zstd.decompress(b"".join(r[1] for r in rows))


def next_pack(cur):
    """The next pack id: one sequence over packs and packs_open."""
    return cur.execute("SELECT coalesce(max(p), -1) + 1 FROM (SELECT max(pack) p FROM packs UNION ALL SELECT max(pack) FROM packs_open)").fetchone()[0]


def write(cur, found):
    """Store the strings {hash: characters} that are not stored yet in one open pack (fast level), then seal if enough is open."""
    hashes = list(found)
    have = set()
    for i in range(0, len(hashes), BATCH):
        have |= {r[0] for r in cur.execute("SELECT hash FROM blobs WHERE hash IN (SELECT unnest(?::UHUGEINT[]))",
                                           [[str(h) for h in hashes[i:i + BATCH]]]).fetchall()}
    new = [h for h in hashes if h not in have]
    if new:
        pack = next_pack(cur)
        data, rows = bytearray(), []
        for h in new:
            raw = binary(found[h])
            rows.append((h, pack, len(data), len(raw if raw is not None else found[h].encode("utf-8")), raw is not None))
            data += raw if raw is not None else found[h].encode("utf-8")
        put(cur, pack, bytes(data), "packs_open", {zstd.CompressionParameter.compression_level: OPEN_LEVEL})
        for i in range(0, len(rows), 500):
            chunk = rows[i:i + 500]
            cur.execute(f"INSERT INTO blobs VALUES {','.join(['(?,?,?,?,?)'] * len(chunk))}", [v for r in chunk for v in r])
    seal(cur)


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


def expand(cur, rows):
    """The fetched rows, whose last two columns are json and packed, as rows without packed and with the line's full text."""
    refs = {int(h, 16) for r in rows if r[-1] for h in REF.findall(r[-2])}
    text = {}
    if refs:
        where = {}
        wanted = list(refs)
        for i in range(0, len(wanted), BATCH):
            for h, pack, pos, n, b64 in cur.execute("SELECT hash, pack, pos, len, b64 FROM blobs WHERE hash IN (SELECT unnest(?::UHUGEINT[]))",
                                                    [[str(h) for h in wanted[i:i + BATCH]]]).fetchall():
                where[h] = (pack, pos, n, b64)
        for h in refs - where.keys():
            raise LookupError(f"blob {h:032x} is not stored")
        by_pack = {}
        for h, (pack, pos, n, b64) in where.items():
            by_pack.setdefault(pack, []).append((h, pos, n, b64))
        for pack, items in by_pack.items():
            data = get(cur, pack)
            for h, pos, n, b64 in items:
                raw = data[pos:pos + n]
                text[h] = '"' + (base64.b64encode(raw).decode() if b64 else raw.decode("utf-8")) + '"'
    return [(*r[:-2], REF.sub(lambda m: text[int(m.group(1), 16)], r[-2]) if r[-1] else r[-2]) for r in rows]
