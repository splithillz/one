#!/usr/bin/env python3
import gzip
import hashlib
import io
import os
import sys
import tarfile
import time

NAME = "luci-theme-slate"
VERSION = "1.0.0"
RELEASE = "1"
DESCRIPTION = "Slate: dark LuCI theme in the RP Speller style, with podkop support"
URL = "https://github.com/splithillz/one/tree/main/luci-theme-slate"
LICENSE = "Apache-2.0"
DEPENDS = ["luci-base"]

HERE = os.path.dirname(os.path.abspath(__file__))
MTIME = int(os.environ.get("SOURCE_DATE_EPOCH", "1763683200"))

POSTINST = """#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0
if [ -f /etc/uci-defaults/30_luci-theme-slate ]; then
	( . /etc/uci-defaults/30_luci-theme-slate ) && rm -f /etc/uci-defaults/30_luci-theme-slate
fi
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
exit 0
"""

POSTRM = """#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0
[ -f /www/luci-static/slate/slate.css ] && exit 0
uci -q delete luci.themes.Slate
if [ "$(uci -q get luci.main.mediaurlbase)" = "/luci-static/slate" ]; then
	fallback=/luci-static/bootstrap
	if [ ! -d /www/luci-static/bootstrap ]; then
		fallback=$(uci -q show luci.themes | sed -n "s/^luci\\.themes\\.[^=]*='\\?\\([^']*\\)'\\?$/\\1/p" | head -n 1)
	fi
	[ -n "$fallback" ] && uci set luci.main.mediaurlbase="$fallback"
fi
uci commit luci
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
exit 0
"""


def layout():
    files = []
    roots = [
        ("htdocs", "www"),
        ("ucode", "usr/share/ucode/luci"),
        ("root", ""),
    ]
    for src, dst in roots:
        base = os.path.join(HERE, src)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames.sort()
            for fn in sorted(filenames):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, base)
                target = os.path.join(dst, rel) if dst else rel
                files.append((target.replace(os.sep, "/"), full))
    return files


def mode_for(target):
    return 0o755 if target.startswith("etc/uci-defaults/") else 0o644


def dirs_for(files):
    out = set()
    for target, _ in files:
        parts = target.split("/")[:-1]
        for i in range(1, len(parts) + 1):
            out.add("/".join(parts[:i]))
    return sorted(out)


def tar_info(name, size=0, mode=0o644, kind=tarfile.REGTYPE):
    ti = tarfile.TarInfo(name)
    ti.size = size
    ti.mode = mode
    ti.type = kind
    ti.mtime = MTIME
    ti.uid = ti.gid = 0
    ti.uname = ti.gname = "root"
    return ti


def build_tar(entries, prefix="./", cut=False, pax_hash=False):
    buf = io.BytesIO()
    fmt = tarfile.PAX_FORMAT if pax_hash else tarfile.USTAR_FORMAT
    tf = tarfile.open(fileobj=buf, mode="w", format=fmt)
    for name, data, mode, kind in entries:
        ti = tar_info(prefix + name, len(data) if data is not None else 0, mode, kind)
        if kind == tarfile.DIRTYPE:
            ti.name = ti.name.rstrip("/") + "/"
            tf.addfile(ti)
        else:
            if pax_hash:
                ti.pax_headers = {"APK-TOOLS.checksum.SHA1": hashlib.sha1(data).hexdigest()}
            tf.addfile(ti, io.BytesIO(data))
    if cut:
        raw = buf.getvalue()[: tf.offset]
        return raw
    tf.close()
    return buf.getvalue()


def gz(data):
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode="wb", mtime=MTIME, compresslevel=9) as g:
        g.write(data)
    return out.getvalue()


def payload(files):
    entries = []
    for d in dirs_for(files):
        entries.append((d, None, 0o755, tarfile.DIRTYPE))
    total = 0
    for target, full in files:
        with open(full, "rb") as f:
            data = f.read()
        total += len(data)
        entries.append((target, data, mode_for(target), tarfile.REGTYPE))
    return entries, total


def build_ipk(files, outdir):
    entries, total = payload(files)
    data_tgz = gz(build_tar(entries))
    control = "\n".join([
        f"Package: {NAME}",
        f"Version: {VERSION}-r{RELEASE}",
        f"Depends: {', '.join(DEPENDS)}",
        f"Source: {URL}",
        f"SourceName: {NAME}",
        f"License: {LICENSE}",
        "Section: luci",
        f"SourceDateEpoch: {MTIME}",
        "Architecture: all",
        f"Installed-Size: {total}",
        f"Description: {DESCRIPTION}",
        "",
    ])
    ctrl_entries = [
        ("control", control.encode(), 0o644, tarfile.REGTYPE),
        ("postinst", POSTINST.encode(), 0o755, tarfile.REGTYPE),
        ("postrm", POSTRM.encode(), 0o755, tarfile.REGTYPE),
    ]
    control_tgz = gz(build_tar(ctrl_entries))
    outer = [
        ("debian-binary", b"2.0\n", 0o644, tarfile.REGTYPE),
        ("data.tar.gz", data_tgz, 0o644, tarfile.REGTYPE),
        ("control.tar.gz", control_tgz, 0o644, tarfile.REGTYPE),
    ]
    path = os.path.join(outdir, f"{NAME}_{VERSION}-r{RELEASE}_all.ipk")
    with open(path, "wb") as f:
        f.write(gz(build_tar(outer)))
    return path


def build_apk(files, outdir):
    entries, total = payload(files)
    data_tgz = gz(build_tar(entries, prefix="", pax_hash=True))
    pkginfo = "\n".join([
        f"pkgname = {NAME}",
        f"pkgver = {VERSION}-r{RELEASE}",
        f"pkgdesc = {DESCRIPTION}",
        f"url = {URL}",
        f"builddate = {MTIME}",
        f"size = {total}",
        "arch = noarch",
        f"origin = {NAME}",
        f"license = {LICENSE}",
        *[f"depend = {d}" for d in DEPENDS],
        f"datahash = {hashlib.sha256(data_tgz).hexdigest()}",
        "",
    ])
    ctrl_entries = [
        (".PKGINFO", pkginfo.encode(), 0o644, tarfile.REGTYPE),
        (".post-install", POSTINST.encode(), 0o755, tarfile.REGTYPE),
        (".post-upgrade", POSTINST.encode(), 0o755, tarfile.REGTYPE),
        (".post-deinstall", POSTRM.encode(), 0o755, tarfile.REGTYPE),
    ]
    control_tgz = gz(build_tar(ctrl_entries, prefix="", cut=True))
    path = os.path.join(outdir, f"{NAME}-{VERSION}-r{RELEASE}.apk")
    with open(path, "wb") as f:
        f.write(control_tgz + data_tgz)
    return path


def build_tarball(files, outdir):
    entries, _ = payload(files)
    path = os.path.join(outdir, f"{NAME}-{VERSION}.tar.gz")
    with open(path, "wb") as f:
        f.write(gz(build_tar(entries, prefix="")))
    return path


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(HERE), "dist")
    os.makedirs(outdir, exist_ok=True)
    files = layout()
    for p in (build_ipk(files, outdir), build_apk(files, outdir), build_tarball(files, outdir)):
        print(p, os.path.getsize(p))


if __name__ == "__main__":
    main()
