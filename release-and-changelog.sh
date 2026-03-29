#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: ./release-and-changelog.sh <version> [page_id]"
  echo "Example: ./release-and-changelog.sh 1.1.2"
  echo "Example: ./release-and-changelog.sh 1.1.2 3791"
  exit 1
fi

VERSION="$1"
PAGE_ID="${2:-3791}"
SERVICE_NAME="wp_app_password_kaiser_alexander"

if [[ ! -x "./release.sh" || ! -x "./update-changelog.sh" ]]; then
  echo "Error: release.sh and update-changelog.sh must exist and be executable."
  exit 1
fi

if [[ -z "${WP_URL:-}" || -z "${WP_USER:-}" ]]; then
  echo "Error: WP_URL and WP_USER must be set."
  echo "Example:"
  echo "  export WP_URL=\"https://kaiser-alexander.de\""
  echo "  export WP_USER=\"alexander\""
  exit 1
fi

# Try to load WordPress App Password from macOS Keychain if not already set.
if [[ -z "${WP_APP_PASSWORD:-}" ]]; then
  if WP_APP_PASSWORD="$(security find-generic-password -a "${WP_USER}" -s "${SERVICE_NAME}" -w 2>/dev/null)"; then
    export WP_APP_PASSWORD
    echo "Loaded WP app password from Keychain (${SERVICE_NAME})."
  else
    read -r -s -p "WordPress App Password: " WP_APP_PASSWORD
    echo
    export WP_APP_PASSWORD
  fi
fi

echo "Step 1/2: Release v${VERSION}"
./release.sh "$VERSION"

echo "Step 2/2: Update changelog page ${PAGE_ID}"
./update-changelog.sh "$VERSION" "$PAGE_ID"

echo "All done."
