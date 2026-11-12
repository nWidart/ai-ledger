# Spec Delta

## ADDED Requirements

### Requirement: Show a scoped limit's share and the week's use by surface
An open-window card whose window has a share of the weekly allowance SHALL say, in a small muted line under the forecast lines, "This limit is <allowance>% of the weekly allowance; <used>% of the weekly allowance is used through it". A card whose window has surfaces SHALL say, in the same style, "All of this week's use so far came from <label>" when one surface has 100%, else "This week's use by surface: <label> <percent>%, …" listing the surfaces with use, most first. A card whose surfaces are all 0% SHALL show no surfaces line. A card without a share or without surfaces SHALL show no such line. Percents SHALL read as whole numbers. The lines SHALL NOT change the heading, the status strip, the captions, the pace line or the freshness line, and the hint that estimates count local agent work only SHALL stay.

#### Scenario: A scoped card
- **WHEN** the Fable window has a share of 21% used of a 50% allowance
- **THEN** its card reads "This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it"

#### Scenario: One surface made all the use
- **WHEN** the unscoped weekly window's surfaces are Claude Code 100%, Chats 0%, Cowork 0%
- **THEN** its card reads "All of this week's use so far came from Claude Code"

#### Scenario: A mix of surfaces
- **WHEN** the surfaces are Claude Code 40%, Chats 60%, Cowork 0%
- **THEN** the card reads "This week's use by surface: Chats 60%, Claude Code 40%"

#### Scenario: No use yet
- **WHEN** every surface is 0%
- **THEN** the card shows no surfaces line

#### Scenario: No field
- **WHEN** a window has no share and no surfaces
- **THEN** its card shows neither line
