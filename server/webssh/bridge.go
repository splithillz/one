package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

const (
	authTimeout  = 30 * time.Second // the page sends the login right after connecting
	pingEvery    = 25 * time.Second
	readTimeout  = 70 * time.Second // no frames and no pongs for this long: the client is gone
	writeTimeout = 30 * time.Second
	maxMessage   = 1 << 20
)

// Messages between the page and the server. Terminal bytes travel as binary
// frames in both directions; everything else is a JSON text frame.
type clientMsg struct {
	Type     string `json:"type"` // auth, resize, pause, resume
	User     string `json:"user,omitempty"`
	Password string `json:"password,omitempty"`
	Cols     int    `json:"cols,omitempty"`
	Rows     int    `json:"rows,omitempty"`
}

type serverMsg struct {
	Type    string `json:"type"` // ready, error, exit
	Message string `json:"message,omitempty"`
	Code    *int   `json:"code,omitempty"`
}

type wsConn struct {
	*websocket.Conn
	mu sync.Mutex
}

func (c *wsConn) send(mt int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.SetWriteDeadline(time.Now().Add(writeTimeout))
	return c.WriteMessage(mt, data)
}

func (c *wsConn) sendJSON(m serverMsg) error {
	data, _ := json.Marshal(m)
	return c.send(websocket.TextMessage, data)
}

func (c *wsConn) fail(msg string) {
	c.sendJSON(serverMsg{Type: "error", Message: msg})
	c.mu.Lock()
	defer c.mu.Unlock()
	c.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second))
}

func (s *server) serveWS(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	key := limitKey(ip)
	release, ok := s.limiter.acquireConn(key)
	if !ok {
		http.Error(w, "too many connections", http.StatusTooManyRequests)
		return
	}
	defer release()

	up := websocket.Upgrader{
		HandshakeTimeout: 10 * time.Second,
		ReadBufferSize:   16 << 10,
		WriteBufferSize:  32 << 10,
		CheckOrigin: func(r *http.Request) bool {
			u, err := url.Parse(r.Header.Get("Origin"))
			return err == nil && u.Scheme == "https" && strings.EqualFold(u.Host, r.Host)
		},
	}
	raw, err := up.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	conn := &wsConn{Conn: raw}
	defer conn.Close()
	conn.SetReadLimit(maxMessage)

	s.sessions.Add(1)
	defer s.sessions.Done()

	conn.SetReadDeadline(time.Now().Add(authTimeout))
	var auth clientMsg
	mt, data, err := conn.ReadMessage()
	if err != nil || mt != websocket.TextMessage || json.Unmarshal(data, &auth) != nil || auth.Type != "auth" {
		return
	}
	user := strings.TrimSpace(auth.User)
	if !validUser(user) || auth.Password == "" || len(auth.Password) > 4096 {
		conn.fail("Введи пользователя и пароль")
		return
	}

	wait, done, ok := s.limiter.acquireAuth(key)
	if !ok {
		if wait > 0 {
			conn.fail(fmt.Sprintf("Слишком много неверных паролей. Вход с твоего адреса закрыт ещё на %d мин.", int(wait.Minutes())+1))
		} else {
			conn.fail("Предыдущая попытка входа ещё идёт, подожди пару секунд")
		}
		return
	}
	client, err := s.dialSSH(user, auth.Password)
	done()
	if err != nil {
		if isAuthError(err) {
			blocked := s.limiter.fail(key)
			log.Printf("неверный пароль: user=%q ip=%s", user, ip)
			msg := "Неверный пользователь или пароль"
			if blocked {
				log.Printf("адрес %s закрыт на %s после %d ошибок", key, blockFor, maxFails)
				msg += fmt.Sprintf(". Слишком много ошибок: вход с твоего адреса закрыт на %d мин.", int(blockFor.Minutes()))
			}
			conn.fail(msg)
		} else {
			log.Printf("SSH недоступен: user=%q ip=%s: %v", user, ip, err)
			conn.fail("Не получилось подключиться к SSH на сервере (" + s.cfg.SSH + "): " + shortError(err))
		}
		return
	}
	defer client.Close()
	s.limiter.success(key)

	started := time.Now()
	log.Printf("вход: user=%q ip=%s", user, ip)
	err = s.runShell(conn, client, auth)
	log.Printf("выход: user=%q ip=%s, сессия %s%s", user, ip, time.Since(started).Round(time.Second), errSuffix(err))
}

func (s *server) runShell(conn *wsConn, client *ssh.Client, auth clientMsg) error {
	sess, err := client.NewSession()
	if err != nil {
		conn.fail("SSH не открыл сессию: " + shortError(err))
		return err
	}
	defer sess.Close()

	modes := ssh.TerminalModes{ssh.ECHO: 1, ssh.TTY_OP_ISPEED: 115200, ssh.TTY_OP_OSPEED: 115200}
	if err := sess.RequestPty("xterm-256color", clamp(auth.Rows, 2, 500, 24), clamp(auth.Cols, 10, 1000, 80), modes); err != nil {
		conn.fail("SSH не дал терминал: " + shortError(err))
		return err
	}
	// Accepted only if sshd lists them in AcceptEnv (Debian and Ubuntu accept LANG).
	sess.Setenv("LANG", "C.UTF-8")
	sess.Setenv("COLORTERM", "truecolor")

	stdin, err := sess.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := sess.StdoutPipe()
	if err != nil {
		return err
	}
	if err := sess.Shell(); err != nil {
		conn.fail("SSH не запустил оболочку: " + shortError(err))
		return err
	}
	if err := conn.sendJSON(serverMsg{Type: "ready"}); err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	exitCode := make(chan int, 1)
	go func() {
		code := 0
		var exitErr *ssh.ExitError
		if err := sess.Wait(); errors.As(err, &exitErr) {
			code = exitErr.ExitStatus()
		} else if err != nil {
			code = -1
		}
		exitCode <- code
	}()

	// Server -> page. Pauses while the page asks to (it cannot draw as fast as
	// `cat` of a big file prints), which pushes back on the remote process
	// through the SSH channel window instead of piling data up in the browser.
	flow := newGate()
	go func() {
		defer cancel()
		buf := make([]byte, 32<<10)
		for flow.wait(ctx) {
			n, err := stdout.Read(buf)
			if n > 0 {
				if conn.send(websocket.BinaryMessage, buf[:n]) != nil {
					return
				}
			}
			if err != nil {
				break
			}
		}
		select {
		case code := <-exitCode:
			conn.sendJSON(serverMsg{Type: "exit", Code: &code})
		case <-time.After(2 * time.Second):
		case <-ctx.Done():
			return
		}
		conn.mu.Lock()
		conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second))
		conn.mu.Unlock()
	}()

	go func() {
		t := time.NewTicker(pingEvery)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				if s.ctx.Err() != nil {
					conn.fail("Сервер перезапускается, подключись снова через несколько секунд")
				}
				conn.Close() // unblocks ReadMessage below
				return
			case <-t.C:
				if conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(writeTimeout)) != nil {
					cancel()
				}
			}
		}
	}()

	// Page -> server.
	conn.SetReadDeadline(time.Now().Add(readTimeout))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(readTimeout))
	})
	for {
		mt, data, err := conn.ReadMessage()
		if err != nil {
			return nil
		}
		conn.SetReadDeadline(time.Now().Add(readTimeout))
		switch mt {
		case websocket.BinaryMessage:
			if _, err := stdin.Write(data); err != nil {
				return nil
			}
		case websocket.TextMessage:
			var m clientMsg
			if json.Unmarshal(data, &m) != nil {
				continue
			}
			switch m.Type {
			case "resize":
				sess.WindowChange(clamp(m.Rows, 2, 500, 24), clamp(m.Cols, 10, 1000, 80))
			case "pause":
				flow.pause()
			case "resume":
				flow.resume()
			}
		}
	}
}

func (s *server) dialSSH(user, password string) (*ssh.Client, error) {
	asked := false
	cfg := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
			// Some servers take passwords only through PAM prompts.
			ssh.KeyboardInteractive(func(_, _ string, questions []string, _ []bool) ([]string, error) {
				if len(questions) == 0 {
					return nil, nil
				}
				if asked {
					return nil, errors.New("sshd asks again: wrong password or a second factor")
				}
				asked = true
				answers := make([]string, len(questions))
				for i := range answers {
					answers[i] = password
				}
				return answers, nil
			}),
		},
		HostKeyCallback: s.hostKeys.check,
		Timeout:         10 * time.Second,
	}
	nc, err := net.DialTimeout("tcp", s.cfg.SSH, 10*time.Second)
	if err != nil {
		return nil, err
	}
	nc.SetDeadline(time.Now().Add(20 * time.Second))
	c, chans, reqs, err := ssh.NewClientConn(nc, s.cfg.SSH, cfg)
	if err != nil {
		nc.Close()
		return nil, err
	}
	nc.SetDeadline(time.Time{})
	return ssh.NewClient(c, chans, reqs), nil
}

func isAuthError(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "unable to authenticate") || strings.Contains(msg, "no supported methods remain")
}

// hostKeys pins the local sshd to the host keys in /etc/ssh, so a process that
// grabs the SSH port while sshd is down cannot collect passwords.
type hostKeys struct {
	keys map[string]bool
}

func loadHostKeys(sshAddr string) *hostKeys {
	host, _, _ := net.SplitHostPort(sshAddr)
	ip := net.ParseIP(host)
	if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
		log.Printf("SSH не на этой машине (%s): ключ сервера не проверяется", sshAddr)
		return &hostKeys{}
	}
	files, _ := filepath.Glob("/etc/ssh/ssh_host_*_key.pub")
	hk := &hostKeys{keys: make(map[string]bool)}
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		if pk, _, _, _, err := ssh.ParseAuthorizedKey(data); err == nil {
			hk.keys[string(pk.Marshal())] = true
		}
	}
	if len(hk.keys) == 0 {
		log.Printf("ключи в /etc/ssh/ssh_host_*_key.pub не прочитались: ключ сервера не проверяется")
		hk.keys = nil
	}
	return hk
}

func (hk *hostKeys) check(_ string, _ net.Addr, key ssh.PublicKey) error {
	if hk.keys == nil || hk.keys[string(key.Marshal())] {
		return nil
	}
	return fmt.Errorf("ключ SSH-сервера %s не совпал с /etc/ssh/ssh_host_*_key.pub", ssh.FingerprintSHA256(key))
}

// gate pauses the output pump.
type gate struct {
	mu     sync.Mutex
	paused bool
	ch     chan struct{}
}

func newGate() *gate { return &gate{} }

func (g *gate) wait(ctx context.Context) bool {
	for {
		g.mu.Lock()
		if !g.paused {
			g.mu.Unlock()
			return ctx.Err() == nil
		}
		ch := g.ch
		g.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return false
		}
	}
}

func (g *gate) pause() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if !g.paused {
		g.paused = true
		g.ch = make(chan struct{})
	}
}

func (g *gate) resume() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.paused {
		g.paused = false
		close(g.ch)
	}
}

func validUser(u string) bool {
	if u == "" || len(u) > 64 || strings.HasPrefix(u, "-") {
		return false
	}
	for _, r := range u {
		if unicode.IsSpace(r) || unicode.IsControl(r) {
			return false
		}
	}
	return true
}

func clamp(v, lo, hi, def int) int {
	if v == 0 {
		return def
	}
	return max(lo, min(hi, v))
}

func shortError(err error) string {
	var opErr *net.OpError
	switch {
	case errors.As(err, &opErr) && strings.Contains(err.Error(), "connection refused"):
		return "sshd не слушает этот порт"
	case errors.Is(err, os.ErrDeadlineExceeded) || strings.Contains(err.Error(), "i/o timeout"):
		return "sshd не ответил вовремя"
	}
	msg := err.Error()
	msg = strings.TrimPrefix(msg, "ssh: handshake failed: ")
	if len(msg) > 160 {
		msg = msg[:160] + "…"
	}
	return msg
}

func errSuffix(err error) string {
	if err == nil {
		return ""
	}
	return ", " + err.Error()
}
