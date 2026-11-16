# Design

## D1. MP4 with H.264 only

One format plays in every browser the site supports. AV1 or VP9 in WebM would save more bytes but adds a second file per variant and a `<source>` fallback. The tour is short and mostly static screens, so H.264 at `-crf 23` is already far below the GIF. Encode with `-pix_fmt yuv420p -movflags +faststart`, at 960px wide like the GIF, at the recorder's 12 fps.

## D2. Only the scenes the site plays

The recorder writes a video only for scenes named in a `VIDEOS` set (today: `tour`). The README keeps every GIF, since GitHub does not autoplay video in a README, and videos no page uses would only grow the repository.

## D3. The same frames, not a converted GIF

The video is encoded from the resampled PNG frames, so it carries no GIF dithering. Converting `tour.gif` would keep its 256 colors.

## D4. Two videos, one played

The site's theme is a `data-theme` attribute, not a media query, so `<source media>` cannot pick the variant. Both `<video>` elements are in the page, the hidden one `display: none`, both `preload="none"` so neither loads before the script asks. The script:

- plays the variant the theme shows when it intersects the viewport, and pauses it when it leaves;
- pauses the hidden variant, and on a `data-theme` change swaps which one plays;
- does nothing when `prefers-reduced-motion: reduce` matches, leaving the poster (the still) on screen.

Both `<video>` elements carry the alt text as `aria-label`, and the hidden one is `display: none`, so a screen reader announces one.

## D5. A pause button

WCAG 2.2.2 asks for a way to pause motion that lasts more than 5 seconds. A button in the video's corner toggles play and pause for the visible variant, names its action ("Pause animation", "Play animation"), and works by keyboard with the site's focus ring. A reader's pause sticks across theme changes.
