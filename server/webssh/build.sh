#!/bin/sh
# Собирает webssh под linux/amd64 и linux/arm64 в releases/ и обновляет releases/webssh.latest.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
version=$(sed -n 's/^const version = "\(.*\)"$/\1/p' "$here/main.go")
[ -n "$version" ] || { echo "не нашёл версию в main.go" >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
rm -f "$root"/releases/webssh-*-linux-*.gz
printf 'version=%s\n' "$version" >"$tmp/latest"
for arch in amd64 arm64; do
	(cd "$here" && CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -buildvcs=false -ldflags='-s -w -buildid=' -o "$tmp/webssh-$arch" .)
	file="webssh-$version-linux-$arch.gz"
	gzip -9 -n -c "$tmp/webssh-$arch" >"$root/releases/$file"
	sum=$(sha256sum "$root/releases/$file" | cut -d ' ' -f 1)
	printf '%s=%s\n%s_sha256=%s\n' "$arch" "$file" "$arch" "$sum" >>"$tmp/latest"
	echo "$file  $(du -h "$root/releases/$file" | cut -f 1)  $sum"
done
mv "$tmp/latest" "$root/releases/webssh.latest"
