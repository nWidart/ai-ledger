"""Serve the demo store on 127.0.0.1:8799 with no limit polling, ingesting only tools/demo/live/, so nothing real enters it.

uv run tools/demo/serve.py
uv run tools/demo/replay.py    in another terminal: plays synthetic sessions into tools/demo/live/ for the Live page
"""
import os

from ai_ledger import app, store

HERE = os.path.dirname(os.path.abspath(__file__))

LIVE = os.path.join(HERE, "live")  # replay.py's transcript root; never a real one
os.makedirs(os.path.join(LIVE, "claude"), exist_ok=True)
app.App.poll = lambda self: None
app.serve(store.open_store(os.path.join(HERE, "demo.duckdb")), dict(claude=os.path.join(LIVE, "claude"), codex=os.path.join(LIVE, "codex")), 8799)
