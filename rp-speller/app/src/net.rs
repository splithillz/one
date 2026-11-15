use std::ffi::c_void;
use std::ptr::{null, null_mut};
use std::sync::mpsc::{self, Sender};
use std::thread;

use rp_speller_core::speller::{check_via, Fixes, API_HOST, API_PATH};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{GetLastError, HWND, LPARAM, WPARAM};
use windows::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryDataAvailable, WinHttpQueryHeaders, WinHttpReadData,
    WinHttpReceiveResponse, WinHttpSendRequest, WinHttpSetOption, WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
    WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_FLAG_SECURE, WINHTTP_OPEN_REQUEST_FLAGS, WINHTTP_OPTION_DECOMPRESSION,
    WINHTTP_OPTION_ENABLE_HTTP_PROTOCOL, WINHTTP_PROTOCOL_FLAG_HTTP2, WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
};
use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_APP};

use crate::win::{hwnd_from_isize, hwnd_to_isize, wide};

pub const WM_SPELLER: u32 = WM_APP + 1;
const DECOMPRESSION_FLAG_ALL: u32 = 3;

pub struct Endpoint {
    secure: bool,
    host: Vec<u16>,
    port: u16,
    path: Vec<u16>,
}

impl Endpoint {
    pub fn get() -> Self {
        std::env::var("RPSPELLER_SPELLER_URL").ok().and_then(|u| Self::parse(&u)).unwrap_or_else(|| Self {
            secure: true,
            host: wide(API_HOST),
            port: 443,
            path: wide(API_PATH),
        })
    }

    fn parse(url: &str) -> Option<Self> {
        let (secure, rest) = if let Some(r) = url.strip_prefix("https://") {
            (true, r)
        } else {
            (false, url.strip_prefix("http://")?)
        };
        let (hostport, path) = match rest.split_once('/') {
            Some((h, p)) => (h, format!("/{p}")),
            None => (rest, "/".to_string()),
        };
        let (host, port) = match hostport.rsplit_once(':') {
            Some((h, p)) => (h, p.parse().ok()?),
            None => (hostport, if secure { 443 } else { 80 }),
        };
        Some(Self { secure, host: wide(host), port, path: wide(&path) })
    }
}

struct Handle(*mut c_void);

impl Drop for Handle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                let _ = WinHttpCloseHandle(self.0);
            }
        }
    }
}

fn fail(what: &str) -> String {
    format!("{what}: WinHTTP error {}", unsafe { GetLastError().0 })
}

pub struct Http {
    session: Handle,
    endpoint: Endpoint,
}

impl Http {
    pub fn new() -> Result<Self, String> {
        let agent = wide(concat!("RPSpeller/", env!("CARGO_PKG_VERSION")));
        unsafe {
            let mut s = WinHttpOpen(PCWSTR(agent.as_ptr()), WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, PCWSTR::null(), PCWSTR::null(), 0);
            if s.is_null() {
                s = WinHttpOpen(PCWSTR(agent.as_ptr()), WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, PCWSTR::null(), PCWSTR::null(), 0);
            }
            if s.is_null() {
                return Err(fail("open"));
            }
            let _ = WinHttpSetTimeouts(s, 5000, 5000, 8000, 8000);
            let _ = WinHttpSetOption(Some(s), WINHTTP_OPTION_DECOMPRESSION, Some(&DECOMPRESSION_FLAG_ALL.to_le_bytes()));
            let _ = WinHttpSetOption(Some(s), WINHTTP_OPTION_ENABLE_HTTP_PROTOCOL, Some(&WINHTTP_PROTOCOL_FLAG_HTTP2.to_le_bytes()));
            Ok(Self { session: Handle(s), endpoint: Endpoint::get() })
        }
    }

    pub fn post_form(&self, body: &str) -> Result<String, String> {
        let e = &self.endpoint;
        unsafe {
            let connect = Handle(WinHttpConnect(self.session.0, PCWSTR(e.host.as_ptr()), e.port, 0));
            if connect.0.is_null() {
                return Err(fail("connect"));
            }
            let flags = if e.secure { WINHTTP_FLAG_SECURE } else { WINHTTP_OPEN_REQUEST_FLAGS(0) };
            let req = Handle(WinHttpOpenRequest(connect.0, w!("POST"), PCWSTR(e.path.as_ptr()), PCWSTR::null(), PCWSTR::null(), null(), flags));
            if req.0.is_null() {
                return Err(fail("request"));
            }
            let headers: Vec<u16> = "Content-Type: application/x-www-form-urlencoded\r\n".encode_utf16().collect();
            let len = body.len() as u32;
            WinHttpSendRequest(req.0, Some(&headers), Some(body.as_ptr() as *const c_void), len, len, 0).map_err(|_| fail("send"))?;
            WinHttpReceiveResponse(req.0, null_mut()).map_err(|_| fail("receive"))?;
            let mut status = 0u32;
            let mut size = 4u32;
            WinHttpQueryHeaders(
                req.0,
                WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                PCWSTR::null(),
                Some(&mut status as *mut u32 as *mut c_void),
                &mut size,
                null_mut(),
            )
            .map_err(|_| fail("status"))?;
            let mut out = Vec::new();
            loop {
                let mut avail = 0u32;
                WinHttpQueryDataAvailable(req.0, &mut avail).map_err(|_| fail("read"))?;
                if avail == 0 {
                    break;
                }
                let start = out.len();
                out.resize(start + avail as usize, 0u8);
                let mut read = 0u32;
                WinHttpReadData(req.0, out[start..].as_mut_ptr() as *mut c_void, avail, &mut read).map_err(|_| fail("read"))?;
                out.truncate(start + read as usize);
                if read == 0 {
                    break;
                }
            }
            if status != 200 {
                return Err(format!("HTTP {status}"));
            }
            String::from_utf8(out).map_err(|_| "response is not UTF-8".to_string())
        }
    }
}

pub struct Done {
    pub words: Vec<String>,
    pub result: Result<Fixes, String>,
}

pub struct Worker {
    tx: Sender<Vec<String>>,
}

impl Worker {
    pub fn start(notify: HWND) -> Self {
        let (tx, rx) = mpsc::channel::<Vec<String>>();
        let target = hwnd_to_isize(notify);
        thread::spawn(move || {
            let http = Http::new();
            for words in rx {
                let result = match &http {
                    Ok(h) => check_via(&words, |body| h.post_form(body)),
                    Err(e) => Err(e.clone()),
                };
                let done = Box::into_raw(Box::new(Done { words, result }));
                let posted = unsafe { PostMessageW(Some(hwnd_from_isize(target)), WM_SPELLER, WPARAM(0), LPARAM(done as isize)) };
                if posted.is_err() {
                    drop(unsafe { Box::from_raw(done) });
                }
            }
        });
        Self { tx }
    }

    pub fn submit(&self, words: Vec<String>) -> bool {
        self.tx.send(words).is_ok()
    }
}

pub unsafe fn take_done(lparam: LPARAM) -> Box<Done> {
    unsafe { Box::from_raw(lparam.0 as *mut Done) }
}
