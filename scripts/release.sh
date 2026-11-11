#!/usr/bin/env bash
# Prepares a release commit on a new branch: bumps the version in pyproject.toml and uv.lock, and turns
# the [Unreleased] section of CHANGELOG.md into the new version's section.
# The Release PR workflow (.github/workflows/release-pr.yml) runs it, then pushes the branch and opens the PR.
# Needs uv and python3.
#
# Usage: scripts/release.sh [auto|patch|minor|major]
# auto (the default) picks the bump from the [Unreleased] section and the commits since the last tag.
set -euo pipefail

bump=${1:-auto}
case "$bump" in
  auto | patch | minor | major) ;;
  *)
    echo "Usage: scripts/release.sh [auto|patch|minor|major]" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean." >&2
  exit 1
fi

# The larger of two readings. CHANGELOG.md: a Removed section or a BREAKING note is major, an Added or
# Deprecated section is minor. Conventional Commits since the last tag: `type!:` or a BREAKING CHANGE
# footer is major, `feat:` is minor. Anything else is patch. Before 1.0.0, major becomes minor.
auto_bump() {
  local section range last subjects messages
  section=$(awk '/^## \[/ { p = $0 == "## [Unreleased]"; next } /^\[[^]]*\]: / { p = 0 } p' CHANGELOG.md)
  range=HEAD
  if last=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null); then
    range="$last..HEAD"
  fi
  subjects=$(git log --format=%s "$range")
  messages=$(git log --format=%B "$range")

  if grep -qE '^### Removed|BREAKING' <<<"$section" ||
    grep -qE '^[a-z]+(\([^)]*\))?!:' <<<"$subjects" ||
    grep -qE '^BREAKING[ -]CHANGE:' <<<"$messages"; then
    if [[ $(uv version --short) == 0.* ]]; then echo minor; else echo major; fi
  elif grep -qE '^### (Added|Deprecated)' <<<"$section" || grep -qE '^feat(\([^)]*\))?:' <<<"$subjects"; then
    echo minor
  else
    echo patch
  fi
}

if [ "$bump" = auto ]; then
  bump=$(auto_bump)
  echo "auto picked a $bump bump."
fi

version=$(uv version --bump "$bump" --dry-run --short)
tag="v$version"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "Tag $tag already exists." >&2
  exit 1
fi

# Renames [Unreleased] to the new version, leaves an empty [Unreleased] above it, and adds the version's link.
python3 - "$version" "$(date +%Y-%m-%d)" <<'EOF'
import re, sys

version, date = sys.argv[1], sys.argv[2]
with open("CHANGELOG.md") as f:
    text = f.read()

match = re.search(r"^## \[Unreleased\]\n(.*?)(?=^## \[|^\[[^]]+\]: |\Z)", text, re.M | re.S)
if not match or not match.group(1).strip():
    sys.exit("CHANGELOG.md has no [Unreleased] entries to release.")

text = text[: match.start()] + f"## [Unreleased]\n\n## [{version}] - {date}\n" + match.group(1) + text[match.end() :]
link = f"[{version}]: https://github.com/nWidart/ai-ledger/releases/tag/v{version}\n"
links = re.search(r"^\[[^]]+\]: ", text, re.M)
text = text[: links.start()] + link + text[links.start() :] if links else text.rstrip("\n") + "\n\n" + link

with open("CHANGELOG.md", "w") as f:
    f.write(text)
EOF

uv version "$version" --no-sync --quiet
git switch -q -c "release/$tag"
git commit -q -am "chore: release $version"

echo "Created branch release/$tag."
if [ -z "${GITHUB_ACTIONS:-}" ]; then
  echo "Review CHANGELOG.md, then push the branch and open a pull request against main."
  echo "Merging it starts the Release workflow, which checks, tags and publishes $tag."
fi
