# Design

## Context

`raw_lines` holds each line's full JSON text. Transcripts repeat long strings across lines and across files, so the store holds the same bytes many times, uncompressed.

## Decisions

### Long strings are the unit: tokens of 256 characters or more
A line's string tokens (between quotes, escapes included) of 256 characters or more are replaced by a reference. Shorter strings stay in the line: a reference would cost as much as they do, and keys and short values keep the line readable in SQL.

### Content hash as the key
The reference is `"~b~<hash>"`, the 128-bit BLAKE2b of the characters between the quotes. Equal strings get one hash, so a string repeated in many lines, or in resumed files, is stored once, and a second ingest of the same line adds nothing.

### The residual stays valid JSON
A reference is itself a JSON string, so the packed line parses. Searches by id in SQL (`json LIKE '%toolu_…%'`, session and message ids) keep working on the line without expanding it, as ids are short and stay in place. A line that already contains `"~b~`, has no long token, or whose residual would not parse (the pattern can match the gap between two strings) stays whole and unpacked.

### Packs cut into 256-byte rows
Compressed strings go into packs, each a zstd frame cut into 256-byte rows. DuckDB rewrites a table's whole last row group at each checkpoint, and a row group fills by row count, not bytes, so large rows would make every checkpoint rewrite hundreds of megabytes. Small rows keep the rewritten part small.

### Open packs, sealed into 16 MB packs at zstd level 19
New strings go into an open pack at a fast level (3), so ingest stays fast. Once 16 MB are open they are sealed: rewritten into 16 MB packs at level 19 with a 16 MB window, text and base64 apart so each compresses on its own kind. Reads work on open and sealed packs alike.

### Base64 as bytes
A token that is base64 and re-encodes to exactly the same characters is stored as its decoded bytes (a quarter smaller before compression, and compressible). A token that would not round-trip stays as text, so reading stays exact.

### Compact builds a new file and swaps
`compact` opens a new file next to the store, copies every table, packs the lines still whole, seals what is open, checks that every table has the same row count, then replaces the old file. The old file is never written, so a failure or a kill leaves it as it was. The new file has no free blocks, which an in-place rewrite would keep. It needs room for a second copy of the store while it runs.

### Stores from before need no migration
Whole lines are still valid. Reads expand only packed lines. New lines are packed on ingest; old ones stay whole until `compact`.

## Rejected

- **Drop image payloads.** Screenshots are the largest part of what remains (0.96 GB of 1.61 GB) and do not compress. Dropping them would shrink the store most, but the store is a permanent, exact copy; it was declined to stay lossless.

## Risks

- `compact` takes minutes on a large store (14 minutes for 690,438 lines) and needs the app stopped and spare disk.
- A pack that is lost or damaged loses the strings in it. `compact` and ingest write packs in the same transaction as the lines that refer to them.
