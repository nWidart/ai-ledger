"""Play synthetic sessions into tools/demo/live/ while serve.py runs, so the Live page shows every state in turn: a tool
running, a subagent lane, a failure, a long shell call (likely waiting for approval), thinking and your turn. Every name,
prompt and output here is made up.

uv run tools/demo/replay.py          loops until stopped
uv run tools/demo/replay.py --once   plays one session
"""
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "live", "claude", "-nowhere-atlas-api")
CWD = "/nowhere/atlas-api"
MODEL = "claude-opus-5-5"


def ts():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z"


class Session:
    def __init__(self):
        self.sid = str(uuid.uuid4())
        self.path = os.path.join(ROOT, self.sid + ".jsonl")
        self.ctx = 42_000
        os.makedirs(ROOT, exist_ok=True)

    def write(self, d, path=None):
        with open(path or self.path, "a") as fh:
            fh.write(json.dumps(dict(d, sessionId=self.sid, cwd=CWD, gitBranch="feat/rate-limit", timestamp=ts(),
                                     uuid=str(uuid.uuid4()), version="2.1.0")) + "\n")

    def prompt(self, text):
        self.pid = str(uuid.uuid4())
        self.write(dict(type="user", promptId=self.pid, message=dict(role="user", content=text)))

    def assistant(self, content, path=None, **extra):
        self.ctx += 1800
        usage = dict(input_tokens=12, output_tokens=240, cache_read_input_tokens=self.ctx, cache_creation_input_tokens=900)
        self.write(dict(type="assistant", message=dict(id="msg_" + uuid.uuid4().hex[:12], model=MODEL, usage=usage, content=content), **extra), path)

    def tool(self, name, inp, output, seconds, error=False, path=None, **extra):
        tid = "toolu_" + uuid.uuid4().hex[:12]
        self.assistant([dict(type="tool_use", id=tid, name=name, input=inp)], path, **extra)
        time.sleep(seconds)
        self.write(dict(type="user", promptId=self.pid, message=dict(role="user", content=[
            dict(type="tool_result", tool_use_id=tid, content=output, is_error=error)]), **extra), path)
        return tid

    def reply(self, text):
        self.assistant([dict(type="text", text=text)])


def play():
    s = Session()
    s.prompt("Add rate limiting to the /orders endpoint")
    time.sleep(3)
    s.reply("I'll look at the orders router and the middleware first.")
    s.tool("Read", dict(file_path="src/orders/router.ts"), "export const router = Router();\n...", 1.5)
    s.tool("Grep", dict(pattern="rateLimit"), "src/middleware/index.ts:12", 1)
    # A subagent: its own file, then the parent call's result names it.
    agent = uuid.uuid4().hex[:17]
    sub = os.path.join(ROOT, s.sid, "subagents", f"agent-{agent}.jsonl")
    os.makedirs(os.path.dirname(sub), exist_ok=True)
    tid = "toolu_" + uuid.uuid4().hex[:12]
    s.assistant([dict(type="tool_use", id=tid, name="Agent", input=dict(description="find every caller of the orders router", prompt="Look for callers"))])
    for pattern in ("ordersRouter", "app.use(", "createServer"):
        s.tool("Grep", dict(pattern=pattern), "src/server.ts:8", 2, path=sub, isSidechain=True, agentId=agent)
    s.write(dict(type="user", promptId=s.pid, toolUseResult=dict(agentId=agent),
                 message=dict(role="user", content=[dict(type="tool_result", tool_use_id=tid, content="3 callers, all in src/server.ts")])))
    time.sleep(2)
    s.tool("Edit", dict(file_path="src/orders/router.ts"), "Applied 1 edit.", 1)
    s.tool("Bash", dict(command="npm test"), "Exit code 1\nFAIL src/orders.test.ts\n  ● orders › returns 429 after 100 requests\n    expected 429, received 200", 6, error=True)
    time.sleep(3)
    s.tool("Edit", dict(file_path="src/middleware/rateLimit.ts"), "Applied 1 edit.", 1)
    s.tool("Bash", dict(command="npm test"), "Tests: 42 passed", 7)
    s.tool("Bash", dict(command="git push origin feat/rate-limit"), "To github.com:example/atlas-api.git", 40)
    s.reply("Rate limiting is on for /orders: 100 requests per minute per key, with a 429 and a Retry-After header. Tests pass.")


if __name__ == "__main__":
    while True:
        play()
        if "--once" in sys.argv:
            break
        time.sleep(20)
