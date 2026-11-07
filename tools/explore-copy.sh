#!/bin/sh
# Keep a copy of the store at data/explore.duckdb to browse in a DuckDB client while the app runs.
#
#   tools/explore-copy.sh sync     create or refresh the copy
#   tools/explore-copy.sh delete   remove the copy
#
# The app holds the store's write lock, so clients cannot open data/ai-ledger.duckdb itself. Close the copy in
# your client before a sync or delete: a client that keeps it open goes on reading the old file.
set -eu

cd "$(dirname "$0")/../data"
STORE=ai-ledger.duckdb
COPY=explore.duckdb

in_use() {
  if lsof "$COPY" >/dev/null 2>&1; then
    echo "$COPY is open in another process; close it in your client first" >&2
    exit 1
  fi
}

case "${1:-}" in
  sync)
    [ -f "$COPY" ] && in_use
    tmp=$(mktemp -d .explore.XXXXXX)
    trap 'rm -rf "$tmp"' EXIT
    cp "$STORE" "$tmp/$COPY"
    [ -f "$STORE.wal" ] && cp "$STORE.wal" "$tmp/$COPY.wal"
    # Fold the WAL into the copy; this fails if the copy caught the store mid-write.
    uv run --project .. python -I -c "import duckdb, sys; duckdb.connect(sys.argv[1]).execute('CHECKPOINT')" "$tmp/$COPY"
    mv "$tmp/$COPY" "$COPY"
    echo "$PWD/$COPY"
    ;;
  delete)
    [ -f "$COPY" ] || exit 0
    in_use
    rm -f "$COPY" "$COPY.wal"
    ;;
  *)
    echo "usage: $0 sync|delete" >&2
    exit 2
    ;;
esac
