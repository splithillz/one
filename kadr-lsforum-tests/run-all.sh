#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"
EXT="$(cd "${EXT:-../kadr-lsforum}" && pwd)"
OUT="$(mkdir -p "${OUT:-./out}" && cd "${OUT:-./out}" && pwd)"
mkdir -p "$OUT/logs"
S6='[{"theme":"mint","skin":true},{"theme":"rose","skin":true},{"theme":"grape","skin":true,"fx":"glass"},{"theme":"cobalt","skin":true,"fx":"material"},{"theme":"monet-black","skin":true,"icons":"solar"},{"theme":"monet-white","skin":true,"icons":"remix"}]'
S4='[{"theme":"rose","skin":true},{"theme":"grape","skin":true,"fx":"glass"},{"theme":"monet-black","skin":true,"icons":"solar"},{"theme":"monet-white","skin":true,"icons":"remix"}]'
S3='[{"theme":"rose","skin":true},{"theme":"grape","skin":true,"fx":"glass"},{"theme":"monet-white","skin":true,"icons":"remix"}]'
ALL=off,rose,glass,material,mwhite,mblack,flat
account() {
  local k=$1
  node live-interact.js "$EXT" "$OUT/li-auth-$k" --auth --kinds=$k --states=off,rose,glass,mblack > "$OUT/logs/li-auth-$k.log" 2>&1
  node menus.js "$EXT" --auth --kinds=$k --states=off,rose,glass,mwhite,mblack > "$OUT/logs/menus-auth-$k.log" 2>&1
  node pp.js "$EXT" "$OUT/pp-auth-$k" --auth --kind=$k --states="$S4" > "$OUT/logs/pp-auth-$k.log" 2>&1
  node audit.js "$EXT" "$OUT/audit-auth-$k" --auth --kind=$k > "$OUT/logs/audit-auth-$k.log" 2>&1
}
guest_interactions() {
  node live-interact.js "$EXT" "$OUT/li-guest" --states=$ALL > "$OUT/logs/li-guest.log" 2>&1
  node menus.js "$EXT" --states=$ALL > "$OUT/logs/menus-guest.log" 2>&1
  for v in "phone" "desktop" "phone --light" "desktop --light"; do set -- $v; node monet-check.js "$EXT" "$OUT/monet" --kind=$1 ${2:-} >> "$OUT/logs/monet.log" 2>&1; done
  node flexpseudo.js "$EXT" > "$OUT/logs/flex-guest.log" 2>&1
  node gutter.js "$EXT" > "$OUT/logs/gutter.log" 2>&1
  node post-fit.js "$EXT" > "$OUT/logs/post-fit.log" 2>&1
}
guest_design() {
  for k in phone desktop; do node audit.js "$EXT" "$OUT/audit-$k" --kind=$k > "$OUT/logs/audit-$k.log" 2>&1; node audit.js "$EXT" "$OUT/audit-light-$k" --kind=$k --light > "$OUT/logs/audit-light-$k.log" 2>&1; done
  for k in phone desktop tablet; do node pp.js "$EXT" "$OUT/pp-$k" --kind=$k --states="$S6" > "$OUT/logs/pp-$k.log" 2>&1; done
  for k in phone desktop; do node pp.js "$EXT" "$OUT/pp-light-$k" --kind=$k --light --states="$S3" > "$OUT/logs/pp-light-$k.log" 2>&1; done
  node lsp-collapse2.js "$EXT" "$OUT/lsp" > "$OUT/logs/lsp-collapse.log" 2>&1
  node lsp-collapse2.js "$EXT" "$OUT/lsp-light" --light > "$OUT/logs/lsp-collapse-light.log" 2>&1
  for t in ls-new ls-sheet font-flash ls-fouc ic-fouc scheme-force off-sticky; do echo "== $t" >> "$OUT/logs/misc.log"; node $t.js "$EXT" >> "$OUT/logs/misc.log" 2>&1; done
}
pids=()
if [ -n "${KADR_CRED:-}" ]; then
  account phone & pids+=($!)
  account desktop & pids+=($!)
  node flexpseudo.js "$EXT" --auth > "$OUT/logs/flex-auth.log" 2>&1 &
  pids+=($!)
else
  echo "KADR_CRED is not set: running the guest part only"
fi
guest_interactions & pids+=($!)
guest_design & pids+=($!)
wait "${pids[@]}"
node lsp-frames.js "$EXT" > "$OUT/logs/lsp-frames.log" 2>&1
echo "== failures with the extension on (rows with /off/ are the forum itself)"
grep -h "^FAIL" "$OUT"/logs/*.log | grep -v "/off/" || echo "none"
echo "== interaction totals"; grep -h "checks with the skin" "$OUT"/logs/li-*.log
echo "== menu totals"; grep -h "checks," "$OUT"/logs/menus-*.log
echo "== post content"; grep -h "^post-fit:" "$OUT"/logs/post-fit.log
echo "== audit rows that are not clean"; grep -h "^\[" "$OUT"/logs/audit-*.log | grep -v "contrast hard 0 soft 0 | var fails 0 .*errors+ 0" || echo "none"
echo "== pixel rows that are not clean"; grep -h "^\[" "$OUT"/logs/pp-*.log | grep -v "| text 0 | rows 0 | icons 0/" || echo "none"
