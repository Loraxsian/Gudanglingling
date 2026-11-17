@echo off
:: =============================================================================
::  GudangLingling AI — Installer Windows
::  Pengembang: Liana Sry Astuti (NIM: 2422031) — Teknik Komputer ITEBA
:: =============================================================================
setlocal EnableDelayedExpansion
title GudangLingling AI — Installer

echo.
echo ==========================================
echo   GudangLingling AI -- Installer Windows
echo ==========================================
echo.

set "PROJECT_DIR=%~dp0"
set "PYTHON_CMD="

:: ---------------------------------------------------------------------------
:: 1. Deteksi Python
:: ---------------------------------------------------------------------------
echo [*] Memeriksa Python 3.8+...

for %%C in (python python3 py) do (
    if "!PYTHON_CMD!"=="" (
        where %%C >nul 2>&1
        if !errorlevel! == 0 (
            for /f "delims=" %%V in ('%%C -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')" 2^>nul') do (
                set "VER=%%V"
            )
            for /f "tokens=1 delims=." %%M in ("!VER!") do set "MAJOR=%%M"
            if !MAJOR! GEQ 3 (
                set "PYTHON_CMD=%%C"
            )
        )
    )
)

if "!PYTHON_CMD!"=="" (
    echo [x] Python 3.8+ tidak ditemukan!
    echo.
    echo     Unduh Python dari: https://www.python.org/downloads/
    echo     Pastikan "Add Python to PATH" dicentang saat instalasi.
    echo.
    pause
    exit /b 1
)

echo [+] Python ditemukan: !PYTHON_CMD! ^(versi !VER!^)

:: ---------------------------------------------------------------------------
:: 2. Cek stdlib
:: ---------------------------------------------------------------------------
echo [*] Memeriksa dependensi Python...
!PYTHON_CMD! -c "import http.server, json, sqlite3, urllib.parse, threading, pathlib; print('OK')" >nul 2>&1
if !errorlevel! NEQ 0 (
    echo [x] Modul stdlib tidak lengkap. Pastikan Python terinstal dengan benar.
    pause
    exit /b 1
)
echo [+] Semua modul stdlib tersedia. Tidak perlu pip install.

:: ---------------------------------------------------------------------------
:: 3. Inisialisasi database
:: ---------------------------------------------------------------------------
echo [*] Menginisialisasi database SQLite...
cd /d "%PROJECT_DIR%"
!PYTHON_CMD! run.py seed
if !errorlevel! NEQ 0 (
    echo [x] Gagal menginisialisasi database.
    pause
    exit /b 1
)
echo [+] Database berhasil disiapkan.

:: ---------------------------------------------------------------------------
:: 4. Buat start.bat
:: ---------------------------------------------------------------------------
echo [*] Membuat start.bat...
(
    echo @echo off
    echo title GudangLingling AI
    echo cd /d "%%~dp0"
    echo echo.
    echo echo  GudangLingling AI - Berjalan di http://127.0.0.1:8085
    echo echo  PIN Default: 2422031
    echo echo  Tekan Ctrl+C untuk menghentikan server.
    echo echo.
    echo !PYTHON_CMD! app.py
    echo pause
) > "%PROJECT_DIR%start.bat"
echo [+] start.bat dibuat.

:: ---------------------------------------------------------------------------
:: 5. Buat shortcut di Desktop (opsional)
:: ---------------------------------------------------------------------------
set /p CREATE_SHORTCUT="Buat shortcut di Desktop? [Y/n]: "
if /i "!CREATE_SHORTCUT!" NEQ "n" (
    set "SHORTCUT_PATH=%USERPROFILE%\Desktop\GudangLingling AI.lnk"
    set "VBSCRIPT_PATH=%TEMP%\create_shortcut.vbs"

    echo Set oWS = WScript.CreateObject("WScript.Shell") > "!VBSCRIPT_PATH!"
    echo sLinkFile = "!SHORTCUT_PATH!" >> "!VBSCRIPT_PATH!"
    echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "!VBSCRIPT_PATH!"
    echo oLink.TargetPath = "%PROJECT_DIR%start.bat" >> "!VBSCRIPT_PATH!"
    echo oLink.WorkingDirectory = "%PROJECT_DIR%" >> "!VBSCRIPT_PATH!"
    echo oLink.Description = "GudangLingling AI - Sistem Pakar Peminjaman Alat" >> "!VBSCRIPT_PATH!"
    echo oLink.Save >> "!VBSCRIPT_PATH!"

    cscript //nologo "!VBSCRIPT_PATH!" >nul 2>&1
    del "!VBSCRIPT_PATH!" >nul 2>&1

    if exist "!SHORTCUT_PATH!" (
        echo [+] Shortcut berhasil dibuat di Desktop.
    ) else (
        echo [!] Gagal membuat shortcut ^(tidak masalah, gunakan start.bat secara langsung^).
    )
)

:: ---------------------------------------------------------------------------
:: 6. Daftarkan Task Scheduler (auto-start, opsional)
:: ---------------------------------------------------------------------------
echo.
set /p REGISTER_TASK="Daftarkan ke Windows Task Scheduler agar otomatis jalan saat login? [y/N]: "
if /i "!REGISTER_TASK!"=="y" (
    schtasks /create ^
        /tn "GudangLingling AI" ^
        /tr "\"%PROJECT_DIR%start.bat\"" ^
        /sc ONLOGON ^
        /ru "%USERNAME%" ^
        /rl HIGHEST ^
        /f >nul 2>&1

    if !errorlevel! == 0 (
        echo [+] Task Scheduler berhasil. Aplikasi akan otomatis jalan saat login.
        echo     Untuk menghapus: schtasks /delete /tn "GudangLingling AI" /f
    ) else (
        echo [!] Gagal mendaftarkan Task Scheduler. Jalankan install.bat sebagai Administrator jika perlu.
    )
)

:: ---------------------------------------------------------------------------
:: Selesai
:: ---------------------------------------------------------------------------
echo.
echo ==========================================
echo   Instalasi Selesai!
echo ==========================================
echo.
echo Jalankan server  : klik dua kali start.bat
echo Akses di browser : http://127.0.0.1:8085
echo PIN Default      : 2422031 (NIM Liana Sry Astuti)
echo.
echo Perintah manual (Command Prompt):
echo   cd "%PROJECT_DIR%"
echo   python run.py          -- Jalankan server
echo   python run.py test     -- Jalankan 10 test case
echo   python run.py simulate -- Laporan simulasi akademik
echo.

set /p OPEN_BROWSER="Buka browser ke http://127.0.0.1:8085 sekarang? [Y/n]: "
if /i "!OPEN_BROWSER!" NEQ "n" (
    start "" !PYTHON_CMD! app.py
    timeout /t 2 >nul
    start "" "http://127.0.0.1:8085"
)

endlocal
pause
