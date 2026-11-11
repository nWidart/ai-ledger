# Design

## Context

`serve` binds `127.0.0.1:<port>`, prints the URL and serves until interrupted.

## Decisions

### Always open, right after listening
Once the socket is bound, `serve` calls `webbrowser.open` on `http://127.0.0.1:<port>/`. The browser's request waits in the listen backlog until `serve_forever` runs, so there is no race. A tab left open from an earlier run gets a sibling; waiting for it to reconnect delayed every start and was dropped.

### Open only where someone can see it
`webbrowser` on a Linux machine without a display can fall back to a text browser that takes over the terminal. The app opens nothing when standard output is not a terminal, or on Linux when neither `DISPLAY` nor `WAYLAND_DISPLAY` is set. This also keeps CI's smoke test quiet.

### `serve(…, open_page=False)`
`serve` opens nothing by default. `main` passes `open_page=not a.no_open`. Tests and `tools/demo/serve.py` call `serve` and keep their behavior.

## Risks

- A failed `webbrowser.open` returns `False` or raises. The app prints the URL either way, and errors are ignored.
