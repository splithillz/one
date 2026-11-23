package main

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	failWindow    = 15 * time.Minute // failed logins are counted over this window
	maxFails      = 5                // that many failures inside the window block the address
	blockFor      = 15 * time.Minute // for this long
	maxConnsPerIP = 8                // open WebSockets from one address
	maxConnsTotal = 64               // open WebSockets overall
	maxAuthTotal  = 8                // SSH logins in progress overall
)

// limiter slows down password guessing through the page. sshd sees every
// login as coming from 127.0.0.1, so it cannot tell attackers apart: the
// counting has to happen here, per client address (per /64 for IPv6).
type limiter struct {
	mu        sync.Mutex
	fails     map[string][]time.Time
	blocked   map[string]time.Time
	conns     map[string]int
	connTotal int
	authing   map[string]bool
	authTotal int
}

func newLimiter() *limiter {
	l := &limiter{
		fails:   make(map[string][]time.Time),
		blocked: make(map[string]time.Time),
		conns:   make(map[string]int),
		authing: make(map[string]bool),
	}
	go func() {
		for range time.Tick(5 * time.Minute) {
			l.sweep()
		}
	}()
	return l
}

// acquireConn reserves a WebSocket slot for the address.
func (l *limiter) acquireConn(key string) (release func(), ok bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.connTotal >= maxConnsTotal || l.conns[key] >= maxConnsPerIP {
		return nil, false
	}
	l.conns[key]++
	l.connTotal++
	var once sync.Once
	return func() {
		once.Do(func() {
			l.mu.Lock()
			defer l.mu.Unlock()
			l.connTotal--
			if l.conns[key]--; l.conns[key] <= 0 {
				delete(l.conns, key)
			}
		})
	}, true
}

// acquireAuth allows one login attempt at a time per address, so parallel
// connections cannot slip past the failure counter.
func (l *limiter) acquireAuth(key string) (wait time.Duration, release func(), ok bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if until, b := l.blocked[key]; b {
		if left := time.Until(until); left > 0 {
			return left, nil, false
		}
		delete(l.blocked, key)
	}
	if l.authing[key] || l.authTotal >= maxAuthTotal {
		return 0, nil, false
	}
	l.authing[key] = true
	l.authTotal++
	return 0, func() {
		l.mu.Lock()
		defer l.mu.Unlock()
		delete(l.authing, key)
		l.authTotal--
	}, true
}

// fail records a wrong password and reports whether the address is now blocked.
func (l *limiter) fail(key string) (blocked bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	recent := l.fails[key][:0]
	for _, t := range l.fails[key] {
		if now.Sub(t) < failWindow {
			recent = append(recent, t)
		}
	}
	recent = append(recent, now)
	if len(recent) >= maxFails {
		l.blocked[key] = now.Add(blockFor)
		delete(l.fails, key)
		return true
	}
	l.fails[key] = recent
	return false
}

func (l *limiter) success(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.fails, key)
}

func (l *limiter) sweep() {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	for k, until := range l.blocked {
		if now.After(until) {
			delete(l.blocked, k)
		}
	}
	for k, ts := range l.fails {
		if len(ts) == 0 || now.Sub(ts[len(ts)-1]) >= failWindow {
			delete(l.fails, k)
		}
	}
}

// clientIP is the TCP peer address. The service is meant to face the
// internet directly, so forwarding headers are not trusted.
func clientIP(r *http.Request) net.IP {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return net.ParseIP(host)
}

// limitKey groups IPv6 clients by /64: one host usually owns the whole prefix.
func limitKey(ip net.IP) string {
	if ip == nil {
		return "?"
	}
	if ip4 := ip.To4(); ip4 != nil {
		return ip4.String()
	}
	return ip.Mask(net.CIDRMask(64, 128)).String() + "/64"
}
