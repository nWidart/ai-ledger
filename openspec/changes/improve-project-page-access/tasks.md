# Tasks

1 and 2 are independent. 3 needs both.

## 1. Navigation chip

- [x] 1.1 `web/src/components/Nav.tsx`: one `Link` to `/project` over the name and a "Page →" label; visually hidden "project" between them; arrow `aria-hidden`; no `title`; no arrow on `/project`, where the link has `aria-current="page"`.
- [x] 1.2 `web/src/components/Nav.css`: style "Page →" as an inner pill (the tabs' current rule already tints the chip's link); at 520px and below, label kept and a 32px minimum height for the link and Clear.
- [x] 1.3 Tests: the link's accessible name is "foo project page" and its href keeps the view; one link to `/project` in the chip; on `/project` it is current; update `router.test.tsx` selectors that read `#navFilter b`.

## 2. Palette project-page rows

- [x] 2.1 `web/src/components/palette/suggest.ts`: project-page rows per D3 and D4.
- [x] 2.2 `web/src/components/palette/Palette.tsx`: one helper that turns a row into chips, used by the footer preview, Tab, Enter, click and touch; one announcement for both chips.
- [x] 2.3 Tests in `suggest.test.ts`, `Palette.test.tsx`: `jobdesk` lists the project then its page row; committing the row opens `/project?project=jobdesk` with the view's range; `jobdesk >errors` chips the project and opens Errors; `>jobdesk #7d` chips the page row; `#job` lists no page row; empty `>` lists no page row; the row stays with a pre-filled `#jobdesk` and is gone on `/project?project=jobdesk`; Tab adds both chips.

## 3. Integration

- [x] 3.1 README and CHANGELOG `[Unreleased]`.
- [x] 3.2 `cd web && npm run check`; commit the build in `src/ai_ledger/web/`; `openspec validate --specs --strict`.
