#!/usr/bin/env python3
import argparse
import http.server
import json
import os
import time
import urllib.parse
import urllib.request

API = "https://speller.yandex.net/services/spellservice.json/checkTexts"
CANNED = {
    "здраствуйте": "здравствуйте",
    "харашо": "хорошо",
    "досал": "достал",
    "пошол": "пошел",
    "сказл": "сказал",
    "сигодня": "сегодня",
    "вобщем": "в общем",
    "дила": "дела",
    "превет": "привет",
}


def canned(words):
    out = []
    for w in words:
        fix = CANNED.get(w)
        out.append([] if fix is None else [{"code": 1, "pos": 0, "row": 0, "col": 0, "len": len(w), "word": w, "s": [fix]}])
    return json.dumps(out, ensure_ascii=False).encode("utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--mode-file", required=True)
    ap.add_argument("--log", required=True)
    ap.add_argument("--real", action="store_true")
    args = ap.parse_args()

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            words = [v for k, v in urllib.parse.parse_qsl(body.decode("utf-8")) if k == "text"]
            mode = "canned"
            if os.path.exists(args.mode_file):
                mode = open(args.mode_file, encoding="utf-8").read().strip() or "canned"
            with open(args.log, "a", encoding="utf-8") as f:
                f.write(json.dumps({"t": round(time.time(), 3), "mode": mode, "words": words, "ua": self.headers.get("User-Agent")}, ensure_ascii=False) + "\n")
            if mode.startswith("slow"):
                time.sleep(float(mode.split(":")[1]) if ":" in mode else 4)
            if mode == "fail":
                self.send_response(500)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if args.real:
                req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
                data = urllib.request.urlopen(req, timeout=10).read()
            else:
                data = canned(words)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
