#!/bin/bash
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
REAL=""
[ "${1:-}" = "--real" ] && REAL="--real"
WORK=${WORK:-$(mktemp -d /tmp/rps-e2e.XXXXXX)}
mkdir -p "$WORK/shots"
export DISPLAY=${E2E_DISPLAY:-:97}
export WINEPREFIX=${E2E_PREFIX:-$WORK/prefix}
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml="
PORT=${E2E_PORT:-8790}
DESK="/desktop=e2e,1280x800"
APPDIR="$WINEPREFIX/drive_c/users/$(whoami)/AppData/Roaming/RPSpeller"
APPLOG="$APPDIR/log.txt"
GAMELOG="$WORK/game.log"
RELAYLOG="$WORK/relay.log"
MODE="$WORK/mode"
PASS=0
FAIL=0

say() { printf '\n== %s\n' "$*"; }
check() {
    local name=$1
    shift
    if "$@"; then
        echo "PASS  $name"
        PASS=$((PASS + 1))
    else
        echo "FAIL  $name"
        FAIL=$((FAIL + 1))
    fi
}
wait_file() {
    local file=$1 pattern=$2 timeout=${3:-10} end=$((SECONDS + ${3:-10}))
    while ((SECONDS < end)); do
        grep -qE -- "$pattern" "$file" 2>/dev/null && return 0
        sleep 0.2
    done
    return 1
}
count() {
    local c
    c=$(grep -cE -- "$2" "$1" 2>/dev/null)
    echo "${c:-0}"
}
wait_more() {
    local file=$1 pattern=$2 before=$3 timeout=${4:-10} end=$((SECONDS + ${4:-10}))
    while ((SECONDS < end)); do
        [ "$(count "$file" "$pattern")" -gt "$before" ] && return 0
        sleep 0.2
    done
    return 1
}
last_sent() { grep -E '^[0-9]+ sent: ' "$GAMELOG" | tail -1 | sed -E 's/^[0-9]+ sent: //'; }
winpath() { echo "Z:$(echo "$1" | sed 's#/#\\#g')"; }
type_ru() { LC_ALL=C.UTF-8 xdotool type --delay "${TYPE_DELAY:-80}" "$1"; }
prime() {
    LC_ALL=C.UTF-8 xdotool type --delay 60 "ё"
    xdotool key BackSpace
    sleep 0.3
}
shot() { import -window root "$WORK/shots/$1.png" 2>/dev/null; }
clip_get() { xclip -o -selection clipboard 2>/dev/null; }
clip_set() { printf '%s' "$1" | xclip -selection clipboard; }
mode() { printf '%s' "$1" > "$MODE"; }
focus_game() {
    local d
    d=$(xdotool search --name "Wine desktop" | head -1)
    xdotool mousemove --window "$d" 600 200 click 1
    sleep 0.6
}
in_desktop() { (cd "$WORK" && wine explorer "$DESK" "$@" >> "$WORK/wine.out" 2>&1 &); }
start_game() {
    local before
    before=$(count "$GAMELOG" " start$")
    (cd "$WORK" && FAKEGAME_LOG="$GAMELOG" wine explorer "$DESK" "$(winpath "$WORK/fakegame.exe")" >> "$WORK/wine.out" 2>&1 &)
    wait_more "$GAMELOG" " start$" "$before" 30
}
start_app() {
    local before
    before=$(count "$APPLOG" "started")
    (cd "$WORK" && RPSPELLER_SPELLER_URL="http://127.0.0.1:$PORT/check" wine explorer "$DESK" "$(winpath "$WORK/RPSpeller.exe")" >> "$WORK/wine.out" 2>&1 &)
    wait_more "$APPLOG" "started" "$before" 30
}
poke() { in_desktop "$(winpath "$WORK/poke.exe")" "$@"; }
open_settings() {
    in_desktop "$(winpath "$WORK/RPSpeller.exe")"
    sleep 3
}
cfg_has() { grep -qE -- "$1" "$APPDIR/config.json" 2>/dev/null; }
alive() { pgrep -f '^Z:.*RPSpeller\.exe$' > /dev/null; }

cleanup() {
    wineserver -k 2> /dev/null
    [ -n "${RELAY_PID:-}" ] && kill "$RELAY_PID" 2> /dev/null
    [ -n "${XVFB_PID:-}" ] && kill "$XVFB_PID" 2> /dev/null
}
trap cleanup EXIT

say "build"
(cd "$ROOT" && cargo build --release --target x86_64-pc-windows-gnu -p rpspeller -p fakegame -p poke 2>&1 | tail -1) || exit 1
cp "$ROOT"/target/x86_64-pc-windows-gnu/release/{RPSpeller,fakegame,poke}.exe "$WORK/"

say "environment in $WORK"
Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp > "$WORK/xvfb.log" 2>&1 &
XVFB_PID=$!
sleep 1.5
[ -d "$WINEPREFIX" ] || wineboot -i > "$WORK/wineboot.log" 2>&1
python3 "$ROOT/testkit/e2e/relay.py" --port "$PORT" --mode-file "$MODE" --log "$RELAYLOG" $REAL &
RELAY_PID=$!
mode canned
rm -rf "$APPDIR"
: > "$RELAYLOG"

say "1. start"
check "game window starts" start_game
check "app starts and logs" start_app
sleep 1
focus_game

say "2. hotkey opens the game chat and the overlay"
before=$(count "$GAMELOG" "chat open")
xdotool key F7
check "hotkey taps T in the game" wait_more "$GAMELOG" "chat open" "$before" 8
check "app found the game" wait_file "$APPLOG" "hotkey: game found, chat opened: true" 5
sleep 0.5
prime

say "3. typo fixed after space, Backspace returns it"
type_ru "здраствуйте "
check "typo fixed" wait_file "$APPLOG" "fixed: здраствуйте → здравствуйте" 6
shot overlay-fixed
xdotool key BackSpace
check "Backspace keeps the word" wait_file "$APPLOG" "kept: здраствуйте" 4
shot overlay-kept

say "4. Enter checks the last word and sends"
sent_before=$(count "$GAMELOG" " sent: ")
type_ru "как дила харашо"
sleep 0.3
xdotool key Return
check "message reached the game" wait_more "$GAMELOG" " sent: " "$sent_before" 8
check "sent text is fixed except the kept word" test "$(last_sent)" = "здраствуйте как дела хорошо"
check "pasted with Ctrl+V" wait_file "$GAMELOG" "paste: здраствуйте как дела хорошо" 2
check "only words went to the speller, not the message" bash -c "! grep -q 'как дела' '$RELAYLOG'"

say "4b. editing keys: Ctrl+Backspace and Ctrl+A"
focus_game
sent_before=$(count "$GAMELOG" " sent: ")
xdotool key F7
wait_file "$APPLOG" "chat opened: true" 5
sleep 0.8
prime
type_ru "один два"
xdotool key ctrl+BackSpace
sleep 0.3
xdotool key Return
check "Ctrl+Backspace deletes the last word" wait_more "$GAMELOG" " sent: " "$sent_before" 8
check "sent the rest" test "$(last_sent)" = "один"
focus_game
sent_before=$(count "$GAMELOG" " sent: ")
xdotool key F7
sleep 1.8
prime
type_ru "старый"
xdotool key ctrl+a
type_ru "новый"
sleep 0.3
xdotool key Return
check "Ctrl+A selects everything" wait_more "$GAMELOG" " sent: " "$sent_before" 8
check "typing replaced the selection" test "$(last_sent)" = "новый"

say "5. Esc closes the chat without sending"
focus_game
sent_before=$(count "$GAMELOG" " sent: ")
closed_before=$(count "$GAMELOG" "chat closed")
xdotool key F7
wait_file "$APPLOG" "chat opened: true" 5
sleep 0.5
prime
type_ru "превет"
xdotool key Escape
check "game chat closed with Esc" wait_more "$GAMELOG" "chat closed" "$closed_before" 6
sleep 1
check "nothing sent" test "$(count "$GAMELOG" " sent: ")" -eq "$sent_before"

say "6. slow speller: Enter does not hang"
focus_game
mode slow:4
sent_before=$(count "$GAMELOG" " sent: ")
xdotool key F7
sleep 1.5
prime
type_ru "сигодня"
xdotool key Return
check "app gives up waiting" wait_file "$APPLOG" "speller is slow" 5
check "message still sent" wait_more "$GAMELOG" " sent: " "$sent_before" 6
check "sent as typed" test "$(last_sent)" = "сигодня"
mode canned
sleep 4

say "7. broken speller: typing keeps working"
focus_game
mode fail
sent_before=$(count "$GAMELOG" " sent: ")
xdotool key F7
sleep 1.5
prime
type_ru "пошол "
check "error logged" wait_file "$APPLOG" "speller failed: HTTP 500" 5
xdotool key Return
check "message sent" wait_more "$GAMELOG" " sent: " "$sent_before" 6
check "sent unchanged" test "$(last_sent)" = "пошол"
mode canned

say "8. clipboard comes back after the paste"
focus_game
clip_set "старое"
sleep 0.5
sent_before=$(count "$GAMELOG" " sent: ")
xdotool key F7
sleep 1.5
prime
type_ru "харашо"
xdotool key Return
check "sent" wait_more "$GAMELOG" " sent: " "$sent_before" 8
check "sent fixed" test "$(last_sent)" = "хорошо"
sleep 2
check "clipboard restored" test "$(clip_get)" = "старое"

say "9. settings: second launch opens them"
open_settings
shot settings
xdotool key Escape
sleep 1
open_settings
for _ in 1 2 3 4 5 6 7; do xdotool key Tab; done
xdotool key space Return
check "autocorrect switched off" wait_file "$APPDIR/config.json" '"Autocorrect": false' 4
focus_game
reqs=$(wc -l < "$RELAYLOG")
xdotool key F7
sleep 1.5
prime
type_ru "харашо "
sleep 1.5
check "no fixes and no requests while off" test "$(wc -l < "$RELAYLOG")" -eq "$reqs"
xdotool key Escape
sleep 1
open_settings
for _ in 1 2 3 4 5 6 7; do xdotool key Tab; done
xdotool key space Return
check "autocorrect back on" wait_file "$APPDIR/config.json" '"Autocorrect": true' 4

say "10. settings: change the hotkey"
open_settings
xdotool key F8
sleep 0.3
xdotool key Return
check "hotkey saved as F8" wait_file "$APPDIR/config.json" '"Hotkey": "F8"' 4
focus_game
before=$(count "$GAMELOG" "chat open")
xdotool key F8
check "F8 opens the chat" wait_more "$GAMELOG" "chat open" "$before" 6
sleep 1
xdotool key Escape
sleep 1.5
focus_game
f7_before=$(count "$GAMELOG" "key down vk=0x76")
xdotool key F7
sleep 1.5
check "F7 is a normal key again" test "$(count "$GAMELOG" "key down vk=0x76")" -gt "$f7_before"
open_settings
xdotool key F7
sleep 0.3
xdotool key Return
check "hotkey back to F7" wait_file "$APPDIR/config.json" '"Hotkey": "F7"' 4

say "11. tray menu"
poke tray-menu 900 600
sleep 2
shot tray-menu
xdotool mousemove 200 740 click 1
sleep 1
poke tray-menu 900 600
sleep 2
xdotool mousemove 960 628 click 1
check "menu toggles autocorrect off" wait_file "$APPDIR/config.json" '"Autocorrect": false' 4
poke tray-menu 900 600
sleep 2
xdotool mousemove 960 628 click 1
check "menu toggles autocorrect on" wait_file "$APPDIR/config.json" '"Autocorrect": true' 4
poke tray-dblclick
sleep 2
shot settings-from-tray
xdotool mousemove 600 152 click 1
sleep 0.5
xdotool key Escape
sleep 1

say "12. no game: text goes to the clipboard"
(cd "$WORK" && wine taskkill /f /im fakegame.exe > /dev/null 2>&1)
sleep 2
focus_game
xdotool key F7
check "game not found is logged" wait_file "$APPLOG" "hotkey: game window not found" 5
sleep 1
shot overlay-no-game
prime
type_ru "харашо"
xdotool key Return
check "send failure logged" wait_file "$APPLOG" "send failed: окно игры не найдено" 6
sleep 1
check "fixed text is in the clipboard" test "$(clip_get)" = "хорошо"

say "13. typing mode (letter by letter)"
check "game window restarts" start_game
sleep 1
open_settings
for _ in 1 2 3 4 5; do xdotool key Tab; done
xdotool key Down Tab Return
check "input mode saved" wait_file "$APPDIR/config.json" '"InputMode": "type"' 4
focus_game
sent_before=$(count "$GAMELOG" " sent: ")
paste_before=$(count "$GAMELOG" "paste:")
xdotool key F7
sleep 1.5
prime
type_ru "харашо"
xdotool key Return
check "typed message sent" wait_more "$GAMELOG" " sent: " "$sent_before" 8
check "typed text arrived" test "$(last_sent)" = "хорошо"
check "no clipboard paste used" test "$(count "$GAMELOG" "paste:")" -eq "$paste_before"
open_settings
for _ in 1 2 3 4 5; do xdotool key Tab; done
xdotool key Up Tab Return
check "input mode back to paste" wait_file "$APPDIR/config.json" '"InputMode": "paste"' 4

say "14. words survive a restart"
poke close
check "app exits cleanly" wait_file "$APPLOG" "[0-9] exit" 6
sleep 1
check "app process gone" bash -c "! pgrep -f '^Z:.*RPSpeller\.exe$' > /dev/null"
check "cache saved" grep -q '"харашо","хорошо"' "$APPDIR/cache.json"
check "kept word saved" grep -q 'здраствуйте' "$APPDIR/own.json"
check "app restarts" start_app
check "cache loaded" bash -c "tail -1 '$APPLOG' | grep -qE 'words in cache [1-9]'"
focus_game
reqs=$(wc -l < "$RELAYLOG")
fixed_before=$(count "$APPLOG" "fixed: харашо → хорошо")
xdotool key F7
sleep 1.5
prime
type_ru "здраствуйте харашо "
check "cached word fixed without the network" wait_more "$APPLOG" "fixed: харашо → хорошо" "$fixed_before" 4
sleep 1
check "kept word left alone, no requests" test "$(wc -l < "$RELAYLOG")" -eq "$reqs"
xdotool key Escape
sleep 1

say "15. health"
check "app still running" alive
check "no crashes" bash -c "! grep -qE 'Unhandled|page fault' '$WORK/wine.out'"
check "no panics" bash -c "! grep -q 'panic' '$APPLOG'"
check "user agent names the app" grep -q '"ua": "RPSpeller/' "$RELAYLOG"

printf '\n%d passed, %d failed. Logs and screenshots: %s\n' "$PASS" "$FAIL" "$WORK"
[ "$FAIL" -eq 0 ]
