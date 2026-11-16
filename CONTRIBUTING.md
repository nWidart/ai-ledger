# Contributing to AI Ledger

## Setup

You need [uv](https://docs.astral.sh/uv/) and Node.

```bash
uv sync                                    # Python 3.14 and dependencies
cd web && npm install
```

Never run the app against your live store while you develop. Copy the store and point the app at the copy:

```bash
uv run ai-ledger --db <copy> --port 8766
cd web && npm run dev                      # http://127.0.0.1:5173, /api proxied to the app
```

The store holds full transcript content, including secrets. Never commit, print or paste it.

## Checks

Run these before you commit:

```bash
uv run ruff check                          # lint Python
uv run python -m unittest discover -s tests
cd web && npm run check                    # typecheck, lint, test and build
openspec validate --specs --strict         # after a change under openspec/specs/
```

Commit the build in `src/ai_ledger/web/` with every `web/src` change. CI fails when the build is stale.

After a payload change, regenerate the page-test fixtures in `web/src/__fixtures__/`:

```bash
uv run python -m unittest tests.test_web_fixtures
```

After a parser or `categorize.py` change, run `uv run ai-ledger rebuild` (with the app stopped) to regenerate the derived tables.

## Web app

### Data

The web app fetches through TanStack Query.

- Each endpoint has one options factory in `web/src/queries.ts`: its key, URL and payload type.
- Pages read the factories through `useApi` in `web/src/useApi.ts`.
- Data refetches only when an ingest stores something or Refresh runs. The status poll and Live's recheck are the only requests on a timer.
- `npm run dev` shows the TanStack Query devtools as a button in the bottom-left corner. The built app ships none.

### Routing

TanStack Router owns the URL. The page is the path and the view is the query string, for example `/usage?project=foo&range=30`.

- The routes are in `web/src/router.tsx`, one per page. Each route loads its page's code and starts its main query.
- Pages read the view with `useView` and `useSearchOf`, and change it with `setSearch`, all in `web/src/url.ts`.
- The `search.ts` file beside each page types that page's own keys.
- A link in the earlier hash form (`/usage#project=foo`) redirects to the query string. Keep that redirect.
- `npm run dev` also shows the Router devtools.

### Tests

- Tests render through `renderApp` from `web/src/testing.tsx`, which gives each test its own query client and router.
- A test of the whole app, routes included, renders through `renderRouter`.

## Specs and changes

Page behavior is specified in `openspec/specs/`. Plan each feature as an OpenSpec change in `openspec/changes/`, on its own branch from `main`.

When user-visible behavior changes:

- Update `README.md` or the docs site in `site/`.
- Add the change to the `[Unreleased]` section of `CHANGELOG.md`.

## Demo GIFs

[`tools/demo/`](tools/demo/) records the GIFs in `docs/` from a synthetic store, and the `docs/*.mp4` videos the docs site plays. Recording needs ffmpeg with libx264 for the videos.

## Maintainers

Maintainer notes, including releases, are in [AGENTS.md](AGENTS.md).
