use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=res");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let res = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("res");
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    let version = env::var("CARGO_PKG_VERSION").unwrap();
    let mut parts: Vec<u32> = version.split('.').map(|p| p.parse().unwrap_or(0)).collect();
    parts.resize(4, 0);
    let dotted = parts.iter().map(u32::to_string).collect::<Vec<_>>().join(".");
    let commas = parts.iter().map(u32::to_string).collect::<Vec<_>>().join(",");
    let manifest = fs::read_to_string(res.join("app.manifest")).unwrap().replace("{VERSION}", &dotted);
    fs::write(out.join("app.manifest"), manifest).unwrap();
    let path = |p: PathBuf| p.display().to_string().replace('\\', "/");
    let rc = format!(
        r#"#pragma code_page(65001)
#include <winver.h>
1 ICON "{icon}"
1 24 "{manifest}"
1 VERSIONINFO
FILEVERSION {commas}
PRODUCTVERSION {commas}
FILEFLAGSMASK 0x3f
FILEFLAGS 0x0
FILEOS VOS_NT_WINDOWS32
FILETYPE VFT_APP
FILESUBTYPE VFT2_UNKNOWN
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "041904B0"
    BEGIN
      VALUE "FileDescription", "RP Speller — исправление опечаток в чате GTA V / FiveM"
      VALUE "FileVersion", "{version}"
      VALUE "InternalName", "RPSpeller"
      VALUE "OriginalFilename", "RPSpeller.exe"
      VALUE "ProductName", "RP Speller"
      VALUE "ProductVersion", "{version}"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x419, 1200
  END
END
"#,
        icon = path(res.join("app.ico")),
        manifest = path(out.join("app.manifest")),
    );
    fs::write(out.join("app.rc"), rc).unwrap();
    embed_resource::compile(out.join("app.rc"), embed_resource::NONE).manifest_required().unwrap();
}
