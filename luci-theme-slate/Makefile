include $(TOPDIR)/rules.mk

LUCI_TITLE:=Slate theme (dark, RP Speller style, podkop support)
LUCI_DEPENDS:=+luci-base
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

define Package/luci-theme-slate/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -f /www/luci-static/slate/slate.css ] && exit 0
uci -q delete luci.themes.Slate
if [ "$$(uci -q get luci.main.mediaurlbase)" = "/luci-static/slate" ]; then
	uci set luci.main.mediaurlbase=/luci-static/bootstrap
fi
uci commit luci
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
