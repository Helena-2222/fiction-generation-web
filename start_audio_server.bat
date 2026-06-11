@echo off
REM ============================================================
REM  ????????????
REM  ??: ???????????? start_audio_server.bat
REM ============================================================

echo [1/3] Starting audio generation server on port 8001...
start "AudioServer" cmd /c "..\fiction_generation\Scripts\python.exe audio_server.py --port 8001"

echo [2/3] Waiting for server to start...
timeout /t 5 /nobreak >nul

echo [3/3] Starting Cloudflare Tunnel...
echo.
echo    ??????? cloudflared ??? *.trycloudflare.com ??
echo    ?????????? Render ? AUDIO_API_URL ????
echo.
cloudflared tunnel --url http://localhost:8001

pause
