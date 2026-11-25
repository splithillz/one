#!/bin/sh

say() {
	printf '%s\n' "$*"
}

fail() {
	printf 'Ошибка: %s\n' "$*" >&2
	rm -rf "$tmp"
	exit 1
}

fetch() {
	if command -v uclient-fetch >/dev/null 2>&1; then
		uclient-fetch -q -O "$2" "$1" 2>/dev/null
	elif command -v curl >/dev/null 2>&1; then
		curl -fsSL -o "$2" "$1"
	else
		wget -q -O "$2" "$1"
	fi
}

field() {
	sed -n "s/^$1=//p" "$tmp/latest" | head -n 1
}

clear_cache() {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null
}

has() {
	case $pm in
		apk) apk info -e "$1" >/dev/null 2>&1 ;;
		opkg) opkg status "$1" 2>/dev/null | grep -q '^Status:.* installed' ;;
	esac
}

drop() {
	if [ "$pm" = apk ]; then
		apk del "$1" </dev/null
	else
		opkg remove "$1" </dev/null
	fi
}

install_theme() {
	pkg=$1
	other=$2
	label=$3
	rm -rf "$tmp"
	mkdir -p "$tmp" || fail "не получилось создать $tmp"
	fetch "$base/releases/$pkg.latest" "$tmp/latest" ||
		fail "не скачался список версий. Проверь, что роутер видит интернет и GitHub ($base)"

	ext=ipk
	[ "$pm" = apk ] && ext=apk
	version=$(field version)
	file=$(field "$ext")
	sum=$(field "${ext}_sha256")
	[ -n "$version" ] && [ -n "$file" ] || fail "список версий пустой или битый"

	say "$label $version, ставлю через $pm"
	fetch "$base/releases/$file" "$tmp/$file" || fail "не скачался пакет $file"
	if [ -n "$sum" ] && command -v sha256sum >/dev/null 2>&1; then
		got=$(sha256sum "$tmp/$file" | cut -d ' ' -f 1)
		[ "$got" = "$sum" ] || fail "пакет скачался битым: контрольная сумма не сходится. Запусти команду ещё раз"
	fi

	if has "$other"; then
		say "Убираю другую версию темы ($other). Настройки панели останутся"
		drop "$other" || fail "$pm не смог удалить $other"
	fi

	if [ "$pm" = apk ]; then
		apk add --allow-untrusted "$tmp/$file" </dev/null || fail "apk не смог поставить пакет"
	else
		opkg install --force-reinstall "$tmp/$file" </dev/null || fail "opkg не смог поставить пакет"
	fi

	uci -q set luci.themes.Kadr=/luci-static/kadr
	uci -q set luci.main.mediaurlbase=/luci-static/kadr
	uci -q commit luci
	clear_cache
	rm -rf "$tmp"

	say ""
	say "Готово: $label $version установлен и включён."
	if [ "$pkg" = luci-theme-kadr-full ]; then
		say "Открой LuCI и обнови страницу. Палитра, стиль, разделители, жуки и метавселенная — кнопкой с палитрой в шапке."
		say "Настройки панели хранятся на роутере и общие для всех устройств."
	else
		say "Открой LuCI и обнови страницу. Палитра, стиль и разделители — кнопкой с палитрой в шапке."
	fi
	say "Там же внизу блок «Обновление»: новые версии ставятся оттуда одной кнопкой."
}

remove_theme() {
	gone=
	for p in luci-theme-kadr luci-theme-kadr-full; do
		if has "$p"; then
			drop "$p" || fail "$pm не смог удалить $p"
			gone=1
		fi
	done
	[ -n "$gone" ] || fail "Кадр не установлен"
	clear_cache
	say ""
	say "Кадр удалён, интерфейс вернулся на Bootstrap. Обнови страницу LuCI."
}

main() {
	base=${KADR_BASE:-https://raw.githubusercontent.com/splithillz/one/main}
	tmp=/tmp/kadr-install

	uid=$(id -u 2>/dev/null)
	[ -z "$uid" ] || [ "$uid" = 0 ] || fail "запусти от root"

	if command -v apk >/dev/null 2>&1; then
		pm=apk
	elif command -v opkg >/dev/null 2>&1; then
		pm=opkg
	else
		fail "не нашёл ни apk, ни opkg: это точно OpenWrt?"
	fi

	cmd=${1:-install}
	if [ "$cmd" = install ] || [ "$cmd" = update ]; then
		cmd=lite
		has luci-theme-kadr-full && cmd=full
	fi

	case $cmd in
		lite) install_theme luci-theme-kadr luci-theme-kadr-full "Кадр для LuCI" ;;
		full) install_theme luci-theme-kadr-full luci-theme-kadr "Кадр для LuCI, полная версия" ;;
		remove | uninstall) remove_theme ;;
		*) fail "не знаю команду «$1». Есть install, lite, full и remove" ;;
	esac
}

main "$@"
