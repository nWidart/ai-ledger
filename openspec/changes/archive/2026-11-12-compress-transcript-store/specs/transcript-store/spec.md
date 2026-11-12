# Spec Delta

## MODIFIED Requirements

### Requirement: Store every transcript line verbatim
The store SHALL keep the exact text of every line from every transcript file under the transcript root, including main session files and subagent files, so any metric can be re-derived later. Reading a line SHALL give back its original text, character for character, whether or not the store packed its long strings.

#### Scenario: Request and response bodies kept
- **WHEN** a transcript contains `user`, `assistant`, `api-request`, `api-request-blob`, `api-request-shape`, `system` or `attachment` lines
- **THEN** the store holds each line's original JSON text, unchanged

#### Scenario: Subagent transcripts included
- **WHEN** a session has files under `<project>/<session>/subagents/*.jsonl`
- **THEN** their lines are stored and marked as subagent lines

#### Scenario: Malformed line
- **WHEN** a line is not valid JSON
- **THEN** the store keeps its text, marks it unparsed, and ingest continues with the next line

#### Scenario: Line with long strings read back
- **WHEN** a line holds a 40,000-character tool result and a 1.2 MB base64 screenshot
- **THEN** reading the line gives the original text, byte for byte

#### Scenario: Text that looks like a reference
- **WHEN** a line contains the text `"~b~` in one of its strings
- **THEN** the store keeps that line whole and reads it back unchanged

## ADDED Requirements

### Requirement: Store repeated long strings once
The store SHALL keep each string of 256 characters or more once, compressed, apart from the lines that contain it, and a line SHALL refer to it. Strings shorter than 256 characters SHALL stay in the line, which SHALL remain valid JSON so that searches for ids in lines keep working. A base64 string that encodes its bytes back to the same characters SHALL be stored as those bytes.

#### Scenario: File read twice
- **WHEN** 30 lines carry the same 80,000-character file content
- **THEN** the store holds that content once, and each of the 30 lines reads back with it

#### Scenario: Short strings stay
- **WHEN** a line's strings are all under 256 characters, such as a `uuid`, a `message.id` and a 200-character prompt
- **THEN** the store keeps the line as it is, and a search for its `uuid` in the line text finds it

#### Scenario: Id search on a packed line
- **WHEN** a line holds a 10,000-character string and the `tool_use` id `toolu_01ABC`
- **THEN** a search for `toolu_01ABC` in the stored line text finds the line, without reading the long string

#### Scenario: Screenshot sent in three requests
- **WHEN** three lines carry the same base64 screenshot of 900,000 characters
- **THEN** the store holds its 675,000 bytes once, and each line reads back the 900,000 characters

#### Scenario: Base64 that does not round-trip
- **WHEN** a 400-character token looks like base64 but encoding its decoded bytes gives different characters
- **THEN** the store keeps it as text and reads it back unchanged

#### Scenario: Ingest of the same line twice
- **WHEN** ingest reads a line again after its file was rewritten
- **THEN** the store adds no second copy of the line or of its strings

### Requirement: Compact a store
`ai-ledger compact`, with the app stopped, SHALL rewrite the store into the current format in a new file, then replace the store with it. Every line SHALL read back unchanged and every table SHALL keep its row count. The old file SHALL NOT be written before the swap. The command SHALL print the lines, the sizes before and after, and the seconds.

#### Scenario: Compact a large store
- **WHEN** the store holds 690,438 lines (5.55 GB of text) in a 2.96 GB file and the user runs `ai-ledger compact`
- **THEN** the file is about 1.61 GB, all 690,438 lines read back identical, and the command prints the lines, both sizes and the time

#### Scenario: Compact fails
- **WHEN** `ai-ledger compact` stops with an error, or the disk fills, before the swap
- **THEN** the store file is as it was, no half-written copy is left, and the command exits with an error

#### Scenario: Row counts differ
- **WHEN** a table of the new file has a different number of rows from the old one
- **THEN** compact discards the new file, leaves the store as it was and reports the table

#### Scenario: App running
- **WHEN** the app or another process has the store open and the user runs `ai-ledger compact`
- **THEN** the command exits with a message that the store is busy, and changes nothing

#### Scenario: Private file
- **WHEN** compact replaces the store
- **THEN** the new file has mode `0600`

#### Scenario: Compact twice
- **WHEN** the user runs `ai-ledger compact` on a store already compacted
- **THEN** every line still reads back identical, and the file is no larger

### Requirement: Open stores from before packing
A store from before long strings were stored once SHALL open and read correctly without any step by the user, with its lines whole. The app SHALL pack only lines stored after the change, until the user runs `ai-ledger compact`.

#### Scenario: Store from before
- **WHEN** the app opens a store of 458,905 whole lines
- **THEN** all 458,905 lines read back unchanged, every Activity, Cost and Errors figure is unchanged, and no start-up conversion runs

#### Scenario: New lines in an old store
- **WHEN** ingest adds 1,000 lines to such a store
- **THEN** the new lines are packed, the old ones stay whole, and a rebuild derives the same records from both

#### Scenario: Rebuild after compact
- **WHEN** the user runs a rebuild on a compacted store
- **THEN** the derived records equal those a rebuild of the same lines held whole produces
