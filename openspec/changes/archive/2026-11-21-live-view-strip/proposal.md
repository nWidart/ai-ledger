# Proposal

## Why

Live's Stream view spends a 290px column on the agent panel, so the stream, the one part the user reads, gets what is left: 798px of a 1440px window. The panel's tokens-per-minute chart counts cache reads, so a session that only rereads its context looks busy, and the chart says nothing about what the session did. The rail shows each session's state but not how full its context is, whether it fails, or what it runs. On the Wall, picking a tile leaves the Wall, so the user cannot watch two sessions and the rest at once.

The page also spends height before the first event. The connection status takes a line of its own. The Full text banner pushes the stream down by 55px when it appears, and on a phone the rail stacks every group above the stream.

## What Changes

- **Status strip.** A compact strip above the stream replaces the agent panel: the state and its detail, a context meter, cost, tool calls, errors (still the failed-calls filter), cache-read share, plan-limit use, the pulse, the session's working directory and Copy resume. The stream takes the freed width.
- **Pulse.** In place of the tokens-per-minute chart, a pulse of the last 10 minutes: the context of each main-thread request, and a tick per finished tool call, ✓ for a success and ✕ for a failure. It reads by keyboard, one minute at a time, and has a text alternative. The session payload's `spark` becomes `pulse`, and the payload gains `cwd`.
- **Rail rows.** Each rail entry gains a third line: a small context meter with its percent, the latest action, and the error count with a ✕.
- **Wall pins.** Selecting a tile pins its stream beside the tiles, up to 2. Pinning a third replaces the oldest and says so. A pinned stream has Unpin and Open in Stream. The pins are kept in the URL (`pin=a,b`). The update connection stays open through pinning, unpinning and sheets.
- **Height.** The connection status moves into the bar. The Full text warning opens over the page, below the bar, and is dismissed in place, so nothing moves. Below 721px the rail is one row that scrolls sideways inside itself.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `live-dashboard`: the status strip and the pulse in place of the agent panel; the rail entry's third line; Wall pins and their URL key; one update connection; the Full text warning; the narrow layout.
- `live-sessions`: the session's working directory, and the pulse in place of tokens per minute.
- `dashboard-app`: the explanation of a Live figure is now in the status strip, not the agent panel.

## Impact

- `src/ai_ledger/live.py`: `pulse()` replaces `spark()`; `session()` returns `cwd`.
- `web/src/pages/live/`: `AgentPanel.tsx` goes; `Strip.tsx` and `Pulse.tsx` arrive; `LivePage`, `Wall`, `Stream`, `useLive`, `search.ts` and `live.css` change.
- Docs: README, the Live docs page and the glossary; the `live-status` screenshot becomes `live-strip`.
