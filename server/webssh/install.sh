#!/bin/sh
# Web SSH — терминал сервера в браузере.
#
# Поставить или обновить (зайти на сервер по SSH под root и вставить):
#   curl -fsSL https://raw.githubusercontent.com/splithillz/one/main/server/webssh/install.sh | sh
# Новая секретная ссылка (старая перестанет открываться):
#   curl -fsSL .../install.sh | sh -s new-link
# Показать ссылку:  webssh info
# Удалить:          curl -fsSL .../install.sh | sh -s remove
#
# Переменные: PORT=8443 — свой порт вместо случайного, HOST=example.com — домен
# или IP для ссылки, WEBSSH_BASE — откуда качать (ветка или зеркало).

BIN=/usr/local/bin/webssh
ETC=/etc/webssh
ENV_FILE=/etc/webssh/webssh.env
STATE=/var/lib/webssh
UNIT=/etc/systemd/system/webssh.service

say() {
	printf '%s\n' "$*"
}

fail() {
	printf 'Ошибка: %s\n' "$*" >&2
	[ -n "${tmp:-}" ] && rm -rf "$tmp"
	exit 1
}

fetch() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL --retry 2 --connect-timeout 15 -o "$2" "$1"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -T 30 -O "$2" "$1"
	else
		fail "нужен curl или wget"
	fi
}

fetch_text() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsS --max-time 6 "$1" 2>/dev/null
	elif command -v wget >/dev/null 2>&1; then
		wget -q -T 6 -O - "$1" 2>/dev/null
	fi
}

field() {
	sed -n "s/^$1=//p" "$tmp/latest" | head -n 1
}

pause() {
	sleep 0.5 2>/dev/null || sleep 1
}

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$1" | cut -d ' ' -f 1
	elif command -v shasum >/dev/null 2>&1; then
		shasum -a 256 "$1" | cut -d ' ' -f 1
	elif command -v openssl >/dev/null 2>&1; then
		openssl dgst -sha256 "$1" | awk '{ print $NF }'
	else
		fail "нечем проверить контрольную сумму: нет sha256sum"
	fi
}

env_value() {
	[ -f "$ENV_FILE" ] && sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

set_env() {
	if grep -q "^$1=" "$ENV_FILE" 2>/dev/null; then
		sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
	else
		printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"
	fi
}

port_busy() {
	if command -v ss >/dev/null 2>&1; then
		ss -ltn 2>/dev/null | awk '{ print $4 }' | grep -Eq "[:.]$1\$"
	elif command -v netstat >/dev/null 2>&1; then
		netstat -ltn 2>/dev/null | awk '{ print $4 }' | grep -Eq "[:.]$1\$"
	else
		return 1
	fi
}

random_port() {
	n=0
	while [ "$n" -lt 50 ]; do
		r=$(od -An -N2 -tu2 /dev/urandom | tr -d ' ')
		p=$((20000 + r % 40000))
		port_busy "$p" || {
			echo "$p"
			return
		}
		n=$((n + 1))
	done
	fail "не нашёл свободный порт. Задай его сам: PORT=8443"
}

# Где слушает sshd. Web SSH ходит к нему по петле, как обычный SSH-клиент.
ssh_addr() {
	sshd_bin=$(command -v sshd 2>/dev/null)
	[ -z "$sshd_bin" ] && [ -x /usr/sbin/sshd ] && sshd_bin=/usr/sbin/sshd
	[ -n "$sshd_bin" ] || {
		echo 127.0.0.1:22
		return
	}
	"$sshd_bin" -T 2>/dev/null | awk '
		$1 == "port" && port == "" { port = $2 }
		$1 == "listenaddress" {
			h = $2; p = ""
			if (match(h, /:[0-9]+$/)) { p = substr(h, RSTART + 1); h = substr(h, 1, RSTART - 1) }
			if (h == "0.0.0.0" || h == "127.0.0.1") { if (v4 == "") v4 = p }
			else if (h == "[::]" || h == "[::1]") { if (v6 == "") v6 = p }
			else if (other == "") { other = h; op = p }
		}
		END {
			if (port == "") port = 22
			if (v4 != "" || (v6 == "" && other == "")) print "127.0.0.1:" (v4 != "" ? v4 : port)
			else if (v6 != "") print "[::1]:" v6
			else print other ":" (op != "" ? op : port)
		}'
}

public_ip() {
	for u in https://ipv4-internet.yandex.net/api/v0/ip https://api.ipify.org https://ifconfig.me/ip; do
		ip=$(fetch_text "$u" | tr -d '"[:space:]')
		case $ip in
			*[!0-9.]* | "") ;;
			*.*.*.*)
				echo "$ip"
				return
				;;
		esac
	done
}

open_port() {
	if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
		ufw allow "$1/tcp" comment webssh >/dev/null 2>&1 || ufw allow "$1/tcp" >/dev/null
		say "Открыл порт $1 в ufw"
	elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
		firewall-cmd --quiet --permanent --add-port="$1/tcp" && firewall-cmd --quiet --reload
		say "Открыл порт $1 в firewalld"
	elif command -v iptables >/dev/null 2>&1; then
		rules=$(iptables -S INPUT 2>/dev/null) || return 0
		case $rules in
			*"-P INPUT DROP"* | *"-j REJECT"* | *"-j DROP"*) ;;
			*) return 0 ;;
		esac
		iptables -C INPUT -p tcp --dport "$1" -j ACCEPT 2>/dev/null ||
			iptables -I INPUT -p tcp --dport "$1" -m comment --comment webssh -j ACCEPT 2>/dev/null ||
			iptables -I INPUT -p tcp --dport "$1" -j ACCEPT
		command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1
		say "Открыл порт $1 в iptables"
	fi
}

close_port() {
	[ -n "$1" ] || return 0
	if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
		ufw delete allow "$1/tcp" >/dev/null 2>&1
	elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
		firewall-cmd --quiet --permanent --remove-port="$1/tcp" 2>/dev/null && firewall-cmd --quiet --reload
	elif command -v iptables >/dev/null 2>&1; then
		while iptables -D INPUT -p tcp --dport "$1" -m comment --comment webssh -j ACCEPT 2>/dev/null; do :; done
		while iptables -D INPUT -p tcp --dport "$1" -j ACCEPT 2>/dev/null; do :; done
		command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1
	fi
	return 0
}

install_bin() {
	case $(uname -m) in
		x86_64 | amd64) arch=amd64 ;;
		aarch64 | arm64) arch=arm64 ;;
		*) fail "процессор $(uname -m) пока не поддерживается, есть сборки для x86_64 и arm64" ;;
	esac

	fetch "$base/releases/webssh.latest" "$tmp/latest" ||
		fail "не скачался список версий. Проверь, что сервер видит GitHub ($base)"
	version=$(field version)
	file=$(field "$arch")
	sum=$(field "${arch}_sha256")
	[ -n "$version" ] && [ -n "$file" ] && [ -n "$sum" ] || fail "список версий пустой или битый"

	say "Web SSH $version, качаю сборку для $arch"
	fetch "$base/releases/$file" "$tmp/webssh.gz" || fail "не скачался $file"
	[ "$(sha256 "$tmp/webssh.gz")" = "$sum" ] ||
		fail "файл скачался битым: контрольная сумма не сходится. Запусти команду ещё раз"
	gzip -dc "$tmp/webssh.gz" >"$tmp/webssh" || fail "не распаковался $file"
	chmod 0755 "$tmp/webssh"
	"$tmp/webssh" version >/dev/null 2>&1 || fail "скачанный webssh не запускается на этой машине"
	cp "$tmp/webssh" "$BIN.new" && chmod 0755 "$BIN.new" && mv -f "$BIN.new" "$BIN" ||
		fail "не получилось положить программу в $BIN"
}

ensure_user() {
	id -u webssh >/dev/null 2>&1 && return
	nologin=$(command -v nologin 2>/dev/null)
	[ -n "$nologin" ] || nologin=/bin/false
	if command -v useradd >/dev/null 2>&1; then
		useradd --system --user-group --home-dir "$STATE" --no-create-home --shell "$nologin" webssh
	else
		adduser --system --group --home "$STATE" --no-create-home --shell "$nologin" webssh
	fi >/dev/null 2>&1 || fail "не получилось создать пользователя webssh"
}

write_env() {
	mkdir -p "$ETC"
	if [ -f "$ENV_FILE" ]; then
		[ -n "${PORT:-}" ] && set_env WEBSSH_LISTEN ":$PORT"
		[ -n "${HOST:-}" ] && set_env WEBSSH_HOSTS "$HOST"
		return 0
	fi

	port=${PORT:-}
	[ -n "$port" ] || port=$(random_port)
	ssh=$(ssh_addr)
	hosts=${HOST:-}
	if [ -z "$hosts" ] && [ -z "$("$BIN" ips)" ]; then
		# IP сервера не виден на его интерфейсах (NAT у облака): спросим снаружи
		hosts=$(public_ip)
	fi

	cat >"$ENV_FILE" <<EOF
# Настройки Web SSH. После правки: systemctl restart webssh
# Порт HTTPS
WEBSSH_LISTEN=:$port
# Куда подключаться по SSH: sshd этого же сервера
WEBSSH_SSH=$ssh
# IP или домен для ссылки и сертификата, через запятую. Пусто — IP с интерфейсов сервера
WEBSSH_HOSTS=$hosts
# Свой сертификат вместо самоподписанного, файлы должен читать пользователь webssh
#WEBSSH_CERT=/etc/webssh/fullchain.pem
#WEBSSH_KEY=/etc/webssh/privkey.pem
EOF
	chmod 0644 "$ENV_FILE"
}

write_unit() {
	cat >"$UNIT" <<'EOF'
[Unit]
Description=Web SSH: терминал сервера в браузере
After=network-online.target
Wants=network-online.target

[Service]
User=webssh
Group=webssh
EnvironmentFile=/etc/webssh/webssh.env
ExecStart=/usr/local/bin/webssh serve
Restart=on-failure
RestartSec=3
StateDirectory=webssh
StateDirectoryMode=0700
UMask=0077

# Сервису не нужны права: он слушает порт и ходит к sshd по петле.
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM

[Install]
WantedBy=multi-user.target
EOF
}

wait_ready() {
	i=0
	while [ "$i" -lt 30 ]; do
		[ -s "$STATE/token" ] && [ -s "$STATE/tls.crt" ] && systemctl is-active --quiet webssh && return 0
		pause
		i=$((i + 1))
	done
	journalctl -u webssh -n 30 --no-pager >&2 2>/dev/null
	fail "сервис webssh не запустился, лог выше"
}

show_info() {
	port=$(env_value WEBSSH_LISTEN | sed 's/.*://')
	say ""
	"$BIN" info -env "$ENV_FILE" || fail "webssh info не сработал"
	say ""
	say "Как войти: открой ссылку. Браузер предупредит, что сертификат не подтверждён —"
	say "это наш самоподписанный, жми «Дополнительно» → «Перейти на сайт»."
	say "Отпечаток SHA-256 выше должен совпасть с тем, что браузер покажет в сертификате."
	say "Логин и пароль те же, что в SSH."
	say ""
	say "Ссылка секретная: без неё сервер отвечает 404 и форму входа не видно. Не свети её."
	say "5 неверных паролей подряд закрывают вход с этого адреса на 15 минут."
	if [ -n "$port" ]; then
		say "Если не открывается — проверь, что порт $port открыт в панели хостинга (облачный файрвол)."
	fi
}

install_all() {
	command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] ||
		fail "нужен systemd (Debian, Ubuntu, CentOS, Alma, Rocky — подходят)"
	rm -rf "$tmp"
	mkdir -p "$tmp" || fail "не получилось создать $tmp"

	fresh=1
	[ -f "$ENV_FILE" ] && fresh=0
	install_bin
	ensure_user
	write_env
	write_unit
	rm -rf "$tmp"

	systemctl daemon-reload
	systemctl enable webssh >/dev/null 2>&1
	systemctl restart webssh || fail "systemctl restart webssh не сработал"
	wait_ready
	port=$(env_value WEBSSH_LISTEN | sed 's/.*://')
	[ -n "$port" ] && open_port "$port"

	say ""
	if [ "$fresh" = 1 ]; then
		say "Готово: Web SSH $version установлен и запущен."
	else
		say "Готово: Web SSH обновлён до $version, ссылка и настройки прежние."
	fi
	show_info
}

new_link() {
	[ -x "$BIN" ] && [ -f "$UNIT" ] || fail "Web SSH не установлен"
	rm -f "$STATE/token"
	systemctl restart webssh || fail "systemctl restart webssh не сработал"
	wait_ready
	say ""
	say "Готово: старая ссылка больше не открывается, вот новая."
	show_info
}

remove_all() {
	port=$(env_value WEBSSH_LISTEN | sed 's/.*://')
	systemctl disable --now webssh >/dev/null 2>&1
	rm -f "$UNIT" "$BIN"
	systemctl daemon-reload 2>/dev/null
	close_port "$port"
	rm -rf "$ETC" "$STATE" /var/lib/private/webssh
	if id -u webssh >/dev/null 2>&1; then
		userdel webssh 2>/dev/null || deluser --system webssh >/dev/null 2>&1
	fi
	say "Web SSH удалён: сервис, программа, настройки, пользователь webssh и правило файрвола."
}

main() {
	base=${WEBSSH_BASE:-https://raw.githubusercontent.com/splithillz/one/main}
	tmp=/tmp/webssh-install

	uid=$(id -u 2>/dev/null)
	[ "$uid" = 0 ] || fail "запусти от root (или через sudo sh)"

	case ${1:-install} in
		install | update) install_all ;;
		new-link | newlink) new_link ;;
		remove | uninstall) remove_all ;;
		*) fail "не знаю команду «$1». Есть install, new-link и remove" ;;
	esac
}

main "$@"
