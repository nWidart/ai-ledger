# Design

## The payload stays small

A weekly window's series is about 170 points; a 5-hour one is about 60. History can hold hundreds of windows, so a curve in every history row would grow `/api/limits` by hundreds of kilobytes for something read on one click. The strip needs only what a history row already has (final percent, hit, early, estimated), so the payload carries the identity of each window (`limit_id`, `scope`, `window_minutes`, `resets_at`, with the existing `provider` and `start`) and nothing more. The curve is fetched when a bar is picked, from `/api/limits/window`, through `useApi`, so it is cached by URL and refetched after an ingest like any other answer.

## One way to list a limit's windows

`payload()` and the route must agree on which windows exist, or a bar could point at a window the route cannot find. They share `limit_windows(ws, usage, now, start)`: close the limit's measured windows, calibrate, and add the estimated windows before its first snapshot back to a horizon. The payload passes the range's start as the horizon; the route passes none, so its horizon is the provider's first counted use, which no range reaches back past. Every window `payload()` lists at any range is therefore one the route finds.

## The route

A window is found by its limit (`provider`, `limit_id`, `scope`): the limit's window nearest the `start` asked for, closed or open, served when it is closed and within the usual reset drift (`SAME_RESET`) of it (the history row's own `start` is what the page sends). Matching the nearest of all, not the nearest closed one, keeps an open window whose first reading came a minute after a closed window's from being answered with that closed window. Only closed windows are served: the open window has a card. A closed window's final percent is its last reading, so after that reading its curve is flat at it (`closed_series`), not an estimate from use counted since; estimates between readings stay. The answer is `{window, series, events}`: the history row, the series from the window's start to its close (the same `series()` the open card uses, ending at the close instead of now), and the provider's plan changes inside the window. Unknown provider or a `start` that is not a time answer 400; no such closed window answers 404. Snapshots, calibration and the forecast do not change.

## The page

The chart is the open cards' `LimitChart`, with `now: null` meaning a closed window: no now line, no forecast, "ended" in place of "resets". The page builds the chart's window from the history row and the series (`closedWindow`), so the chart takes one shape of window.

A strip is up to 60 buttons. To keep one tab stop per strip, the bars use a roving tabindex: the bar last focused, kept by the window's identity so a refresh that shifts the strip cannot move it (else the picked one, else the newest), has `tabindex=0`, Left and Right move focus, Home and End go to the ends. A strip too wide for its box scrolls inside it, opening on its newest bars.
