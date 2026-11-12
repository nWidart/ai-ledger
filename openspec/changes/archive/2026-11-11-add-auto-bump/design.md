# Design

## Decisions

### Read both the changelog and the commits
Squash subjects undersell large PRs: #8 is `fix:` but its changelog entries add features. A changelog entry can be forgotten while the commit says `feat:`. Taking the larger reading covers both.

### Subjects for types, full messages only for the footer
GitHub's squash body lists the original commits as `* feat: …`. Matching types on subjects only keeps those lines from counting; the `BREAKING CHANGE:` footer is matched at the start of any message line.

### No git-cliff
Reading section headings and subjects takes a few `grep` calls; git-cliff would add a pinned binary and a config file only for the bump.

### Breaking before 1.0.0 is minor
SemVer leaves 0.y.z open, and the common convention (Cargo, git-cliff's `breaking_always_bump_major = false`) bumps minor. Going to 1.0.0 stays an explicit `major`.
