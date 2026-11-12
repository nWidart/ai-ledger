# Proposal

## Why

GitHub issue #4 (Errors page UX review). The open type's detail shows where the type happens by project, but says nothing comparable about which tools and which agents produce it beyond a "Mostly Bash, Edit" phrase.

## What Changes

- **By tool and By agent.** Next to "By project", the type detail lists the type's top five tools and top five agents with count and share, and folds the rest ("3 more: 12 errors"). The three breakdowns share one component.
- **Agent rows filter the page.** A By agent row sets the page's source filter, as a By project row sets the project. By agent is hidden under a source filter and when the type's errors come from one agent only.
- **Tool rows filter the detail.** A By tool row narrows the open type's detail only (incident sentence, By project, By agent, incidents and examples): the page's error rate needs tool calls per tool, which the payload does not carry, and a page-wide tool filter is the parked `add-tool-filter` change. The selection is the `etool` hash key (`tool` opens the tool sheet), pushes a history entry, is not saved with the last view, and applies on top of the chart bucket. A pressed row and a removable chip clear it. It clears when the type closes, another type opens, or the type has no error of that tool in the view. A linked example of another tool is outside the filters; Clear filters clears the tool; a permalink leaves it out.
- **Drop "Mostly ...".** By tool makes the phrase redundant, so it and `topTools` go.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: new requirements "Break a type down by tool and agent" and "Narrow the type detail to a tool".

## Impact

- `web/src/pages/errors/` (`model.ts`, `view.ts`, `ErrorsPage.tsx`, `Detail.tsx`, `errors.css`, tests, `PARITY.md`), README, CHANGELOG. No payload or backend change.
