#!/usr/bin/env bash
# =============================================================================
#  GudangLingling AI — Service Manager (Linux / macOS)
#  Pengembang: Liana Sry Astuti (NIM: 2422031) - ITEBA
# =============================================================================
#  Perintah:
#    ./service.sh start            -> Jalankan di background (Daemon)
#    ./service.sh stop             -> Hentikan background service
#    ./service.sh restart          -> Mulai ulang service
#    ./service.sh status           -> Cek status service & port
#    ./service.sh install-systemd  -> Daftarkan ke systemd (Auto-start saat boot)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/server.pid"
LOG_FILE="$PROJECT_DIR/server.log"
PORT=8085

detect_python() {
  for cmd in python3 python3.12 python3.11 python3.10 python; do
    if command -v "$cmd" &>/dev/null; then
      echo "$cmd"
      return 0
    fi
  done
  echo "python3"
}

PYTHON_CMD=$(detect_python)

is_running() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

start_service() {
  if is_running; then
    echo "[!] GudangLingling AI sudah berjalan (PID: $(cat "$PID_FILE"))."
    echo "    Akses: http://127.0.0.1:$PORT"
    return 0
  fi

  echo "[*] Menjalankan GudangLingling AI sebagai background service..."
  cd "$PROJECT_DIR"
  nohup $PYTHON_CMD app.py > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo $SERVER_PID > "$PID_FILE"
  sleep 1.2

  if is_running; then
    echo "[+] Service BERHASIL berjalan di latar belakang!"
    echo "    PID         : $SERVER_PID"
    echo "    Akses Web   : http://127.0.0.1:$PORT"
    echo "    PIN Akses   : 1234"
    echo "    Log File    : $LOG_FILE"
  else
    echo "[x] Gagal menjalankan service. Periksa log:"
    cat "$LOG_FILE" | tail -10
    rm -f "$PID_FILE"
    exit 1
  fi
}

stop_service() {
  if is_running; then
    PID=$(cat "$PID_FILE")
    echo "[*] Menghentikan service (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    sleep 1
    if ps -p "$PID" > /dev/null 2>&1; then
      kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    echo "[+] Service berhasil dihentikan."
  else
    echo "[!] Service sedang tidak berjalan."
    rm -f "$PID_FILE"
  fi
}

status_service() {
  echo "=================================================="
  echo "  STATUS GUDANGLINGLING AI SERVICE"
  echo "=================================================="
  if is_running; then
    PID=$(cat "$PID_FILE")
    echo "  Status    : BERJALAN (RUNNING)"
    echo "  PID       : $PID"
    echo "  Akses Web : http://127.0.0.1:$PORT"
    echo "  PIN Akses : 1234"
    echo "  Log File  : $LOG_FILE"
  else
    echo "  Status    : MATI (STOPPED)"
    echo "  Akses     : Service belum dijalankan."
  fi
  echo "=================================================="
}

install_systemd() {
  CURRENT_USER=$(whoami)
  SERVICE_FILE="/etc/systemd/system/gudanglingling.service"

  echo "[*] Menyiapkan service systemd..."
  if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
  else
    SUDO=""
  fi

  $SUDO bash -c "cat > $SERVICE_FILE" << EOF
[Unit]
Description=GudangLingling AI Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$PYTHON_CMD $PROJECT_DIR/app.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  $SUDO systemctl daemon-reload
  $SUDO systemctl enable gudanglingling
  $SUDO systemctl restart gudanglingling
  echo "[+] systemd service 'gudanglingling' berhasil dipasang dan diaktifkan!"
  echo "    Status: sudo systemctl status gudanglingling"
}

case "$1" in
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    sleep 1
    start_service
    ;;
  status)
    status_service
    ;;
  install-systemd)
    install_systemd
    ;;
  *)
    echo "Penggunaan: $0 {start|stop|restart|status|install-systemd}"
    exit 1
    ;;
esac
