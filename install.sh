#!/usr/bin/env bash
# =============================================================================
#  GudangLingling AI — Installer Linux / macOS
#  Pengembang: Liana Sry Astuti (NIM: 2422031) — Teknik Komputer ITEBA
# =============================================================================
set -e

BOLD=$(tput bold 2>/dev/null || echo "")
RESET=$(tput sgr0 2>/dev/null || echo "")
GREEN=$(tput setaf 2 2>/dev/null || echo "")
YELLOW=$(tput setaf 3 2>/dev/null || echo "")
RED=$(tput setaf 1 2>/dev/null || echo "")
CYAN=$(tput setaf 6 2>/dev/null || echo "")

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="/etc/systemd/system/gudanglingling.service"
CURRENT_USER="$(whoami)"
PYTHON_CMD=""

print_header() {
  echo ""
  echo "${CYAN}${BOLD}=========================================="
  echo "  GudangLingling AI — Installer"
  echo "==========================================${RESET}"
  echo ""
}

print_step() { echo "${BOLD}[*] $1${RESET}"; }
print_ok()   { echo "${GREEN}[+] $1${RESET}"; }
print_warn() { echo "${YELLOW}[!] $1${RESET}"; }
print_err()  { echo "${RED}[x] $1${RESET}"; }

# ---------------------------------------------------------------------------
detect_python() {
  for cmd in python3 python3.12 python3.11 python3.10 python; do
    if command -v "$cmd" &>/dev/null; then
      VER=$($cmd -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')" 2>/dev/null)
      MAJOR=$(echo "$VER" | cut -d. -f1)
      MINOR=$(echo "$VER" | cut -d. -f2)
      if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 8 ]; then
        PYTHON_CMD="$cmd"
        return 0
      fi
    fi
  done
  return 1
}

check_port() {
  PORT_NUM=$($PYTHON_CMD -c "import config; print(config.PORT)" 2>/dev/null || echo "8085")
  if lsof -i :$PORT_NUM &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":$PORT_NUM"; then
    print_warn "Port $PORT_NUM sudah digunakan oleh proses lain."
    print_warn "Edit config.py dan ganti PORT jika diperlukan."
  fi
}

# ---------------------------------------------------------------------------
print_header

# 1. Cek Python
print_step "Memeriksa Python 3.8+..."
if detect_python; then
  print_ok "Python ditemukan: $PYTHON_CMD (versi $VER)"
else
  print_err "Python 3.8+ tidak ditemukan. Install terlebih dahulu:"
  echo "  Ubuntu/Debian : sudo apt install python3"
  echo "  Fedora/RHEL   : sudo dnf install python3"
  echo "  macOS (brew)  : brew install python3"
  exit 1
fi

# 2. Cek Python stdlib
print_step "Memeriksa dependensi Python..."
$PYTHON_CMD -c "import http.server, json, sqlite3, urllib.parse, threading, pathlib; print('OK')" &>/dev/null
print_ok "Semua modul stdlib tersedia. Tidak perlu pip install."

# 3. Inisialisasi database
print_step "Menginisialisasi database SQLite..."
cd "$PROJECT_DIR"
$PYTHON_CMD run.py seed
print_ok "Database berhasil disiapkan."

# 4. Cek port
PORT_NUM=$($PYTHON_CMD -c "import config; print(config.PORT)" 2>/dev/null || echo "8085")
print_step "Memeriksa ketersediaan port $PORT_NUM..."
check_port
print_ok "Port $PORT_NUM siap digunakan."

# 5. Buat skrip start
print_step "Membuat skrip start.sh..."
cat > "$PROJECT_DIR/start.sh" << EOF
#!/usr/bin/env bash
cd "$(dirname "\$0")"
exec $PYTHON_CMD app.py
EOF
chmod +x "$PROJECT_DIR/start.sh"
print_ok "start.sh dibuat."

# 6. Tawarkan systemd service (opsional, butuh sudo)
if command -v systemctl &>/dev/null && [ -d /etc/systemd ]; then
  echo ""
  read -r -p "${BOLD}Daftarkan sebagai systemd service (auto-start saat boot)? [y/N] ${RESET}" ANSWER
  if [[ "${ANSWER,,}" == "y" ]]; then
    if [ "$(id -u)" -ne 0 ]; then
      print_warn "Membutuhkan sudo untuk membuat service..."
      SUDO_CMD="sudo"
    else
      SUDO_CMD=""
    fi

    $SUDO_CMD bash -c "cat > $SERVICE_FILE" << SVCEOF
[Unit]
Description=GudangLingling AI — Sistem Pakar Peminjaman Alat
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$PYTHON_CMD $PROJECT_DIR/app.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

    $SUDO_CMD systemctl daemon-reload
    $SUDO_CMD systemctl enable gudanglingling
    $SUDO_CMD systemctl start  gudanglingling
    print_ok "Service 'gudanglingling' berhasil diaktifkan dan berjalan."
    print_ok "Perintah kontrol:"
    echo "    sudo systemctl status  gudanglingling"
    echo "    sudo systemctl restart gudanglingling"
    echo "    sudo systemctl stop    gudanglingling"
  fi
fi

# ---------------------------------------------------------------------------
echo ""
echo "${GREEN}${BOLD}=========================================="
echo "  Instalasi Selesai!"
echo "==========================================${RESET}"
echo ""
echo "Jalankan server:"
echo "  ${BOLD}cd $PROJECT_DIR && python3 run.py${RESET}"
echo "  atau: ${BOLD}./start.sh${RESET}"
echo ""
echo "Akses di browser: ${CYAN}${BOLD}http://127.0.0.1:$PORT_NUM${RESET}"
echo "PIN Default     : ${BOLD}2422031${RESET} (NIM Liana Sry Astuti)"
echo ""
echo "Perintah lain:"
echo "  python3 run.py test      — Jalankan 10 test case"
echo "  python3 run.py simulate  — Laporan simulasi 5 skenario akademik"
echo "  python3 run.py seed      — Reset & isi ulang database"
echo ""
