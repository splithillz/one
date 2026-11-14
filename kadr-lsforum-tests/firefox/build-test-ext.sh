#!/usr/bin/env bash
set -eu
SRC="$(cd "$(dirname "$0")/../../kadr-lsforum" && pwd)"
DST="${1:-$(mktemp -d)/kadr-test-ext}"
rm -rf "$DST" && mkdir -p "$(dirname "$DST")" && cp -r "$SRC" "$DST"
cp "$(dirname "$0")/test-set.js" "$DST/test-set.js"
node -e '
const fs = require("fs"), p = process.argv[1], m = JSON.parse(fs.readFileSync(p, "utf8"));
m.content_scripts[0].js = ["test-set.js"].concat(m.content_scripts[0].js);
fs.writeFileSync(p, JSON.stringify(m, null, 2));
' "$DST/manifest.json"
echo "$DST"
