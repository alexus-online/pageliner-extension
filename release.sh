#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./release.sh <version>"
  echo "Example: ./release.sh 1.1.2"
  exit 1
fi

VERSION="$1"
MANIFEST="manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Error: $MANIFEST not found in current directory."
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must match x.y.z (for example 1.1.2)."
  exit 1
fi

CURRENT_VERSION="$(grep -Eo '"version":[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"' "$MANIFEST" | head -n1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+')"

if [[ -z "${CURRENT_VERSION:-}" ]]; then
  echo "Error: could not read current version from $MANIFEST."
  exit 1
fi

if [[ "$CURRENT_VERSION" == "$VERSION" ]]; then
  echo "Version is already $VERSION, nothing to do."
  exit 0
fi

if git rev-parse --verify "v$VERSION" >/dev/null 2>&1; then
  echo "Error: git tag v$VERSION already exists."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit/stash changes first."
  exit 1
fi

sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" "$MANIFEST"

git add "$MANIFEST"
git commit -m "release: v$VERSION"
git tag "v$VERSION"
git push
git push origin "v$VERSION"

echo "Release complete: $CURRENT_VERSION -> $VERSION"
