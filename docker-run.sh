#!/usr/bin/env bash
# =============================================================================
#  GudangLingling AI — Docker Service Controller (Linux / macOS)
#  Pengembang: Liana Sry Astuti (NIM: 2422031) - ITEBA
# =============================================================================
#  Penggunaan:
#    ./docker-run.sh up       -> Jalankan container di latar belakang
#    ./docker-run.sh down     -> Hentikan container
#    ./docker-run.sh restart  -> Mulai ulang container
#    ./docker-run.sh logs     -> Lihat log real-time aplikasi
#    ./docker-run.sh status   -> Cek status container & healthcheck
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

case "$1" in
  up|start)
    echo "[*] Menjalankan GudangLingling AI via Docker Compose..."
    docker compose up -d
    echo "[+] Container aktif!"
    echo "    Akses Web: http://127.0.0.1:8085"
    echo "    PIN Akses: 1234"
    ;;
  down|stop)
    echo "[*] Menghentikan container..."
    docker compose down
    echo "[+] Container berhasil dihentikan."
    ;;
  restart)
    echo "[*] Merestart container..."
    docker compose restart
    echo "[+] Container berhasil di-restart."
    ;;
  logs)
    docker compose logs -f
    ;;
  status|ps)
    docker compose ps
    ;;
  build)
    echo "[*] Membangun ulang image Docker..."
    docker compose build --no-cache
    echo "[+] Selesai."
    ;;
  *)
    echo "Penggunaan: $0 {up|down|restart|logs|status|build}"
    exit 1
    ;;
esac
