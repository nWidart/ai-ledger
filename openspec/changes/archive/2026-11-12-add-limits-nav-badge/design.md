# Design

## The alert is worked out in the ingest loop

`limits.payload()` reads every snapshot and the whole request history to build windows, calibration and forecasts. `/api/status` is polled every minute by every open page, so computing the alert per request would repeat that scan for each tab. The ingest loop already runs on a fixed interval and ends each full cycle with the limit pollers, which is when a window's state can have changed. It calls `payload()` once there, with the arguments `/api/limits` uses and no filters, and keeps `alert_of(payload["windows"])` on the app. `status()` only reads the attribute.

Cost: one more `limits.payload()` per full cycle, every `INTERVAL` (60 s) while the app runs. The fast Live-only passes do not run it. It runs in the loop thread, so it delays the next fast pass of a Live page by the payload's duration: about 0.14 s on a real store of 90,000 requests, once a minute. If a store ever makes it slow, the remedy is to move it to a thread of its own. A manual Refresh calls `ingest()` outside the loop and does not poll limits, so it leaves the alert as the last cycle set it (at most `INTERVAL` old); a second path would be a second place to get this wrong.

It is a read, so it takes no store lock, as the routes read. Any exception leaves the alert `None` and a one-line log with the exception's type only; the loop continues.

## 90%

A forecast needs calibration and counted usage. A window with neither, or one that sits just under its cap with a pace the forecast calls safe, gives no `hits_at`, yet is close to blocking work. 90% is a fixed line, as the page's other thresholds are, and is a module constant (`ALERT_PERCENT`) so it is one edit to change. It is not a setting: no one has asked to tune it, and a setting needs a place in the UI and a stored value.

## Precedence and choice

At its limit beats runs out beats high, because each is a stronger statement about now. Within a kind the choice is the one the page already makes for its binding window (`last_to_reset`, `soonest_run_out`, shared with `binding_of`), and the fullest for high. `count` lets the sentence say that more windows are in alert without listing them.

## No browser notification

A notification needs a permission prompt, and the app must be open to send one, which is the case the nav already covers. The badge is visible on every page and in a pinned tab with no permission.

## The badge

The dot is positioned in the tab's corner, out of the flow, so it never moves a tab or changes how the bar wraps on phones. It uses the theme's `--critical` and, for the warning tone, `--warning-text`: against `--surface-1` they give 4.68 and 5.77 in light, 5.39 and 8.69 in dark. `--warning` itself is 2.99 in light and does not clear 3:1. The sentence sits in the tab's accessible name (a visually hidden span in the link) and as the title of the dot, which is hidden from assistive technology, so a screen reader reads it once; the tab itself has no title. A figure that is an estimate (the window's `measured` flag, cleared by `freshness()` for a provider whose reading is old) says so in the sentence. `alertText` builds it, beside `whenDay` in `pages/limits/limits.ts` so the time reads as on the Limits page. The nav already imports from `pages/` (`Spark`) and every page is in one bundle, so nothing moved. The alert rides the existing status poll: it is part of the shared refresh state, set by every status answer, including a Refresh's own.
