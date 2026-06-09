#!/usr/bin/env bash
# Drop Google OAuth creds into .env: ./scripts/set-google.sh <CLIENT_ID> <CLIENT_SECRET>
set -euo pipefail

ID="${1:-}"
SECRET="${2:-}"
if [[ -z "$ID" || -z "$SECRET" ]]; then
  echo "usage: $0 <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>" >&2
  exit 1
fi

ENV_FILE="$(dirname "$0")/../.env"
touch "$ENV_FILE"

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # portable in-place edit (macOS + linux)
    grep -v "^${key}=" "$ENV_FILE" > "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  fi
  echo "${key}=${val}" >> "$ENV_FILE"
}

set_kv GOOGLE_CLIENT_ID "$ID"
set_kv GOOGLE_CLIENT_SECRET "$SECRET"
set_kv NEXT_PUBLIC_GOOGLE_ENABLED "true"

echo "✅ wrote Google creds + enabled the button in .env — restart 'pnpm dev'."
