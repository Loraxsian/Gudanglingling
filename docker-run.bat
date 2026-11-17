@echo off
:: =============================================================================
::  GudangLingling AI — Docker Controller (Windows)
::  Pengembang: Liana Sry Astuti (NIM: 2422031) - ITEBA
:: =============================================================================
setlocal EnableDelayedExpansion
title GudangLingling AI — Docker Controller

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=up"

if /i "%ACTION%"=="up" goto do_up
if /i "%ACTION%"=="start" goto do_up
if /i "%ACTION%"=="down" goto do_down
if /i "%ACTION%"=="stop" goto do_down
if /i "%ACTION%"=="restart" goto do_restart
if /i "%ACTION%"=="logs" goto do_logs
if /i "%ACTION%"=="status" goto do_status
if /i "%ACTION%"=="ps" goto do_status
if /i "%ACTION%"=="build" goto do_build

echo Penggunaan: docker-run.bat [up ^| down ^| restart ^| logs ^| status ^| build]
exit /b 1

:do_up
echo [*] Menjalankan GudangLingling AI via Docker Compose...
docker compose up -d
echo [+] Container aktif dan berjalan di background!
echo     Akses di browser: http://127.0.0.1:8085
echo     PIN Akses       : 1234
exit /b 0

:do_down
echo [*] Menghentikan container...
docker compose down
echo [+] Container dihentikan.
exit /b 0

:do_restart
echo [*] Merestart container...
docker compose restart
echo [+] Container di-restart.
exit /b 0

:do_logs
docker compose logs -f
exit /b 0

:do_status
docker compose ps
exit /b 0

:do_build
docker compose build --no-cache
exit /b 0
