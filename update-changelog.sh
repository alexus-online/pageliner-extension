#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: ./update-changelog.sh <version> [page_id]"
  echo "Example: ./update-changelog.sh 1.1.2"
  echo "Example: ./update-changelog.sh 1.1.2 3791"
  exit 1
fi

VERSION="$1"
PAGE_ID="${2:-3791}"
TODAY="$(date +%d.%m.%Y)"
ATTRIBUTION_TEXT="PageLiner is based on the original PageLiner project by Kai Neuwerth and distributed under Apache License 2.0."

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must match x.y.z (for example 1.1.2)."
  exit 1
fi

if [[ -z "${WP_URL:-}" || -z "${WP_USER:-}" ]]; then
  echo "Error: WP_URL and WP_USER must be set."
  echo "Example:"
  echo "  export WP_URL=\"https://kaiser-alexander.de\""
  echo "  export WP_USER=\"alexander\""
  exit 1
fi

if [[ -z "${WP_APP_PASSWORD:-}" ]]; then
  read -r -s -p "WordPress App Password: " WP_APP_PASSWORD
  echo
  export WP_APP_PASSWORD
fi

NEW_BODY="<ul><li>MV3 hardening and permission cleanup</li><li>i18n improvements (EN/DE)</li><li>Updated changelog link and release workflow</li></ul><h3>Fixes</h3><ul><li>Removed dead external changelog URL</li><li>Stability fixes in extension scripts</li></ul>"
NEW_ENTRY="<h2>Version ${VERSION} (${TODAY})</h2>${NEW_BODY}"
ATTRIBUTION_HTML="<p><em>${ATTRIBUTION_TEXT}</em></p>"

json_escape() {
  perl -0777 -pe 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g' <<<"$1"
}

echo "Updating page ${PAGE_ID} on ${WP_URL}..."

API_URL="${WP_URL%/}/wp-json/wp/v2/pages/${PAGE_ID}"

# Quick auth check first, so 401 errors are explicit.
curl -sS -f -L -u "${WP_USER}:${WP_APP_PASSWORD}" \
  "${WP_URL%/}/wp-json/wp/v2/users/me" >/dev/null

CURRENT_PAGE_JSON="$(curl -sS -f -L -u "${WP_USER}:${WP_APP_PASSWORD}" \
  "${API_URL}?context=edit")"

EXISTING_CONTENT="$(printf "%s" "$CURRENT_PAGE_JSON" | perl -MJSON::PP -e 'local $/; my $j = decode_json(<>); print $j->{content}{raw} // q{};')"

if [[ "$EXISTING_CONTENT" == *"Version ${VERSION}"* ]]; then
  echo "Version ${VERSION} already exists on the changelog page. Nothing to do."
  exit 0
fi

# Avoid noisy version bumps: if the exact change body already exists,
# skip creating another entry with only a different version number/date.
if [[ "$EXISTING_CONTENT" == *"$NEW_BODY"* ]]; then
  echo "No content change detected (same changelog body already present). Skipping new entry."
  exit 0
fi

if [[ -z "$EXISTING_CONTENT" ]]; then
  CONTENT="${ATTRIBUTION_HTML}<hr>${NEW_ENTRY}"
elif [[ "$EXISTING_CONTENT" == *"$ATTRIBUTION_TEXT"* ]]; then
  CONTENT="${NEW_ENTRY}<hr>${EXISTING_CONTENT}"
else
  CONTENT="${ATTRIBUTION_HTML}<hr>${NEW_ENTRY}<hr>${EXISTING_CONTENT}"
fi

ESCAPED_CONTENT="$(json_escape "$CONTENT")"
DATA="{\"title\":\"PageLiner Changelog\",\"status\":\"publish\",\"content\":\"${ESCAPED_CONTENT}\"}"

RESPONSE="$(curl -sS -f -L -u "${WP_USER}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -X POST "${API_URL}" \
  --data-binary "$DATA")"

if [[ "$RESPONSE" != *"\"id\":${PAGE_ID}"* ]]; then
  echo "Error: unexpected API response."
  echo "$RESPONSE"
  exit 1
fi

LINK="$(printf "%s" "$RESPONSE" | sed -n 's/.*"link":"\([^"]*\)".*/\1/p' | head -n1 | sed 's#\\/#/#g')"
MODIFIED="$(printf "%s" "$RESPONSE" | sed -n 's/.*"modified":"\([^"]*\)".*/\1/p' | head -n1)"

echo "Done: ${LINK:-${WP_URL}}"
echo "Modified: ${MODIFIED:-unknown}"
echo "Prepended version: ${VERSION}"
