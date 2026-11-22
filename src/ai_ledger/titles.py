"""Session titles and first prompts: the name every page shows for a session, and the text of its first human prompt."""
import json
import re

from . import store

FIRST_PROMPT_CAP = 600


def first_prompts(cur, sids):
    """{session_id: full text of its first human prompt} (the earliest row in prompts), for the sessions that have one stored.
    Each line is read by its file's source (store.SOURCES); a source with prompt_texts reads its sessions' prompts itself."""
    if not sids:
        return {}
    found = {}
    readers = {name: src.prompt_texts for name, src in store.SOURCES.items() if src.prompt_texts}
    if readers:
        own = {}
        for sid, pid, source in cur.execute("""SELECT p.session_id, arg_min(p.prompt_id, p.ts), s.source FROM prompts p
                JOIN sessions s USING (session_id) WHERE list_contains(?, p.session_id) AND list_contains(?, s.source)
                GROUP BY 1, 3""", [list(sids), list(readers)]).fetchall():
            own.setdefault(source, {})[sid] = pid
        for source, pids in own.items():
            found |= readers[source](cur, pids)
        sids = [sid for sid in sids if not any(sid in pids for pids in own.values())]
        if not sids:
            return found
    types = sorted({src.prompt_type for src in store.SOURCES.values() if not src.prompt_texts})
    for sid, pid, source, line in cur.execute("""
            WITH fp AS (SELECT session_id, arg_min(prompt_id, ts) AS pid FROM prompts WHERE list_contains(?, session_id) GROUP BY 1)
            SELECT r.session_id, fp.pid, coalesce(f.source, 'claude'), r.json FROM raw_lines r JOIN fp USING (session_id)
            LEFT JOIN files f ON f.path = r.file
            WHERE list_contains(?, r.type) AND contains(r.json, fp.pid)
            QUALIFY row_number() OVER (PARTITION BY r.session_id ORDER BY r.ts) <= 20
            ORDER BY r.session_id, r.ts""", [list(sids), types]).fetchall():
        src = store.SOURCES.get(source)
        if sid in found or src is None:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        text = src.prompt_text(d, pid) if isinstance(d, dict) else None
        if text:
            found[sid] = text
    return found


def cap_prompt(text, cap=FIRST_PROMPT_CAP):
    return None if text is None else text[:cap] + ("…" if len(text) > cap else "")


def first_prompt(cur, sid, cap=FIRST_PROMPT_CAP):
    """The text of the session's first human prompt, cut to cap characters (None: the whole text), or None."""
    text = first_prompts(cur, [sid]).get(sid)
    return text if cap is None else cap_prompt(text, cap)


TITLE_LEN = 80
# Claude Code wraps slash commands and injected context in hyphenated tags: <command-name>, <command-args>, <system-reminder>, ...
CMD_TAG = lambda tag: re.compile(rf"<{tag}>\s*(.*?)\s*</{tag}>", re.S)
WRAPPER_BLOCK = re.compile(r"<([a-z]+(?:-[a-z]+)+)>.*?</\1>", re.S)
WRAPPER_TAG = re.compile(r"</?[a-z]+(?:-[a-z]+)+>")


def prompt_title(text, n=TITLE_LEN):
    """A short readable name for a session from its first prompt: "/ship add tests" for a slash command (its tags stripped),
    else the first sentence of the first line, cut to n characters. None when nothing readable is left."""
    if not text:
        return None
    name, msg, args = (CMD_TAG(t).search(text) for t in ("command-name", "command-message", "command-args"))
    if name or msg:
        cmd = name.group(1).strip() if name else (msg.group(1).split() or [""])[0]
        title = ("" if cmd.startswith("/") else "/") + cmd + (" " + args.group(1) if args and args.group(1).strip() else "")
    else:
        body = WRAPPER_TAG.sub(" ", WRAPPER_BLOCK.sub(" ", text))
        line = next((ln.strip() for ln in body.splitlines() if ln.strip()), "")
        line = re.sub(r"^[#>*\-\s]+", "", line)
        m = re.search(r"[.!?](?=\s|$)", line)
        title = line[:m.end()] if m and m.end() > 12 else line
    return short_title(title, n)


def short_title(title, n=TITLE_LEN):
    """title with its whitespace collapsed, cut to n characters with an ellipsis; None when nothing is left."""
    title = " ".join(title.split()) if isinstance(title, str) else ""
    if not title:
        return None
    return title if len(title) <= n else title[:n - 1].rstrip() + "…"


def titles(cur, sids, prompts=True):
    """{session_id: (title, "agent" | "prompt")} for the sessions that have one: the newest custom title, else the newest
    title the agent wrote (Claude Code's ai-title, Codex's thread name), else prompt_title of the first prompt for the
    sessions prompts names: True all of them, False none, or a collection of session ids. The first-prompt lookup reads
    raw lines and is not saved, so callers keep it to the rows they show."""
    sids = list(dict.fromkeys(sids))
    if not sids:
        return {}
    out = {sid: (short_title(t), "agent") for sid, t in cur.execute(
        "SELECT session_id, coalesce(custom, agent) FROM session_titles WHERE list_contains(?, session_id)", [sids]).fetchall()}
    pool = sids if prompts is True else set(prompts or ())
    texts = first_prompts(cur, [sid for sid in sids if sid not in out and sid in pool])
    out |= {sid: (prompt_title(text), "prompt") for sid, text in texts.items()}
    return {sid: t for sid, t in out.items() if t[0]}


def with_titles(cur, sess, prompts=True):
    """Adds title (see titles, prompts as there) to each session row; returns the rows."""
    found = titles(cur, [x["session_id"] for x in sess], prompts)
    for x in sess:
        x["title"] = found.get(x["session_id"], (None,))[0]
    return sess
