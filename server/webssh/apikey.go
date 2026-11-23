package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"flag"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"

	"golang.org/x/crypto/ssh"
)

// runGenAPIKey is run by the installer as root. It creates (once) the api-token
// and an SSH key for the exec API, stores both in the state directory owned by
// the service user, and adds the public key to the target user's
// authorized_keys locked to loopback. The service, which has no privileges of
// its own, then uses that key to run commands over the local sshd.
func runGenAPIKey(args []string) error {
	set := flag.NewFlagSet("gen-api-key", flag.ExitOnError)
	state := set.String("state", "/var/lib/webssh", "папка для ключа и токена")
	target := set.String("user", "root", "SSH-пользователь, под которым выполнять команды")
	owner := set.String("owner", "webssh", "кому принадлежат ключ и токен (пользователь сервиса)")
	akFile := set.String("authorized-keys", "", "файл authorized_keys целевого пользователя")
	if err := set.Parse(args); err != nil {
		return err
	}
	if err := os.MkdirAll(*state, 0o700); err != nil {
		return err
	}

	tokenPath := filepath.Join(*state, "api-token")
	if _, err := os.Stat(tokenPath); err != nil {
		tok, err := randToken()
		if err != nil {
			return err
		}
		if err := writeFileAtomic(tokenPath, []byte(tok+"\n"), 0o600); err != nil {
			return err
		}
	}

	keyPath := filepath.Join(*state, "api_id")
	signer, err := loadOrCreateKey(keyPath)
	if err != nil {
		return err
	}
	chownTo(tokenPath, *owner)
	chownTo(keyPath, *owner)

	if *akFile != "" {
		line := `restrict,from="127.0.0.1,::1" ` + strings.TrimRight(string(ssh.MarshalAuthorizedKey(signer.PublicKey())), "\n") + " webssh-api"
		if err := ensureAuthorizedKey(*akFile, *target, line); err != nil {
			return err
		}
	}
	return nil
}

func loadOrCreateKey(path string) (ssh.Signer, error) {
	if data, err := os.ReadFile(path); err == nil {
		return ssh.ParsePrivateKey(data)
	}
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return nil, err
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
	if err := writeFileAtomic(path, pemBytes, 0o600); err != nil {
		return nil, err
	}
	return ssh.NewSignerFromKey(priv)
}

// ensureAuthorizedKey appends the line unless its key is already present.
func ensureAuthorizedKey(path, owner, line string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	fields := strings.Fields(line)
	keyBlob := fields[len(fields)-2] // the base64 public key

	existing, _ := os.ReadFile(path)
	if bytes.Contains(existing, []byte(keyBlob)) {
		chownTo(dir, owner)
		chownTo(path, owner)
		return nil
	}
	buf := existing
	if len(buf) > 0 && buf[len(buf)-1] != '\n' {
		buf = append(buf, '\n')
	}
	buf = append(buf, []byte(line+"\n")...)
	if err := writeFileAtomic(path, buf, 0o600); err != nil {
		return err
	}
	chownTo(dir, owner)
	chownTo(path, owner)
	return nil
}

// chownTo best-effort gives path to the named user and its primary group.
func chownTo(path, name string) {
	u, err := user.Lookup(name)
	if err != nil {
		return
	}
	uid, _ := strconv.Atoi(u.Uid)
	gid, _ := strconv.Atoi(u.Gid)
	os.Chown(path, uid, gid)
}

func randToken() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// apiInfo prints the exec API block for `webssh info`, or nothing if off.
func apiInfo(cfg *config, urls []string) {
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("WEBSSH_API"))); v != "on" && v != "1" && v != "true" && v != "yes" {
		return
	}
	data, err := os.ReadFile(filepath.Join(cfg.State, "api-token"))
	if err != nil {
		fmt.Println("\nHTTP API включён, но токен не читается:", err)
		return
	}
	token := strings.TrimSpace(string(data))
	apiURL := ""
	if len(urls) > 0 {
		apiURL = strings.TrimRight(urls[0], "/") + "/api/exec"
	}
	user := pick(os.Getenv("WEBSSH_API_USER"), "root")
	fmt.Println("\nHTTP API (выполнение команд программой или ИИ):")
	fmt.Println("  URL:   " + apiURL)
	fmt.Println("  token: " + token)
	fmt.Println("  команды выполняются от:", user)
	fmt.Println("  пример:")
	fmt.Printf("    curl -k -H 'Authorization: Bearer %s' --data-urlencode cmd='uptime' %s\n", token, apiURL)
	fmt.Println("  ответ — JSON {ok, exit, stdout, stderr}. Добавь ?format=text для голого вывода.")
}
