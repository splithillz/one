package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

// Apple platforms refuse server certificates valid for longer than 825 days,
// even ones the user trusted by hand.
const selfSignedLifetime = 825 * 24 * time.Hour

// certStore hands out the TLS certificate. A certificate given with -cert/-key
// is re-read when its files change (certbot renewals); a self-signed one lives
// in the state directory and is re-issued shortly before it expires.
type certStore struct {
	mu        sync.Mutex
	certFile  string
	keyFile   string
	custom    bool
	names     []string
	cert      *tls.Certificate
	leaf      *x509.Certificate
	checked   time.Time
	certMtime time.Time
	keyMtime  time.Time
}

func newCertStore(cfg *config) (*certStore, error) {
	cs := &certStore{certFile: cfg.Cert, keyFile: cfg.Key, custom: cfg.Cert != ""}
	if !cs.custom {
		cs.certFile = filepath.Join(cfg.State, "tls.crt")
		cs.keyFile = filepath.Join(cfg.State, "tls.key")
		cs.names = certNames(cfg.Hosts)
	}
	if err := cs.load(); err != nil {
		if cs.custom {
			return nil, err
		}
		if !errors.Is(err, os.ErrNotExist) {
			log.Printf("сертификат в %s не читается (%v), выпускаю новый", cfg.State, err)
		}
		if err := cs.issue(); err != nil {
			return nil, err
		}
	} else if !cs.custom && cs.needsReissue() {
		if err := cs.issue(); err != nil {
			return nil, err
		}
	}
	cs.checked = time.Now()
	return cs, nil
}

func (cs *certStore) load() error {
	cert, err := tls.LoadX509KeyPair(cs.certFile, cs.keyFile)
	if err != nil {
		return err
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return err
	}
	cs.cert, cs.leaf = &cert, leaf
	cs.certMtime, cs.keyMtime = mtime(cs.certFile), mtime(cs.keyFile)
	return nil
}

// needsReissue reports whether the self-signed certificate is about to expire
// or no longer covers the server's addresses (an IP changed, a host was added).
func (cs *certStore) needsReissue() bool {
	if time.Until(cs.leaf.NotAfter) < 30*24*time.Hour {
		return true
	}
	have := make(map[string]bool)
	for _, n := range cs.leaf.DNSNames {
		have[strings.ToLower(n)] = true
	}
	for _, ip := range cs.leaf.IPAddresses {
		have[ip.String()] = true
	}
	for _, n := range cs.names {
		if ip := net.ParseIP(n); ip != nil {
			n = ip.String()
		}
		if !have[strings.ToLower(n)] {
			return true
		}
	}
	return false
}

func (cs *certStore) issue() error {
	certPEM, keyPEM, err := selfSigned(cs.names)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(cs.certFile), 0o700); err != nil {
		return err
	}
	if err := writeFileAtomic(cs.keyFile, keyPEM, 0o600); err != nil {
		return err
	}
	if err := writeFileAtomic(cs.certFile, certPEM, 0o644); err != nil {
		return err
	}
	if err := cs.load(); err != nil {
		return err
	}
	log.Printf("выпущен самоподписанный сертификат для %s, SHA-256 %s", strings.Join(cs.names, ", "), fingerprint(cs.leaf))
	return nil
}

func (cs *certStore) getCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	if time.Since(cs.checked) > time.Minute {
		cs.checked = time.Now()
		cs.refresh()
	}
	return cs.cert, nil
}

func (cs *certStore) refresh() {
	if cs.custom {
		if mtime(cs.certFile).Equal(cs.certMtime) && mtime(cs.keyFile).Equal(cs.keyMtime) {
			return
		}
		if err := cs.load(); err != nil {
			log.Printf("новый сертификат не загрузился, остаюсь на старом: %v", err)
			return
		}
		log.Printf("сертификат перечитан, действует до %s", cs.leaf.NotAfter.Format("2006-01-02"))
		return
	}
	if time.Until(cs.leaf.NotAfter) < 30*24*time.Hour {
		if err := cs.issue(); err != nil {
			log.Printf("не удалось перевыпустить сертификат: %v", err)
		}
	}
}

func selfSigned(names []string) (certPEM, keyPEM []byte, err error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 127))
	if err != nil {
		return nil, nil, err
	}
	now := time.Now()
	tmpl := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: names[0]},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(selfSignedLifetime),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	for _, n := range names {
		if ip := net.ParseIP(n); ip != nil {
			tmpl.IPAddresses = append(tmpl.IPAddresses, ip)
		} else {
			tmpl.DNSNames = append(tmpl.DNSNames, n)
		}
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return nil, nil, err
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return nil, nil, err
	}
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
	return certPEM, keyPEM, nil
}

// certNames lists what the self-signed certificate is issued for: the hosts
// from the config and the public addresses of this machine. Private and
// loopback addresses stay out, since the certificate is shown to anyone who
// knocks on the port.
func certNames(hosts []string) []string {
	var names []string
	add := func(n string) {
		if n != "" && !slices.Contains(names, n) {
			names = append(names, n)
		}
	}
	for _, h := range hosts {
		add(strings.ToLower(h))
	}
	for _, ip := range publicIPs() {
		add(ip.String())
	}
	if len(names) == 0 {
		if h, err := os.Hostname(); err == nil {
			add(strings.ToLower(h))
		}
	}
	if len(names) == 0 {
		add("localhost")
	}
	return names
}

// publicIPs returns the global unicast, non-private addresses of this machine,
// IPv4 first.
func publicIPs() []net.IP {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil
	}
	var v4, v6 []net.IP
	for _, a := range addrs {
		ipn, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		ip := ipn.IP
		if !ip.IsGlobalUnicast() || ip.IsPrivate() || isCGNAT(ip) {
			continue
		}
		if ip.To4() != nil {
			v4 = append(v4, ip.To4())
		} else {
			v6 = append(v6, ip)
		}
	}
	return append(v4, v6...)
}

func isCGNAT(ip net.IP) bool {
	ip4 := ip.To4()
	return ip4 != nil && ip4[0] == 100 && ip4[1]&0xc0 == 64
}

func fingerprint(c *x509.Certificate) string {
	sum := sha256.Sum256(c.Raw)
	parts := make([]string, len(sum))
	for i, b := range sum {
		parts[i] = fmt.Sprintf("%02X", b)
	}
	return strings.Join(parts, ":")
}

func mtime(path string) time.Time {
	st, err := os.Stat(path)
	if err != nil {
		return time.Time{}
	}
	return st.ModTime()
}

func writeFileAtomic(path string, data []byte, perm os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(perm); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
