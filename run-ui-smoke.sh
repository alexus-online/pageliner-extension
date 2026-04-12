#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found. Install Node.js first."
  exit 1
fi

if [[ ! -d "node_modules/@playwright/test" ]]; then
  echo "Installing test dependencies..."
  npm install
fi

echo "Running UI smoke test..."
npm run test:ui:smoke
echo "UI smoke passed."
