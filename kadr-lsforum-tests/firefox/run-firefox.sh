#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"
: "${FF:?set FF to the firefox binary (see ../README.md)}"
OUT="$(mkdir -p "${OUT:-../out/firefox}" && cd "${OUT:-../out/firefox}" && pwd)"
EXT="$(./build-test-ext.sh "$OUT/test-ext")"
node xb-ff.js "$EXT" "$OUT" > "$OUT/xb-ff.log" 2>&1 &
node xb-cr.js "$EXT" "$OUT" > "$OUT/xb-cr.log" 2>&1 &
wait
node xb-compare.js "$OUT/ff.json" "$OUT/cr.json" | tee "$OUT/compare.log" | grep -E "^FAIL|firefox-vs-chromium" | tail -40
node ff-interact.js "$EXT" "$OUT" | tee "$OUT/interact.log" | grep -E "^FAIL|ff-interact:"
