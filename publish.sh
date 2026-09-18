#!/usr/bin/env bash
# Distribution is intentionally separate from packaging. An authorized release
# must verify the current Store API, unused version, upload and accepted draft
# before a separate publication step. Never publish from an unchecked upload.
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${1:-}" == "--package-only" ]]; then
  shift
  exec ./package.sh "$@"
fi
printf '%s\n' 'No upload or publication attempted. Use ./package.sh for a local review ZIP.' 'Store distribution requires a separately authorized, checked release workflow in CHROMEWEBSTORE.md.' >&2
exit 2
