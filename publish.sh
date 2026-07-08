#!/usr/bin/env bash
# One-command Chrome Web Store publish for CoStar → Survey Pusher.
# Zips the extension, uploads the new version, and publishes it (Unlisted).
# Credentials live in .secrets/cws_tokens.json (gitignored). First-time store
# LISTING (description/screenshots/privacy) must be done once in the dashboard;
# after that this script handles every version update end to end.
set -euo pipefail
cd "$(dirname "$0")"

ITEM_ID="hohikcikmjiopimpigebcbdileipbhhc"
SECRETS=".secrets/cws_tokens.json"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
ZIP="masterappsurvey-v${VERSION}.zip"

echo "→ Packaging v${VERSION}"
rm -f "$ZIP"
zip -rq "$ZIP" manifest.json config.js supabase.js background.js panel.html panel.js panel.css icons -x '*.DS_Store'

CID=$(python3 -c "import json;print(json.load(open('$SECRETS'))['client_id'])")
CSEC=$(python3 -c "import json;print(json.load(open('$SECRETS'))['client_secret'])")
RTOK=$(python3 -c "import json;print(json.load(open('$SECRETS'))['refresh_token'])")
ATOK=$(curl -s https://oauth2.googleapis.com/token -d "client_id=$CID" -d "client_secret=$CSEC" -d "refresh_token=$RTOK" -d "grant_type=refresh_token" | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])")

echo "→ Uploading"
curl -s -X PUT -H "Authorization: Bearer $ATOK" -H "x-goog-api-version: 2" -T "$ZIP" \
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/${ITEM_ID}" | python3 -m json.tool

echo "→ Publishing"
curl -s -X POST -H "Authorization: Bearer $ATOK" -H "x-goog-api-version: 2" -H "Content-Length: 0" \
  "https://www.googleapis.com/chromewebstore/v1.1/items/${ITEM_ID}/publish" | python3 -m json.tool
