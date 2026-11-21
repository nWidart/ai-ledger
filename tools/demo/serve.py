"""Serve the demo store on 127.0.0.1:8799 (or $DEMO_PORT) with no limit polling, ingesting only tools/demo/live/, so nothing real enters it.

cd web && npm ci && npm run build    once: the pages come from that build, which git does not track
uv run tools/demo/serve.py
uv run tools/demo/replay.py    in another terminal: plays synthetic sessions into tools/demo/live/ for the Live page
"""
import os

from ai_ledger import app, metrics, store

HERE = os.path.dirname(os.path.abspath(__file__))
# The user files sit next to the store, as app.main sets them: here, beside demo.duckdb, so the real data folder's
# prices.json and automated.json never reach the demo pages or the screenshots.
metrics.USER_PRICES, metrics.USER_AUTOMATED = os.path.join(HERE, "prices.json"), os.path.join(HERE, "automated.json")

LIVE = os.path.join(HERE, "live")  # replay.py's transcript root; never a real one
os.makedirs(os.path.join(LIVE, "claude"), exist_ok=True)
app.App.poll = lambda self: None
app.serve(store.open_store(os.path.join(HERE, "demo.duckdb")), dict(claude=os.path.join(LIVE, "claude"), codex=os.path.join(LIVE, "codex"), grok=os.path.join(LIVE, "grok")), int(os.environ.get("DEMO_PORT", 8799)))
