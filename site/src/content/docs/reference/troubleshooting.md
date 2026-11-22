---
title: Troubleshooting and FAQ
description: Fixes for common problems and answers to common questions.
spec: [distribution, dashboard-app, transcript-store, context-dashboard]
---

Each entry gives the symptom, its cause and the fix.

## Problems

### The app exits with "cannot listen on 127.0.0.1:8765"

- **Cause:** another process holds the port. A second `ai-ledger` is the usual one.
- **Fix:** serve on another port with `--port`, or stop the other process.

```bash
ai-ledger --port 8766
```

The message reads `cannot listen on 127.0.0.1:<port>: <reason>; pass --port to use another port`, and the exit status is 1.

### `localhost` redirects to `127.0.0.1`, and another host gets "forbidden host"

- **Cause:** the server accepts the host `127.0.0.1:<port>` only. A request for `localhost:<port>` is redirected to `127.0.0.1:<port>`. A request with any other host gets 403 "forbidden host".
- **Fix:** open `http://127.0.0.1:8765/` (with your port). Do not use `localhost`, a machine name or an IP address of another interface. The app listens on no other interface, and another machine cannot connect to it.
- **To open the app through a reverse proxy**, start it with `--proxy-host <host[:port]>`, with the `Host` the proxy passes on, port included when it is not 443. See [CLI and options](/ai-ledger/reference/cli/). The pages show full transcripts and the proxy adds no login: use a private network only.

### `ingest` or `rebuild` says "the app is running and owns the store"

- **Cause:** only one process may write to the store, and the app holds it while it runs. The full message is "the app is running and owns the store; use Refresh in the dashboard". The same message appears when a second app opens the same store.
- **Fix:** stop the app (Ctrl+C in its terminal), then run the command. To read new lines while the app runs, use **Refresh** in the navigation, or `>refresh` in the [command palette](/ai-ledger/everywhere/command-palette/).

```bash
ai-ledger rebuild
```

### Context shows "The store holds sessions from before this version"

- **Cause:** the store was filled before the Context page's figures existed, so some rows lack them. The notice counts the tool calls that carry a result size and the compacted sessions that record when they first compacted. The page shows the figures for the rows that have them.
- **Fix:** stop the app and run `ai-ledger rebuild` once. It regenerates the derived tables from the stored lines and fills the figures.

### The navigation says Failed or Offline, or a page could not load

- **Cause:** **Offline** means the app did not answer its status request: it has stopped, or its terminal was closed. **Failed** means the last ingest stopped on an error, or a **Refresh** failed. Select the state to read the details: an ingest error shows under **Error**. A page that could not load says so, with a **Retry** control.
- **Fix:** for Offline, look at the terminal that ran `ai-ledger`, start the app again if it stopped, and reload the page. For Failed, read the error, then press **Refresh** (it reads **Retry** after a failed Refresh). For a page, select **Retry**.

### The browser does not open

- **Cause:** the app does not open a browser when `--no-open` is given, when standard output is not a terminal, or on Linux when neither `DISPLAY` nor `WAYLAND_DISPLAY` is set.
- **Fix:** open the URL the app prints: `serving http://127.0.0.1:8765/ (ingest every 60s)`.

### Cost lists "Unpriced models"

- **Cause:** a model in your transcripts has no price in the packaged table or in `prices.json`. The notice names each model with its token count. Its tokens are counted; its cost is left out of totals.
- **Fix:** add the model to [`prices.json`](/ai-ledger/reference/configuration/#prices), or upgrade for a newer packaged table with `uv tool upgrade ai-ledger`. Reload the page; no `rebuild` is needed.

### Cost shows "Prices file ignored", or any page shows "Automated projects file ignored" under the navigation

- **Cause:** the file cannot be used. The banner gives the file's path and the reason, such as a JSON error or a price that is not a number. The app ignores the whole file.
- **Fix:** correct the file. See [Configuration](/ai-ledger/reference/configuration/). Reload the page; the app reads the file on every page load.

### A session or project is missing from a page

- **Cause:** pages leave out automated sessions. A session is automated when it belongs to `observer-sessions` or a project in `automated.json`, has no user prompt, or ran in a temporary folder with at most one prompt.
- **Fix:** turn on **Include automated sessions** (see [Filters](/ai-ledger/everywhere/filters/#include-automated)). Errors never leaves them out.

### Data is behind what the agent just did

- **Cause:** the app ingests every 60 seconds, and every second while a Live page is open.
- **Fix:** press **Refresh** in the navigation to ingest at once.

### Requests to `/api` answer 403

- **Cause:** the app refuses a request that another site makes in your browser (`Sec-Fetch-Site` of `cross-site` or `same-site`, or an `Origin` that is not its own). The app's own page, the address bar, and command-line tools such as `curl` are accepted.
- **Fix:** none needed for the dashboards. Call the API from the app's own origin or from the command line.

### The store cannot be moved: "they are on different disks"

- **Cause:** a store from an earlier location, in a source checkout's `data/` folder, is on another disk than the data folder. The app does not create an empty store beside it.
- **Fix:** move the file (and its `.wal` file) to the data folder by hand, or pass `--db <old path>`. See [Data files and storage locations](/ai-ledger/reference/storage/#earlier-locations).

## FAQ

### Does AI Ledger send my transcripts anywhere?

No. The server listens on `127.0.0.1` only. On macOS, the Limits page sends your Claude Code OAuth token from the Keychain to Anthropic's usage endpoint every 5 minutes; the token goes nowhere else and is never stored or logged. On Linux, Limits reads Codex's limits from Codex transcripts and shows no Claude Code windows (unless copied from a macOS store). If the Grok CLI is signed in with grok.com, the app also sends that login's access token, read from `~/.grok/auth.json`, to xAI's billing endpoint every 5 minutes (on macOS and Linux); the token goes nowhere else and is never stored or logged. Your browser loads a font from Google Fonts; no transcript data goes with the request. A link to these docs opens them in a new tab only when you follow it. See [Privacy and security model](/ai-ledger/concepts/privacy-security/).

### Why does the first start take minutes?

The first ingest reads every transcript: about 5 minutes for a month of heavy use. After that, the app reads only the lines added since the last ingest.

### My agent deleted old transcripts. Are they gone from AI Ledger?

No. The store keeps every line it has read, and never deletes or alters one because the source file was deleted, truncated or rewritten.

### Which agents does it read?

Claude Code (`~/.claude/projects`), Codex (`~/.codex`) and Grok (`~/.grok`). All three map onto the same pages. Activity's Judgments view covers Claude Code sessions only, because it shows Claude Code's `/insights`. For what each agent records, see [Supported agents](/ai-ledger/concepts/supported-agents/).

### Where are the store and the configuration files?

In the [data folder](/ai-ledger/reference/storage/).

### What does the percent on the Limits tab mean?

It is how full your fullest open plan-limit window is. It turns amber or red, with a ring, when a window is at its limit, forecast to run out, or at 90% or more. Hover the tab to read the sentence. A screen reader reads it as part of the tab's name, "Limits alert: *sentence*". See [Navigation pill](/ai-ledger/pages/limits/#navigation-pill).

### What does the number on the Live tab mean?

It counts the sessions that wait for you: those likely waiting for an approval and those in your turn. See [Live](/ai-ledger/pages/live/).

### Where did the Insights page go?

It is the **Judgments** view of Activity: select the Activity tab, then Judgments above the heading. An old `/insights` link still opens it. See [Judgments](/ai-ledger/pages/insights/).

### How do I update?

`uv tool upgrade ai-ledger`. An upgrade keeps your store and your configuration files. A version that needs `ai-ledger rebuild` says so in its [changelog](/ai-ledger/changelog/) entry, and Context shows its notice; run it with the app stopped. See [Upgrade and rebuild](/ai-ledger/start/upgrade/).
