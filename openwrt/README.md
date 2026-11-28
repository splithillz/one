# OpenWrt

| Папка | Что это | Версия | Пакеты |
|---|---|---|---|
| [luci-theme-kadr](luci-theme-kadr/) | Кадр для LuCI — тема для веб-интерфейса роутера и podkop | 1.7.0 | [apk для 25.12](https://github.com/splithillz/one/raw/main/releases/luci-theme-kadr-1.7.0-r2.apk) · [ipk для 24.10](https://github.com/splithillz/one/raw/main/releases/luci-theme-kadr_1.7.0-r2_all.ipk) |
| [luci-theme-kadr](luci-theme-kadr/), полная версия | То же плюс жуки, метавселенная, рейд-боссы и общие настройки на роутере | 1.7.0 | [apk для 25.12](https://github.com/splithillz/one/raw/main/releases/luci-theme-kadr-full-1.7.0-r2.apk) · [ipk для 24.10](https://github.com/splithillz/one/raw/main/releases/luci-theme-kadr-full_1.7.0-r2_all.ipk) |

Поставить на роутер одной командой (OpenWrt 25.12 и 24.10). Обычная версия:

```
wget -q -O - https://raw.githubusercontent.com/splithillz/one/main/openwrt/luci-theme-kadr/install.sh | sh
```

Полная версия:

```
wget -q -O - https://raw.githubusercontent.com/splithillz/one/main/openwrt/luci-theme-kadr/install.sh | sh -s full
```

Пакеты собираются командой `python3 build.py` в папке темы и попадают в [`releases`](../releases/).
