# Proposal

## Why

The Home page's tour is a GIF: 5.8 MB in dark and 5.3 MB in light, dithered to 256 colors. It is the first image a visitor sees, so it slows the page that should lead to an install, and it stays lazy-loaded because loading it eagerly would fetch both theme variants. An H.264 video made from the same frames is a fraction of the size and keeps every color.

## What Changes

- `tools/demo/record.mjs` also encodes the tour scene as `docs/tour.mp4` and `docs/tour-light.mp4` with ffmpeg, from the same PNG frames it hands gifski. The GIFs stay, for the README.
- `ThemedImage` gains a `video` mode. It renders one muted, looping, inline `<video>` per theme with `preload="none"` and the theme's still as its poster. A small script plays only the variant the current theme shows, only while it is on screen, and switches when the reader changes the theme.
- A pause button sits on the video, so a reader can stop the motion.
- With reduced motion requested, the video does not play and the still shows.
- The Home page uses the video. `site/scripts/sync.mjs` copies the videos a page names, as it does the GIFs. The docs workflow also runs on a change to `docs/*.mp4`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation-site`: animations may be videos; the workflow and the "no second copy" rule cover `docs/*.mp4`; reduced motion and a pause control apply to them.

## Impact

- `tools/demo/record.mjs`, `docs/tour.mp4`, `docs/tour-light.mp4`, `site/scripts/sync.mjs`, `site/src/components/ThemedImage.astro`, `site/src/content/docs/index.mdx`, `.github/workflows/docs.yml`, `site/README.md`, `CONTRIBUTING.md`.
- The recorder needs ffmpeg with libx264.
- No app change.
