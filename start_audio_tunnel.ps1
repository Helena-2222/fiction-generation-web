# start_audio_tunnel.ps1
# Starts audio server + creates public tunnel for Render deployment
# Tries: serveo.net (SSH) -> localhost.run -> cloudflared

$ErrorActionPreference = "Continue"
$venvPython = "E:\fiction_generation\fiction_generation\python.exe"
$projectDir = "E:\fiction_generation\fiction-generation-web"

function Start-AudioServer {
    Write-Host "[*] Starting audio server on port 8001..." -ForegroundColor Yellow
    $script:audioJob = Start-Job -Name "AudioServer" -ScriptBlock {
        param($python, $dir)
        Set-Location $dir
        & $python audio_server.py --port 8001 2>&1 | Out-File "$dir\audio_server.log"
    } -ArgumentList $venvPython, $projectDir
    Start-Sleep -Seconds 6
    
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 10
        Write-Host "  [OK] Audio server: $($health.status) | $($health.device)" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  [WARN] Health check failed, server may still be loading..." -ForegroundColor Yellow
        return $true
    }
}

function Stop-AudioServer {
    Write-Host "`n[*] Stopping audio server..." -ForegroundColor Yellow
    Stop-Job -Name "AudioServer" -ErrorAction SilentlyContinue
    Remove-Job -Name "AudioServer" -ErrorAction SilentlyContinue
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Audio Server + Tunnel Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start server
if (-not (Start-AudioServer)) { 
    Write-Host "Failed to start audio server" -ForegroundColor Red
    pause; exit 1 
}

Write-Host ""

# Try tunnel methods in order
$tunnelStarted = $false

# Method 1: serveo.net (free SSH tunnel, no registration)
Write-Host "[*] Trying serveo.net (free SSH tunnel)..." -ForegroundColor Yellow
$subdomain = "fiction-audio-" + (Get-Random -Minimum 1000 -Maximum 9999)
Write-Host "  Command: ssh -R ${subdomain}:80:localhost:8001 serveo.net" -ForegroundColor Gray
Write-Host "  If it works, your URL will be: https://${subdomain}.serveo.net" -ForegroundColor White
Write-Host "  Press Ctrl+C to stop when done." -ForegroundColor White
Write-Host ""

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ConnectTimeout=10 -R "${subdomain}:80:localhost:8001" serveo.net 2>&1
if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) { $tunnelStarted = $true }

# Method 2: localhost.run (free SSH tunnel, no registration)
if (-not $tunnelStarted) {
    Write-Host "[*] serveo failed, trying localhost.run..." -ForegroundColor Yellow
    Write-Host "  Your URL will appear in the output (look for 'https://....lhr.life')" -ForegroundColor White
    Write-Host ""
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ConnectTimeout=10 -R "80:localhost:8001" nokey@localhost.run 2>&1
    if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) { $tunnelStarted = $true }
}

# Method 3: Download and use cloudflared
if (-not $tunnelStarted) {
    Write-Host "[*] SSH tunnels failed. Trying cloudflared..." -ForegroundColor Yellow
    
    $cloudflaredPath = "$env:TEMP\cloudflared.exe"
    if (-not (Test-Path $cloudflaredPath)) {
        Write-Host "  Downloading cloudflared..." -ForegroundColor Gray
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflaredPath
    }
    
    Write-Host "  Starting cloudflared tunnel..." -ForegroundColor Gray
    Write-Host "  Your URL will appear as https://*.trycloudflare.com" -ForegroundColor White
    Write-Host ""
    & $cloudflaredPath tunnel --url http://localhost:8001
}

# Cleanup
Stop-AudioServer
Write-Host "Done." -ForegroundColor Green
pause