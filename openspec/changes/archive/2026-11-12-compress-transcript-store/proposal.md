# Proposal

## Why

The store keeps every transcript line's exact text, and most of that text is repeated: re-sent context, a file read twice, a screenshot sent in several requests. On a real store of 690,438 lines (5.55 GB of line text) the file was 2.96 GB, and DuckDB never gives back the space of rows it rewrote. A store that grows without bound is a reason to clean transcripts, which is what the store exists to survive.

## What Changes

- **Long strings stored once, compressed.** Each string of a line of 256 characters or more is stored once, compressed, apart from the line, and the line refers to it. A string that appears in many lines is stored once. Base64 payloads are stored as their bytes.
- **Reads are unchanged.** A line read back has its original text, character for character.
- **`ai-ledger compact`** rewrites an existing store into the new format in a new file, then swaps it in, and drops the free space DuckDB keeps. The app must be stopped.
- **Older stores keep working.** A store from before this change opens and reads as before; only new lines are packed until the user runs `compact`.

Measured on the 690,438-line store: 2.96 GB before, 1.61 GB after `ai-ledger compact`, every line identical. Compact took 14 minutes. What remains is mostly screenshots (0.96 GB), which do not compress.

Out of scope: dropping image payloads (rejected, see design).

## Capabilities

### Modified Capabilities
- `transcript-store`: lines are still exact, long strings are stored once and compressed, `compact` shrinks an existing store, and older stores keep working.

## Impact

- `src/ai_ledger/blobs.py` (new): packing, sealing and expanding lines.
- `src/ai_ledger/store.py`: packed ingest, reads that expand lines, `compact`.
- `src/ai_ledger/app.py`: the `compact` command.
- `README.md`, `CHANGELOG.md`.
