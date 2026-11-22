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

install_theme() {
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

	say "Кадр для LuCI $version, ставлю через $pm"
	fetch "$base/releases/$file" "$tmp/$file" || fail "не скачался пакет $file"
	if [ -n "$sum" ] && command -v sha256sum >/dev/null 2>&1; then
		got=$(sha256sum "$tmp/$file" | cut -d ' ' -f 1)
		[ "$got" = "$sum" ] || fail "пакет скачался битым: контрольная сумма не сходится. Запусти команду ещё раз"
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
	say "Готово: Кадр $version установлен и включён."
	say "Открой LuCI и обнови страницу с Ctrl+F5. Палитра, стиль, разделители и жуки — кнопкой с палитрой в шапке."
}

remove_theme() {
	if [ "$pm" = apk ]; then
		apk del "$pkg" </dev/null || fail "apk не смог удалить пакет"
	else
		opkg remove "$pkg" </dev/null || fail "opkg не смог удалить пакет"
	fi
	clear_cache
	say ""
	say "Кадр удалён, интерфейс вернулся на Bootstrap. Обнови страницу LuCI с Ctrl+F5."
}

main() {
	base=${KADR_BASE:-https://raw.githubusercontent.com/splithillz/one/main}
	pkg=luci-theme-kadr
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

	case ${1:-install} in
		install | update) install_theme ;;
		remove | uninstall) remove_theme ;;
		*) fail "не знаю команду «$1». Есть install и remove" ;;
	esac
}

main "$@"
