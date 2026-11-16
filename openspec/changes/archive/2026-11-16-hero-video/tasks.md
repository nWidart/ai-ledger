# Tasks

## 1. Record

- [x] 1.1 `record.mjs`: for scenes in a `VIDEOS` set (`tour`), also encode `docs/<scene>[-light].mp4` with ffmpeg from the resampled frames (design D1 to D3).
- [x] 1.2 Record the tour scene and commit `docs/tour.mp4` and `docs/tour-light.mp4`.
- [x] 1.3 `site/scripts/sync.mjs` copies the videos a page names; `.github/workflows/docs.yml` also runs on `docs/*.mp4`.

## 2. Play

- [x] 2.1 `ThemedImage` `video` mode: two `<video>` elements, the still as poster, the play script and the pause button (design D4, D5).
- [x] 2.2 The Home page uses the video.

## 3. Docs and checks

- [x] 3.1 `site/README.md` and `CONTRIBUTING.md` describe the videos and the ffmpeg need.
- [x] 3.2 `cd site && npm run check` and `openspec validate --specs --strict` pass; check light, dark, theme switch, reduced motion and the pause button in a browser.
