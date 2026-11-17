@echo off
:: =============================================================================
::  GudangLingling AI — Windows Service Manager
::  Pengembang: Liana Sry Astuti (NIM: 2422031) - ITEBA
:: =============================================================================
setlocal EnableDelayedExpansion
title GudangLingling AI — Service Manager

set "PROJECT_DIR=%~dp0"
set "ACTION=%~1"

if "%ACTION%"=="" set "ACTION=status"

if /i "%ACTION%"=="start" goto do_start
if /i "%ACTION%"=="stop" goto do_stop
if /i "%ACTION%"=="restart" goto do_restart
if /i "%ACTION%"=="status" goto do_status
if /i "%ACTION%"=="autostart" goto do_autostart

echo Penggunaan: service.bat [start ^| stop ^| restart ^| status ^| autostart]
exit /b 1

:do_start
echo [*] Menjalankan GudangLingling AI di latar belakang...
wscript.exe "%PROJECT_DIR%scripts\run_background.vbs" "%PROJECT_DIR%app.py"
timeout /t 2 >nul
echo [+] GudangLingling AI telah aktif di background!
echo     Akses di browser: http://127.0.0.1:8085
echo     PIN Akses       : 1234
exit /b 0

:do_stop
echo [*] Menghentikan service GudangLingling AI...
taskkill /F /FI "WINDOWTITLE eq GudangLingling*" >nul 2>&1
wmic process where "commandline like '%%app.py%%'" delete >nul 2>&1
echo [+] Service berhasil dihentikan.
exit /b 0

:do_restart
call :do_stop
timeout /t 1 >nul
call :do_start
exit /b 0

:do_status
echo ==================================================
echo   STATUS GUDANGLINGLING AI (WINDOWS)
echo ==================================================
netstat -ano | findstr :8085 >nul 2>&1
if !errorlevel! == 0 (
    echo   Status    : BERJALAN (Port 8085 Aktif)
    echo   Akses Web : http://127.0.0.1:8085
    echo   PIN Akses : 1234
) else (
    echo   Status    : MATI (STOPPED)
    echo   Akses     : Jalankan 'service.bat start'
)
echo ==================================================
exit /b 0

:do_autostart
echo [*] Mendaftarkan ke Windows Task Scheduler (Auto-start saat login)...
schtasks /create /tn "GudangLingling_Service" /tr "\"%PROJECT_DIR%service.bat\" start" /sc ONLOGON /ru "%USERNAME%" /rl HIGHEST /f >nul 2>&1
if !errorlevel! == 0 (
    echo [+] Berhasil didaftarkan ke Task Scheduler!
    echo     Aplikasi akan otomatis menyala di background setiap komputer dihidupkan.
) else (
    echo [!] Gagal mendaftarkan. Coba jalankan Command Prompt sebagai Administrator.
)
exit /b 0
