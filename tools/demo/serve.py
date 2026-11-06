"""Serve the demo store on 127.0.0.1:8799 with no ingest and no limit polling, so nothing real enters it.

uv run tools/demo/serve.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
import app  # noqa: E402
import store  # noqa: E402

app.PORT = 8799
app.App.ingest = lambda self: None
app.App.poll = lambda self: None
app.serve(store.open_store(os.path.join(HERE, "demo.duckdb")), dict(claude=None, codex=None))
