# Spec Delta

## ADDED Requirements

### Requirement: Cache lifetime of a break
A cache break's `expired` cause SHALL use the cache lifetime of its session's source: 1 hour when the previous request wrote to the 1-hour cache, else 30 minutes for a Codex session, else 5 minutes.

#### Scenario: Codex pause within its cache lifetime
- **WHEN** two consecutive turns of a Codex session on the same model are 10 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

#### Scenario: Codex cache expired
- **WHEN** two consecutive turns of a Codex session on the same model are 40 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `expired`

## MODIFIED Requirements

### Requirement: Find the sessions where caching broke
A cache break SHALL be a main-thread request, not the session's first turn, with at least 20,000 prompt tokens of which less than half were cache reads. Its cause SHALL be `model_switch` when its model differs from the previous main-thread request's, else `expired` when more than the cache lifetime passed since that request, else `other`. The page SHALL list the sessions with a break, most uncached tokens first, each with its breaks by cause and the uncached tokens those breaks cost.

#### Scenario: Model switch
- **WHEN** a session's turn on model A reads 80,000 tokens from cache, and the next turn, 20 seconds later on model B, has 85,000 prompt tokens with 0 cache reads
- **THEN** the second turn is a cache break with cause `model_switch`

#### Scenario: Cache expired
- **WHEN** two consecutive turns of a Claude Code session on the same model are 12 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `expired`

#### Scenario: One-hour cache
- **WHEN** a turn writes its prompt to the 1-hour cache, and the next turn on the same model, 12 minutes later, has 60,000 prompt tokens with no cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

#### Scenario: Cache writes are uncached
- **WHEN** a break turn has 60,000 prompt tokens, 59,990 of them written to the cache and 10 plain input
- **THEN** the break counts 60,000 uncached tokens

#### Scenario: Small request
- **WHEN** a request has 9,000 prompt tokens and no cache reads
- **THEN** it is not a cache break

### Requirement: Tip about cache breaks
The cache-breaks rule SHALL fire when a session in the view has 2 or more cache breaks. Its evidence SHALL give the sessions, the breaks by cause and the uncached tokens, and the view's cache-hit ratio. Its advice SHALL say to keep one model through a session when most breaks are model switches, and to keep turns within the cache lifetime or accept the cost when most are expiries, naming the lifetime of each source (5 minutes in Claude Code, 30 minutes in Codex).

#### Scenario: Model switches
- **WHEN** a session has 3 cache breaks, 2 of them model switches
- **THEN** the tip is shown, counts 2 model switches, and advises keeping one model through a session

#### Scenario: Expiries
- **WHEN** most of the cache breaks of the sessions that fire the tip are expiries
- **THEN** the advice says to keep turns within the cache lifetime and names 5 minutes for Claude Code and 30 minutes for Codex
