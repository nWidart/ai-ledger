# Tasks

## 1. Packing

- [x] 1.1 Add `blobs.py`: `pack_line` replaces string tokens of 256 characters or more by a hash reference, keeping the residual valid JSON; strings go to open packs at zstd level 3, are sealed into 16 MB packs at level 19, in 256-byte rows; base64 tokens that round-trip are stored as bytes.
- [x] 1.2 Ingest packs parsed lines; every read of `raw_lines` text expands references back to the original characters.

## 2. Compact

- [x] 2.1 Add `store.compact` and the `ai-ledger compact` command: build a new file, copy tables, pack whole lines, seal, check row counts, swap; leave the old file on failure.

## 3. Docs

- [x] 3.1 Document `ai-ledger compact` and the smaller store in `README.md` and `CHANGELOG.md`.
