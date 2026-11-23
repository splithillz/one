package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed web
var webFS embed.FS

var tokenRe = regexp.MustCompile(`^[A-Za-z0-9_-]{16,128}$`)

type server struct {
	cfg      *config
	token    string
	hostname string
	page     []byte
	assets   map[string]*asset
	limiter  *limiter
	hostKeys *hostKeys
	api      *apiConfig
	ctx      context.Context
	sessions sync.WaitGroup
}

type asset struct {
	data, gz []byte
	ctype    string
	etag     string
}

var contentTypes = map[string]string{
	".js":          "text/javascript; charset=utf-8",
	".mjs":         "text/javascript; charset=utf-8",
	".css":         "text/css; charset=utf-8",
	".svg":         "image/svg+xml",
	".woff2":       "font/woff2",
	".webmanifest": "application/manifest+json",
	".txt":         "text/plain; charset=utf-8",
}

func runServe(args []string) error {
	cfg, err := loadConfig("serve", args)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.State, 0o700); err != nil {
		return err
	}
	token, err := loadToken(cfg.State, true)
	if err != nil {
		return err
	}
	certs, err := newCertStore(cfg)
	if err != nil {
		return fmt.Errorf("сертификат: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	s := &server{
		cfg:      cfg,
		token:    token,
		limiter:  newLimiter(),
		hostKeys: loadHostKeys(cfg.SSH),
		api:      loadAPI(cfg),
		ctx:      ctx,
	}
	s.hostname, _ = os.Hostname()
	if err := s.loadAssets(); err != nil {
		return err
	}

	ln, err := net.Listen("tcp", cfg.Listen)
	if err != nil {
		return err
	}
	srv := &http.Server{
		Handler:           s,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		MaxHeaderBytes:    16 << 10,
		ErrorLog:          log.New(quietLog{}, "", 0),
		TLSConfig: &tls.Config{
			MinVersion:     tls.VersionTLS12,
			GetCertificate: certs.getCertificate,
			NextProtos:     []string{"http/1.1"},
		},
		// HTTP/2 is off: the terminal lives on a WebSocket, which needs HTTP/1.1.
		TLSNextProto: map[string]func(*http.Server, *tls.Conn, http.Handler){},
	}

	log.Printf("webssh %s слушает %s, SSH: %s", version, ln.Addr(), cfg.SSH)
	for _, u := range s.urls(certs) {
		log.Printf("ссылка: %s", u)
	}
	log.Printf("сертификат SHA-256 %s", fingerprint(certs.leaf))

	errc := make(chan error, 1)
	go func() { errc <- srv.ServeTLS(ln, "", "") }()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Printf("останавливаюсь")
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(shutdown)
	done := make(chan struct{})
	go func() { s.sessions.Wait(); close(done) }()
	select {
	case <-done:
	case <-shutdown.Done():
	}
	return nil
}

func runInfo(args []string) error {
	cfg, err := loadConfig("info", args)
	if err != nil {
		return err
	}
	token, err := loadToken(cfg.State, false)
	if err != nil {
		return fmt.Errorf("ссылки ещё нет: %w (сервис запускался?)", err)
	}
	certFile := cfg.Cert
	if certFile == "" {
		certFile = filepath.Join(cfg.State, "tls.crt")
	}
	cs := &certStore{certFile: certFile, keyFile: cfg.Key, custom: cfg.Cert != ""}
	if cfg.Key == "" {
		cs.keyFile = filepath.Join(cfg.State, "tls.key")
	}
	if err := cs.load(); err != nil {
		return fmt.Errorf("сертификат: %w", err)
	}
	s := &server{cfg: cfg, token: token}
	fmt.Println("Ссылка:")
	for _, u := range s.urls(cs) {
		fmt.Println("  " + u)
	}
	kind := "самоподписанный: браузер один раз предупредит, это нормально"
	if cs.custom {
		kind = "свой: " + certFile
	}
	fmt.Printf("Сертификат %s\n", kind)
	fmt.Printf("  SHA-256 %s\n", fingerprint(cs.leaf))
	fmt.Printf("  действует до %s\n", cs.leaf.NotAfter.Format("02.01.2006"))
	fmt.Printf("SSH: %s\n", cfg.SSH)
	apiInfo(cfg, s.urls(cs))
	return nil
}

// urls lists the page addresses: configured hosts first, then the names from
// the certificate (public IPs of the machine).
func (s *server) urls(cs *certStore) []string {
	_, port, _ := net.SplitHostPort(s.cfg.Listen)
	var hosts []string
	seen := make(map[string]bool)
	add := func(h string) {
		if h != "" && !seen[h] {
			seen[h] = true
			hosts = append(hosts, h)
		}
	}
	for _, h := range s.cfg.Hosts {
		add(h)
	}
	if cs != nil && cs.leaf != nil {
		for _, n := range cs.leaf.DNSNames {
			add(n)
		}
		for _, ip := range cs.leaf.IPAddresses {
			add(ip.String())
		}
	}
	for _, ip := range publicIPs() {
		add(ip.String())
	}
	if len(hosts) == 0 {
		add("IP-сервера")
	}
	var urls []string
	for _, h := range hosts {
		hp := net.JoinHostPort(h, port)
		if port == "443" {
			hp = h
			if strings.Contains(h, ":") {
				hp = "[" + h + "]"
			}
		}
		urls = append(urls, "https://"+hp+"/"+s.token+"/")
	}
	return urls
}

// loadToken reads the secret part of the URL, creating it on first start.
func loadToken(dir string, create bool) (string, error) {
	file := filepath.Join(dir, "token")
	data, err := os.ReadFile(file)
	if err == nil {
		t := strings.TrimSpace(string(data))
		if tokenRe.MatchString(t) {
			return t, nil
		}
		if !create {
			return "", fmt.Errorf("в %s мусор вместо ссылки", file)
		}
		log.Printf("в %s мусор вместо ссылки, делаю новую", file)
	} else if !create || !errors.Is(err, fs.ErrNotExist) {
		return "", err
	}
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	t := base64.RawURLEncoding.EncodeToString(b)
	if err := writeFileAtomic(file, []byte(t+"\n"), 0o600); err != nil {
		return "", err
	}
	log.Printf("сделана новая секретная ссылка")
	return t, nil
}

func (s *server) loadAssets() error {
	s.assets = make(map[string]*asset)
	err := fs.WalkDir(webFS, "web", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		name := strings.TrimPrefix(p, "web/")
		if name == "index.html" {
			return nil
		}
		data, err := webFS.ReadFile(p)
		if err != nil {
			return err
		}
		ctype, ok := contentTypes[path.Ext(name)]
		if !ok {
			return fmt.Errorf("неизвестный тип файла %s", name)
		}
		sum := sha256.Sum256(data)
		a := &asset{data: data, ctype: ctype, etag: `"` + hex.EncodeToString(sum[:8]) + `"`}
		if path.Ext(name) != ".woff2" && len(data) > 1024 {
			var buf bytes.Buffer
			zw, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
			zw.Write(data)
			zw.Close()
			a.gz = buf.Bytes()
		}
		s.assets[name] = a
		return nil
	})
	if err != nil {
		return err
	}
	tmpl, err := template.ParseFS(webFS, "web/index.html")
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, map[string]string{"Host": s.hostname, "Version": version})
	s.page = buf.Bytes()
	return err
}

var hostHeaderRe = regexp.MustCompile(`^[A-Za-z0-9.\-]+(:[0-9]{1,5})?$|^\[[0-9A-Fa-f:.]+\](:[0-9]{1,5})?$`)

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("X-Frame-Options", "DENY")
	h.Set("X-Robots-Tag", "noindex, nofollow")
	h.Set("Cross-Origin-Opener-Policy", "same-origin")
	h.Set("Cross-Origin-Resource-Policy", "same-origin")

	// Everything lives under /<token>/. Without the token the server looks
	// like an empty Go web server, and the login form is not reachable.
	seg, tail, slash := strings.Cut(strings.TrimPrefix(r.URL.Path, "/"), "/")
	if subtle.ConstantTimeCompare([]byte(seg), []byte(s.token)) != 1 {
		http.NotFound(w, r)
		return
	}
	// The exec API takes POST/OPTIONS, so it is routed before the page's
	// GET-only restriction below.
	if tail == "api/exec" {
		s.serveAPIExec(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		h.Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	switch {
	case !slash:
		http.Redirect(w, r, "/"+s.token+"/", http.StatusFound)
	case tail == "":
		s.servePage(w, r)
	case tail == "ws":
		s.serveWS(w, r)
	case strings.HasPrefix(tail, "assets/"):
		s.serveAsset(w, r, strings.TrimPrefix(tail, "assets/"))
	default:
		http.NotFound(w, r)
	}
}

func (s *server) servePage(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	connect := "'self'"
	if hostHeaderRe.MatchString(r.Host) {
		connect += " wss://" + r.Host // older Safari does not count wss: as 'self'
	}
	h.Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
		"img-src 'self' data:; font-src 'self'; connect-src "+connect+"; manifest-src 'self'; "+
		"base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	w.Write(s.page)
}

func (s *server) serveAsset(w http.ResponseWriter, r *http.Request, name string) {
	a, ok := s.assets[name]
	if !ok {
		http.NotFound(w, r)
		return
	}
	h := w.Header()
	h.Set("Content-Type", a.ctype)
	h.Set("Cache-Control", "no-cache")
	h.Set("ETag", a.etag)
	h.Add("Vary", "Accept-Encoding")
	if match := r.Header.Get("If-None-Match"); match != "" && strings.Contains(match, a.etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body := a.data
	if a.gz != nil && strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		h.Set("Content-Encoding", "gzip")
		body = a.gz
	}
	h.Set("Content-Length", fmt.Sprint(len(body)))
	if r.Method == http.MethodHead {
		return
	}
	w.Write(body)
}

// quietLog drops the TLS handshake noise that scanners produce all day.
type quietLog struct{}

func (quietLog) Write(p []byte) (int, error) {
	if bytes.Contains(p, []byte("TLS handshake error")) {
		return len(p), nil
	}
	log.Print(string(bytes.TrimRight(p, "\n")))
	return len(p), nil
}
