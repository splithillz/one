// Command webssh is a web terminal for one server: an HTTPS page with xterm.js
// that relays a WebSocket to the local sshd. It keeps no passwords of its own:
// whoever opens the page logs in to sshd with their usual SSH login and password.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
)

const version = "1.0.0"

const defaultEnvFile = "/etc/webssh/webssh.env"

const usageText = `webssh ` + version + ` — терминал сервера в браузере

  webssh [serve] [флаги]   запустить сервер
  webssh info [флаги]      показать ссылку и отпечаток сертификата
  webssh version           показать версию

Флаги (у каждого есть переменная окружения):
  -env FILE     файл с переменными WEBSSH_*        (по умолчанию ` + defaultEnvFile + `)
  -listen ADDR  WEBSSH_LISTEN  адрес и порт HTTPS  (:8443)
  -ssh ADDR     WEBSSH_SSH     куда подключаться   (127.0.0.1:22)
  -state DIR    WEBSSH_STATE   папка для ссылки и сертификата (/var/lib/webssh)
  -hosts LIST   WEBSSH_HOSTS   IP или домены для ссылки и сертификата, через запятую
  -cert FILE    WEBSSH_CERT    свой сертификат (fullchain.pem) вместо самоподписанного
  -key FILE     WEBSSH_KEY     ключ к нему
`

type config struct {
	Listen string
	SSH    string
	State  string
	Hosts  []string
	Cert   string
	Key    string
}

func main() {
	log.SetFlags(log.LstdFlags)
	if os.Getenv("JOURNAL_STREAM") != "" {
		log.SetFlags(0) // journald adds its own timestamps
	}

	cmd, args := "serve", os.Args[1:]
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		cmd, args = args[0], args[1:]
	}

	var err error
	switch cmd {
	case "serve":
		err = runServe(args)
	case "info":
		err = runInfo(args)
	case "ips": // for the installer: public addresses seen on the interfaces
		for _, ip := range publicIPs() {
			fmt.Println(ip)
		}
	case "version":
		fmt.Println(version)
	case "help":
		fmt.Print(usageText)
	default:
		fmt.Fprint(os.Stderr, usageText)
		os.Exit(2)
	}
	if err != nil {
		log.Fatalf("webssh: %v", err)
	}
}

func loadConfig(name string, args []string) (*config, error) {
	set := flag.NewFlagSet(name, flag.ExitOnError)
	set.Usage = func() { fmt.Fprint(os.Stderr, usageText) }
	envFile := set.String("env", "", "")
	listen := set.String("listen", "", "")
	sshAddr := set.String("ssh", "", "")
	state := set.String("state", "", "")
	hosts := set.String("hosts", "", "")
	cert := set.String("cert", "", "")
	key := set.String("key", "", "")
	if err := set.Parse(args); err != nil {
		return nil, err
	}
	if set.NArg() > 0 {
		return nil, fmt.Errorf("лишние аргументы: %s", strings.Join(set.Args(), " "))
	}

	// Under systemd the variables already come from EnvironmentFile, and the
	// file itself is unreadable for the service user: a missing or unreadable
	// default file is fine, an explicit -env that fails is not.
	if *envFile != "" {
		if err := readEnvFile(*envFile); err != nil {
			return nil, err
		}
	} else if err := readEnvFile(defaultEnvFile); err != nil && !errors.Is(err, fs.ErrNotExist) && !errors.Is(err, fs.ErrPermission) {
		return nil, err
	}

	defaultState := "/var/lib/webssh"
	if dir := os.Getenv("STATE_DIRECTORY"); dir != "" { // set by systemd StateDirectory=
		defaultState = strings.Split(dir, ":")[0]
	}

	cfg := &config{
		Listen: pick(*listen, os.Getenv("WEBSSH_LISTEN"), ":8443"),
		SSH:    pick(*sshAddr, os.Getenv("WEBSSH_SSH"), "127.0.0.1:22"),
		State:  pick(*state, os.Getenv("WEBSSH_STATE"), defaultState),
		Cert:   pick(*cert, os.Getenv("WEBSSH_CERT"), ""),
		Key:    pick(*key, os.Getenv("WEBSSH_KEY"), ""),
	}
	for _, h := range strings.FieldsFunc(pick(*hosts, os.Getenv("WEBSSH_HOSTS"), ""), func(r rune) bool {
		return r == ',' || r == ' '
	}) {
		cfg.Hosts = append(cfg.Hosts, strings.Trim(h, "[]"))
	}

	if (cfg.Cert == "") != (cfg.Key == "") {
		return nil, errors.New("WEBSSH_CERT и WEBSSH_KEY задаются только вместе")
	}
	if _, _, err := net.SplitHostPort(cfg.Listen); err != nil {
		return nil, fmt.Errorf("WEBSSH_LISTEN=%q: нужен адрес вида :8443 или 0.0.0.0:8443", cfg.Listen)
	}
	if _, _, err := net.SplitHostPort(cfg.SSH); err != nil {
		return nil, fmt.Errorf("WEBSSH_SSH=%q: нужен адрес вида 127.0.0.1:22", cfg.SSH)
	}
	cfg.State = filepath.Clean(cfg.State)
	return cfg, nil
}

// readEnvFile loads WEBSSH_* lines in systemd EnvironmentFile syntax. Variables
// that are already set in the environment win over the file.
func readEnvFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line[0] == '#' || line[0] == ';' {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(strings.TrimPrefix(k, "export "))
		v = strings.TrimSpace(v)
		if len(v) >= 2 && (v[0] == '"' || v[0] == '\'') && v[len(v)-1] == v[0] {
			v = v[1 : len(v)-1]
		}
		if !strings.HasPrefix(k, "WEBSSH_") {
			continue
		}
		if _, set := os.LookupEnv(k); !set {
			os.Setenv(k, v)
		}
	}
	return nil
}

func pick(values ...string) string {
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}
