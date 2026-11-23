package main

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/ssh"
)

// The HTTP exec API lets a program (e.g. an AI assistant with a fetch tool) run
// commands on the server. It is off unless WEBSSH_API=on. Commands are run
// through the local sshd with a key that the installer puts in the target
// user's authorized_keys, so the service itself still holds no privileges and
// the login shows up in sshd's own log, like any SSH command. The whole thing
// lives under the secret link, and every call carries the api-token on top.
type apiConfig struct {
	enabled bool
	user    string // which SSH user to run as (root by default)
	token   string
	key     ssh.Signer
	timeout time.Duration
	maxOut  int
}

const (
	apiMaxCmd  = 256 << 10 // longest command accepted
	apiMaxOut  = 2 << 20   // most output returned per stream
	apiTimeout = 120 * time.Second
)

func loadAPI(cfg *config) *apiConfig {
	on := strings.ToLower(strings.TrimSpace(os.Getenv("WEBSSH_API")))
	a := &apiConfig{
		user:    pick(os.Getenv("WEBSSH_API_USER"), "root"),
		timeout: apiTimeout,
		maxOut:  apiMaxOut,
	}
	if on != "on" && on != "1" && on != "true" && on != "yes" {
		return a
	}
	if d := envDuration("WEBSSH_API_TIMEOUT"); d > 0 {
		a.timeout = d
	}
	token, err := os.ReadFile(filepath.Join(cfg.State, "api-token"))
	if err != nil {
		log.Printf("API включён, но токен не читается (%v): API выключен", err)
		return a
	}
	a.token = strings.TrimSpace(string(token))
	if !tokenRe.MatchString(a.token) {
		log.Printf("API включён, но в api-token мусор: API выключен")
		a.token = ""
		return a
	}
	keyPEM, err := os.ReadFile(filepath.Join(cfg.State, "api_id"))
	if err != nil {
		log.Printf("API включён, но ключ не читается (%v): API выключен", err)
		return a
	}
	signer, err := ssh.ParsePrivateKey(keyPEM)
	if err != nil {
		log.Printf("API включён, но ключ не разбирается (%v): API выключен", err)
		return a
	}
	a.key = signer
	a.enabled = true
	log.Printf("HTTP API включён: выполнение команд от %s, таймаут %s", a.user, a.timeout)
	return a
}

type execResult struct {
	OK        bool   `json:"ok"`
	Exit      int    `json:"exit"`
	Stdout    string `json:"stdout"`
	Stderr    string `json:"stderr"`
	Truncated bool   `json:"truncated,omitempty"`
	Error     string `json:"error,omitempty"`
}

func (s *server) serveAPIExec(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*") // the token is the guard, not the origin
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	h.Set("Access-Control-Max-Age", "600")
	h.Set("Cache-Control", "no-store")
	h.Set("Referrer-Policy", "no-referrer")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	// Disabled API is invisible: a probe that guessed the link still sees 404.
	if s.api == nil || !s.api.enabled {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		h.Set("Allow", "GET, POST, OPTIONS")
		writeJSON(w, http.StatusMethodNotAllowed, execResult{Error: "только GET или POST"})
		return
	}

	cmd, token := readExecRequest(r)
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.api.token)) != 1 {
		time.Sleep(300 * time.Millisecond)
		writeJSON(w, http.StatusUnauthorized, execResult{Error: "неверный api-токен"})
		return
	}
	cmd = strings.TrimSpace(cmd)
	if cmd == "" {
		writeJSON(w, http.StatusBadRequest, execResult{Error: "пустая команда: передай cmd"})
		return
	}
	if len(cmd) > apiMaxCmd {
		writeJSON(w, http.StatusRequestEntityTooLarge, execResult{Error: "команда слишком длинная"})
		return
	}

	res := s.execOverSSH(cmd)
	ip := clientIP(r)
	log.Printf("API exec: ip=%s exit=%d cmd=%q", ip, res.Exit, firstLine(cmd, 300))

	if strings.EqualFold(r.URL.Query().Get("format"), "text") {
		h.Set("Content-Type", "text/plain; charset=utf-8")
		status := http.StatusOK
		if !res.OK {
			status = http.StatusBadGateway
		}
		w.WriteHeader(status)
		io.WriteString(w, res.Stdout)
		if res.Stderr != "" {
			io.WriteString(w, res.Stderr)
		}
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// readExecRequest pulls the command and token from wherever the caller put them,
// so any fetch tool can drive it regardless of how it frames the request: an
// Authorization header or a token field; the command as ?cmd=, a form field
// cmd=, a JSON body {"cmd":...}, or the raw body. The body is read by hand and
// classified by its content, not trusted to carry the right Content-Type.
func readExecRequest(r *http.Request) (cmd, token string) {
	token = strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	q := r.URL.Query()
	cmd = q.Get("cmd")
	if token == "" {
		token = q.Get("token")
	}
	if r.Method != http.MethodPost {
		return cmd, strings.TrimSpace(token)
	}

	body, _ := io.ReadAll(io.LimitReader(r.Body, apiMaxCmd+8192))
	trimmed := bytes.TrimSpace(body)
	ct := r.Header.Get("Content-Type")
	switch {
	case len(trimmed) == 0:
	case trimmed[0] == '{': // JSON, with or without the right header
		var m struct{ Cmd, Command, Token string }
		if json.Unmarshal(body, &m) == nil {
			if c := pick(m.Cmd, m.Command); c != "" {
				cmd = c
			}
			if token == "" {
				token = m.Token
			}
		}
	case strings.Contains(ct, "application/x-www-form-urlencoded"),
		bytes.HasPrefix(trimmed, []byte("cmd=")),
		bytes.HasPrefix(trimmed, []byte("token=")):
		vals, _ := url.ParseQuery(string(body))
		if c := vals.Get("cmd"); c != "" {
			cmd = c
		}
		if token == "" {
			token = vals.Get("token")
		}
		if cmd == "" && vals.Get("token") == "" { // body was a raw command that had no form keys
			cmd = string(body)
		}
	default: // raw command in the body
		if cmd == "" {
			cmd = string(body)
		}
	}
	return cmd, strings.TrimSpace(token)
}

func (s *server) execOverSSH(cmd string) execResult {
	client, err := s.dialKey(s.api.user, s.api.key)
	if err != nil {
		return execResult{Exit: -1, Error: "не подключиться к SSH (" + s.cfg.SSH + "): " + shortError(err)}
	}
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return execResult{Exit: -1, Error: "SSH не открыл сессию: " + shortError(err)}
	}
	defer sess.Close()

	out := &limitedBuffer{max: s.api.maxOut}
	errb := &limitedBuffer{max: s.api.maxOut}
	sess.Stdout = out
	sess.Stderr = errb

	var timedOut atomic.Bool
	timer := time.AfterFunc(s.api.timeout, func() {
		timedOut.Store(true)
		client.Close() // nothing else interrupts a running SSH command
	})
	runErr := sess.Run(cmd)
	timer.Stop()

	res := execResult{
		OK:        true,
		Stdout:    out.String(),
		Stderr:    errb.String(),
		Truncated: out.truncated || errb.truncated,
	}
	switch {
	case timedOut.Load():
		res.OK, res.Exit, res.Error = false, -1, fmt.Sprintf("команда не уложилась в %s и была прервана", s.api.timeout)
	case runErr == nil:
		res.Exit = 0
	default:
		var exitErr *ssh.ExitError
		if errors.As(runErr, &exitErr) {
			res.Exit = exitErr.ExitStatus() // the command ran and returned non-zero — that is a normal result
		} else {
			res.OK, res.Exit, res.Error = false, -1, "выполнение оборвалось: "+shortError(runErr)
		}
	}
	return res
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
}

// limitedBuffer keeps at most max bytes and remembers if more arrived.
type limitedBuffer struct {
	b         bytes.Buffer
	max       int
	truncated bool
}

func (l *limitedBuffer) Write(p []byte) (int, error) {
	if room := l.max - l.b.Len(); room <= 0 {
		l.truncated = true
	} else if len(p) > room {
		l.b.Write(p[:room])
		l.truncated = true
	} else {
		l.b.Write(p)
	}
	return len(p), nil // never fail the command over a full buffer
}

func (l *limitedBuffer) String() string { return l.b.String() }

func firstLine(s string, n int) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i] + " …"
	}
	if len(s) > n {
		s = s[:n] + "…"
	}
	return s
}
