# OpenWrt

| Папка | Что это | Версия | Пакеты |
|---|---|---|---|
| [luci-theme-kadr](luci-theme-kadr/) | Кадр для LuCI — тема для веб-интерфейса роутера и podkop | 1.5.0 | [apk для 25.12](https://github.com/splithillz/one/raw/main/releases/luci-theme-kadr-1.5.0-r1.apk) · [ipk для 24.10](https://github.com/splithillz/one/raw/main/releases/luci-theme-kadr_1.5.0-r1_all.ipk) |

Поставить на роутер одной командой (OpenWrt 25.12 и 24.10):

```
wget -q -O - https://raw.githubusercontent.com/splithillz/one/main/openwrt/luci-theme-kadr/install.sh | sh
```

Пакеты собираются командой `python3 build.py` в папке темы и попадают в [`releases`](../releases/).
