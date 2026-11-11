# Tasks

- [x] 1.1 Add `auto` to `scripts/release.sh`, as the default, with the rules in the proposal. Verify on a scratch clone: Added section (minor), only fixes (patch), `feat:` subject (minor), `feat!:` at 0.x (minor), `BREAKING CHANGE:` footer at 1.x (major), Removed section at 1.x (major), `* feat:` in a squash body only (patch).
- [x] 1.2 Add `auto` to the Release PR workflow's bump choice, as the default. Verify with `actionlint`.
- [x] 1.3 Update the release rule in `AGENTS.md`.
