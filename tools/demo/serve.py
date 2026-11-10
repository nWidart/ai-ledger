"""Serve the demo store on 127.0.0.1:8799 with no limit polling, ingesting only tools/demo/live/, so nothing real enters it.

uv run tools/demo/serve.py
uv run tools/demo/replay.py    in another terminal: plays synthetic sessions into tools/demo/live/ for the Live page
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
import app  # noqa: E402
import store  # noqa: E402

LIVE = os.path.join(HERE, "live")  # replay.py's transcript root; never a real one
os.makedirs(os.path.join(LIVE, "claude"), exist_ok=True)
app.PORT = 8799
app.App.poll = lambda self: None
app.serve(store.open_store(os.path.join(HERE, "demo.duckdb")), dict(claude=os.path.join(LIVE, "claude"), codex=os.path.join(LIVE, "codex")))
