@echo off
REM ============================================================
REM  Audio Generation Server Launcher
REM  Usage: start_audio_server.bat
REM ============================================================

echo [1/3] Starting audio generation server on port 8001...
start "AudioServer" cmd /c "E:\fiction_generation\fiction_generation\python.exe audio_server.py --port 8001"

echo [2/3] Waiting for server to start...
timeout /t 5 /nobreak >nul

echo [3/3] Starting Cloudflare Tunnel...
echo.
echo    You need cloudflared to expose this server to the internet.
echo    Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
echo    Or install via: winget install Cloudflare.cloudflared
echo.

where cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] cloudflared not found! Please install it first:
    echo        winget install Cloudflare.cloudflared
    echo.
    echo The audio server is running at http://localhost:8001
    echo Set AUDIO_API_URL=http://localhost:8001 for local testing.
    echo.
    pause
    exit /b 1
)

echo    Creating *.trycloudflare.com tunnel...
echo    Copy the URL and set it as AUDIO_API_URL on Render.
echo.
cloudflared tunnel --url http://localhost:8001

pause