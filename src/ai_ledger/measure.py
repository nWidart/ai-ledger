"""Measure now: run `claude -p "/context"` in a project's folder, so its transcript stores a context snapshot.

The request names the project only; the folder and the model come from the store, so a page cannot make the app run Claude
Code anywhere else. The run starts the project's MCP servers and hooks as a new session would, and calls no model.
"""
import json
import os
import shutil
import subprocess
from datetime import datetime, timedelta, timezone

TIMEOUT = 60  # seconds a run may take
MODEL_DAYS = 30  # the window the most used model is counted over
STDERR_TAIL = 500  # characters of the command's stderr an error answer carries
MAX_PROJECT = 500


class MeasureError(Exception):
    """A run that cannot go or failed: the HTTP status to answer and a message for the page, with the stderr tail if any."""

    def __init__(self, status, message, stderr=""):
        super().__init__(message)
        self.status, self.message, self.stderr = status, message, stderr


def parse(body):
    """The project named by the JSON body of POST /api/context/measure. Any other key is ignored. Raises ValueError."""
    if not isinstance(body, dict):
        raise ValueError("body must be a JSON object")
    project = body.get("project")
    if not isinstance(project, str) or not 0 < len(project) <= MAX_PROJECT:
        raise ValueError(f"project must be a string of 1 to {MAX_PROJECT} characters")
    return project


CLAUDE_SESSIONS = "s.project = ? AND coalesce(s.source, 'claude') = 'claude'"


def known(cur, project):
    """Whether the store has a Claude Code session of the project."""
    return cur.execute(f"SELECT 1 FROM sessions s WHERE {CLAUDE_SESSIONS} LIMIT 1", [project]).fetchone() is not None


def folder(cur, project, isdir=os.path.isdir):
    """The cwd of the project's latest Claude Code session whose folder still exists, or None."""
    rows = cur.execute(f"SELECT cwd FROM sessions s WHERE {CLAUDE_SESSIONS} AND coalesce(cwd, '') <> '' "
                       "GROUP BY cwd ORDER BY max(last_ts) DESC NULLS LAST, cwd", [project]).fetchall()
    return next((cwd for (cwd,) in rows if isdir(cwd)), None)


def model(cur, project, now=None):
    """The project's most used main-thread model over the last MODEL_DAYS days by requests, else the model of its latest
    main-thread request, or None. Claude Code's <synthetic> stand-in is not a model."""
    since = (now or datetime.now(timezone.utc).replace(tzinfo=None)) - timedelta(days=MODEL_DAYS)
    base = (f"FROM requests r JOIN sessions s USING (session_id) WHERE {CLAUDE_SESSIONS} AND NOT coalesce(r.subagent, false) "
            "AND coalesce(r.model, '') NOT IN ('', '<synthetic>')")
    row = cur.execute(f"SELECT r.model {base} AND r.ts >= ? GROUP BY r.model ORDER BY count(*) DESC, max(r.ts) DESC LIMIT 1",
                      [project, since]).fetchone()
    row = row or cur.execute(f"SELECT r.model {base} ORDER BY r.ts DESC NULLS LAST LIMIT 1", [project]).fetchone()
    return row[0] if row else None


def command(claude, model):
    return [claude, "-p", "/context", *(["--model", model] if model else []), "--output-format", "json"]


def tail(text):
    return (text or "")[-STDERR_TAIL:].strip()


def run(folder, model):
    """Run /context in folder and return the session id it wrote. Raises MeasureError."""
    claude = shutil.which("claude")
    if claude is None:
        raise MeasureError(503, "Claude Code was not found on PATH")
    try:
        done = subprocess.run(command(claude, model), cwd=folder, stdin=subprocess.DEVNULL, capture_output=True, text=True,
                              timeout=TIMEOUT)
    except subprocess.TimeoutExpired as e:
        err = e.stderr.decode(errors="replace") if isinstance(e.stderr, bytes) else e.stderr
        raise MeasureError(504, f"Claude Code did not finish within {TIMEOUT} seconds", tail(err)) from None
    except OSError as e:
        raise MeasureError(502, f"Claude Code could not start: {type(e).__name__}") from None
    if done.returncode != 0:
        raise MeasureError(502, f"Claude Code exited with status {done.returncode}", tail(done.stderr))
    try:
        result = json.loads(done.stdout)
    except ValueError:
        raise MeasureError(502, "Claude Code's output was not JSON", tail(done.stderr)) from None
    if not isinstance(result, dict):
        raise MeasureError(502, "Claude Code's output was not a JSON object", tail(done.stderr))
    if result.get("is_error"):
        detail = result.get("result") if isinstance(result.get("result"), str) else ""
        raise MeasureError(502, "Claude Code reported an error", tail(done.stderr) or tail(detail))
    return result.get("session_id")
