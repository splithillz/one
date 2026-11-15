use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const CANNED: &[(&str, &str)] = &[
    ("здраствуйте", "здравствуйте"),
    ("харашо", "хорошо"),
    ("досал", "достал"),
    ("пошол", "пошел"),
    ("сказл", "сказал"),
    ("сигодня", "сегодня"),
    ("вобщем", "в общем"),
    ("дила", "дела"),
    ("превет", "привет"),
];

type Requests = Arc<Mutex<Vec<(String, Vec<String>)>>>;

#[derive(Clone)]
pub struct Relay {
    pub port: u16,
    mode: Arc<Mutex<String>>,
    requests: Requests,
}

fn url_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'+' => out.push(b' '),
            b'%' if i + 2 < b.len() => {
                if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                    out.push(v);
                    i += 2;
                } else {
                    out.push(b'%');
                }
            }
            c => out.push(c),
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn words_of(body: &str) -> Vec<String> {
    body.split('&')
        .filter_map(|kv| kv.split_once('='))
        .filter(|(k, _)| *k == "text")
        .map(|(_, v)| url_decode(v))
        .collect()
}

fn canned(words: &[String]) -> String {
    let parts: Vec<String> = words
        .iter()
        .map(|w| match CANNED.iter().find(|(k, _)| k == w) {
            Some((_, fix)) => format!(
                r#"[{{"code":1,"pos":0,"row":0,"col":0,"len":{},"word":"{w}","s":["{fix}"]}}]"#,
                w.chars().count()
            ),
            None => "[]".to_string(),
        })
        .collect();
    format!("[{}]", parts.join(","))
}

impl Relay {
    pub fn start() -> std::io::Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let relay = Relay {
            port: listener.local_addr()?.port(),
            mode: Arc::new(Mutex::new("canned".into())),
            requests: Arc::new(Mutex::new(Vec::new())),
        };
        let shared = relay.clone();
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let r = shared.clone();
                thread::spawn(move || {
                    let _ = r.serve(stream);
                });
            }
        });
        Ok(relay)
    }

    pub fn set_mode(&self, mode: &str) {
        *self.mode.lock().unwrap() = mode.to_string();
    }

    pub fn count(&self) -> usize {
        self.requests.lock().unwrap().len()
    }

    pub fn all_words(&self) -> Vec<String> {
        self.requests.lock().unwrap().iter().flat_map(|(_, w)| w.clone()).collect()
    }

    pub fn agents(&self) -> Vec<String> {
        self.requests.lock().unwrap().iter().map(|(a, _)| a.clone()).collect()
    }

    fn serve(&self, mut stream: TcpStream) -> std::io::Result<()> {
        stream.set_read_timeout(Some(Duration::from_secs(10)))?;
        let mut reader = BufReader::new(stream.try_clone()?);
        let mut line = String::new();
        reader.read_line(&mut line)?;
        let (mut len, mut agent) = (0usize, String::new());
        loop {
            let mut h = String::new();
            if reader.read_line(&mut h)? == 0 {
                break;
            }
            let h = h.trim_end();
            if h.is_empty() {
                break;
            }
            if let Some((k, v)) = h.split_once(':') {
                match k.trim().to_ascii_lowercase().as_str() {
                    "content-length" => len = v.trim().parse().unwrap_or(0),
                    "user-agent" => agent = v.trim().to_string(),
                    _ => {}
                }
            }
        }
        let mut body = vec![0u8; len];
        reader.read_exact(&mut body)?;
        let words = words_of(&String::from_utf8_lossy(&body));
        self.requests.lock().unwrap().push((agent, words.clone()));
        let mode = self.mode.lock().unwrap().clone();
        if let Some(sec) = mode.strip_prefix("slow:") {
            thread::sleep(Duration::from_secs_f32(sec.parse().unwrap_or(4.0)));
        }
        if mode == "fail" {
            stream.write_all(b"HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")?;
            return Ok(());
        }
        let json = canned(&words);
        write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            json.len()
        )?;
        stream.write_all(json.as_bytes())
    }
}
