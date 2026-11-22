---
title: Privacy and security model
description: What stays on your machine, what the store holds, and what to check before you share your screen.
---

AI Ledger runs entirely on your machine. It reads transcripts from your disk, keeps them in a store on your disk, and serves its pages only to your own computer. Two things go out: on macOS, a request to Anthropic for your Claude Code plan limits, and your browser's request for the page's font. This page explains what the store holds, what leaves the machine, how the server is guarded, and what the pages can reveal.

## The store holds everything, secrets included

The store keeps every transcript line as the agent wrote it, for Claude Code, Codex and Grok alike: your prompts, the agent's replies, every tool input and every tool result. That includes file contents the agent read, command output, and any secret that appeared in a session, such as an API key, a token or a line of a `.env` file. The store never deletes a line, so a secret stays in the store after the agent deletes its transcript.

The store is a single file, created readable and writable only by your user (mode `0600`), in a folder only your user can open (mode `0700`). The files DuckDB writes next to it get the same protection. Where the file is: [Data files and storage locations](/ai-ledger/reference/storage/).

Treat the store like the transcripts themselves, or more carefully, since it outlives them: do not share it, attach it to an issue, or put it in a synced or shared folder. In a source checkout, a store under the `data/` folder is git-ignored.

## What leaves the machine

### Claude Code's plan limits, on macOS

To show Claude Code's limits, the app asks Anthropic's usage endpoint, `https://api.anthropic.com/api/oauth/usage`, at most once every 5 minutes while it runs, and less often after a failure. For each request it reads Claude Code's OAuth access token from the macOS Keychain (the item `Claude Code-credentials`).

The token goes to that endpoint and nowhere else. The app never writes it to the store, a log, an API response or a page, and never refreshes it: refreshing would replace the token Claude Code relies on. When the token has expired, the app skips the request until Claude Code renews it. What the app stores is the answer: the percent used of each limit, its reset time and your plan's name.

Where the Keychain is not there, as on Linux, the app sends nothing for Claude Code. Codex's limits come from Codex's own transcripts and need no request.

### Grok's plan limits

To show Grok's limit, the app asks xAI's billing endpoint, `https://cli-chat-proxy.grok.com/v1/billing?format=credits`, once every 5 minutes while it runs. For each request it reads the access token of the Grok CLI's grok.com login from `~/.grok/auth.json` (or `$GROK_HOME/auth.json`). This works the same on macOS and Linux.

The token goes to that endpoint and nowhere else. The app never writes it to the store, a log, an API response or a page, and never refreshes it: the Grok CLI does that. When the token has expired, the app skips the poll and marks Grok stale until the Grok CLI renews it. What the app stores is the answer: the percent of the period's credits used and the period (weekly or monthly). The answer names no plan.

The app sends nothing, and Limits shows no Grok card, when there is no grok.com login: Grok is not installed, it uses an API key (`XAI_API_KEY`, or `auth_mode` set to `api_key`), or it has a custom auth or endpoint configuration.

### The font

The page loads its font, IBM Plex Sans, from Google Fonts. Your browser fetches it from `fonts.googleapis.com` and `fonts.gstatic.com` as for any web page. The request carries no transcript data, and the app tells the browser to send no referrer.

### Metrics, when something scrapes them

`GET /metrics` serves the store's figures in the Prometheus text format to whatever asks for it: project, model, tool, error-category and workload names, counts, tokens, cost and the app's version. Nothing leaves the machine unless you point a Prometheus at it, or publish it with a proxy. No label or sample holds a session id, a prompt, a command, a tool input, an error message or a path. See [Prometheus metrics and Grafana dashboard](/ai-ledger/reference/metrics/).

### Nothing else

The app has no account, no analytics and no update check.

The app's links to this documentation site, such as **Docs** in the navigation, **Learn more** in an explanation and the palette's docs commands, open `https://nwidart.github.io/ai-ledger/` in a new browser tab. The app sends nothing to the site before you follow one: it does not preload or prefetch it, and the new tab gets no referrer.

One action runs a program for you: **Measure now** on the [Project](/ai-ledger/pages/project/) page runs `claude -p "/context"` in the project's folder. That calls no model, but it starts the project's MCP servers and hooks as a new Claude Code session would, and they do whatever they are set up to do.

## How the server is guarded

The app's server listens only on `127.0.0.1`, the address your machine uses to talk to itself. Another machine on the network cannot connect to it.

It also checks who is asking:

- **The address.** The server answers only requests addressed to `127.0.0.1` and its port. A request for `localhost` is redirected to `127.0.0.1`. Any other name gets `403 forbidden host`. This stops a web site that points its own domain name at your machine from reading the pages.
- **The exception for `/metrics`.** With `--metrics-host`, `GET /metrics` also accepts the `Host` a proxy such as `tailscale serve` passes on. Pages, `/api` and every other method keep the check above. This is safe because the check exists to stop DNS rebinding, where a page on an attacker's domain points that domain at your machine and sends it as `Host`. An attacker cannot point your tailnet name at your machine, and a browser page cannot choose its `Host`. The app still listens on `127.0.0.1` only; the proxy is the only thing that makes `/metrics` reachable from the tailnet. Without the option, no other host is accepted. The option takes a host name, not a header such as `X-Forwarded-Host`, which any local client can send.
- **The exception for `--proxy-host`.** With `--proxy-host`, every route, including the pages, `/api`, every request that changes something and the Live event stream, also accepts the `Host` a proxy passes on. The reasoning is the same as for `/metrics`: an attacker cannot point your tailnet name at your machine, and a browser page cannot choose its `Host`. The site check below still applies. For such a host, a request is from the same site when `Sec-Fetch-Site` is `same-origin` or `none`, or, for a browser that sends no `Sec-Fetch-Site`, when `Origin` is `https://` or `http://` followed by that host. Another site's `Origin` still gets `403 forbidden cross-site request`. The app still listens on `127.0.0.1` only. **The proxy adds no login, and the pages show full transcripts, secrets included.** Anyone who can reach the proxied address can read everything and start an ingest. Use it only on a private network you control, such as your tailnet, and limit the devices with Tailscale ACLs. Never use Tailscale Funnel or another public proxy for it.
- **The site.** A request to the app's API, and every request that changes something, is refused with `403 forbidden cross-site request` when another site sent it from your browser. A page you visit elsewhere cannot read your figures, start an ingest or mark an error type. The browser's `Sec-Fetch-Site` header, or else its `Origin` header, says who sent a request.
- **The page.** Every response tells the browser not to show the app inside another site's frame. The page may run scripts only from the app itself, and may load nothing from another origin except the Google Fonts files.

There is no password, not even behind a proxy. Requests that carry neither of those browser headers pass, so that `curl` and other command-line tools work. Any program running on your machine can therefore read the app's figures while it runs, including programs of other users on a shared machine. The store file itself stays readable only by you.

## What the pages show

Every page shows text taken from transcripts: project names, folders, git branches, session titles (made from a session's first prompt when the agent wrote none), commands, error messages and error examples. An error example can quote a secret that was in a command or its output.

The [Live](/ai-ledger/pages/live/) page shows the most. Its **Full text** toggle is off each time the page loads. Off, prompts and replies show as word counts, tool results as sizes, tool inputs cut to 300 characters, a failed call's error text up to 700 characters, and subagent calls by their description; a short tool input, such as a command, still shows as written. On, everything shows as written and prompts and replies render as Markdown (raw HTML shows as text, and images show as links and are never loaded). A warning says so until you dismiss it or 6 seconds pass: "Full text on. Prompts, replies and tool output show as written, secrets included.", and the **Full text** toggle keeps a warning tint.

The Cost page's tables download as CSV and copy to the clipboard, with project and session names in them.

### Before you share your screen

A shared screen, a recording or a screenshot shows what the page shows. Before you share, consider:

- **Full text on Live**, which puts transcript content on screen.
- **Project names and folders**, which can name clients or private work. A project filter narrows every page to one project.
- **Error examples and commands**, which can quote secrets even with Full text off.
- **Open sheets**, which show a session's directory and resume command.

The [Share your screen safely](/ai-ledger/improve/share-screen/) playbook gives the steps.

## Trade-offs

- **Keeping everything.** The store keeps every line so that history survives the agents' cleanup. The cost is a file that holds every secret your sessions ever saw. The app protects the file; it does not filter secrets out of it.
- **No password on a local port.** A password would protect the figures from other programs on your machine, but would add an account to a single-user tool. The app relies instead on the loopback address and the request checks above. The file's permissions protect the store on disk, not the figures the running app serves.

## Related

- [How AI Ledger works](/ai-ledger/concepts/how-it-works/): what the store keeps and why.
- [Data files and storage locations](/ai-ledger/reference/storage/): where the store is.
- [Share your screen safely](/ai-ledger/improve/share-screen/).
