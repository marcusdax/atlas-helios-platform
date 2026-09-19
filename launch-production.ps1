# Atlas Helios Platform - Production Launch Script
# Launches all services: Nexus Bridge, Backend, and Frontend
# =============================================================================

param(
    [switch]$SkipNexus,
    [switch]$SkipFrontend,
    [int]$NexusPort = 5051,
    [int]$BackendPort = 5000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Atlas Helios Platform - Production Launch"

# Colors
function Write-Color($Color, $Text) {
    Write-Host $Text -ForegroundColor $Color
}

function Write-Section($Title) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Port($Port) {
    $result = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $result -ne $null
}

function Wait-ForService($Url, $Name, $MaxAttempts = 30) {
    Write-Host "  Waiting for $Name to be ready..." -NoNewline -ForegroundColor Yellow
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-RestMethod -Uri $Url -TimeoutSec 2 -ErrorAction Stop
            Write-Host " OK!" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "." -NoNewline -ForegroundColor Gray
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Host " TIMEOUT!" -ForegroundColor Red
    return $false
}

# Clear Screen
Clear-Host

Write-Section "Atlas Helios Platform - Production Launch"
Write-Color Yellow "  Starting all services..."
Write-Color Gray "  Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Change to project directory
$ProjectDir = "F:\Atlas Helios\atlas-helios-platform\atlas-helios-platform"
Set-Location $ProjectDir

# =============================================================================
# Check Prerequisites
# =============================================================================
Write-Section "Checking Prerequisites"

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Color Green "  ✓ Node.js: $nodeVersion"
} catch {
    Write-Color Red "  ✗ Node.js not found! Please install Node.js 16+"
    exit 1
}

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Color Green "  ✓ Python: $pythonVersion"
} catch {
    Write-Color Yellow "  ⚠ Python not found - Nexus Bridge will be skipped"
    $SkipNexus = $true
}

# Check ports
Write-Host ""
Write-Color Yellow "  Checking ports..."
$portsInUse = @()
if (Test-Port $NexusPort) { $portsInUse += "Nexus Bridge ($NexusPort)" }
if (Test-Port $BackendPort) { $portsInUse += "Backend ($BackendPort)" }
if (Test-Port $FrontendPort) { $portsInUse += "Frontend ($FrontendPort)" }

if ($portsInUse.Count -gt 0) {
    Write-Color Red "  ✗ Some ports are already in use:"
    $portsInUse | ForEach-Object { Write-Color Red "    - $_" }
    Write-Host ""
    Write-Color Yellow "  Attempting to use alternative ports..."
    
    if (Test-Port $BackendPort) { $BackendPort = 5001 }
    if (Test-Port $BackendPort) { $BackendPort = 5002 }
    if (Test-Port $FrontendPort) { $FrontendPort = 3001 }
    
    Write-Color Cyan "  New ports: Nexus=$NexusPort, Backend=$BackendPort, Frontend=$FrontendPort"
}

# =============================================================================
# Start Nexus Bridge Service
# =============================================================================
$NexusJob = $null
if (-not $SkipNexus) {
    Write-Section "Starting Nexus Bridge Service"
    Write-Color Gray "  Port: $NexusPort"
    Write-Color Gray "  Mode: Mock (for production testing)"
    Write-Host ""
    
    $NexusJob = Start-Job -ScriptBlock {
        param($Port, $Dir)
        Set-Location "$Dir\nexus-bridge"
        python mock_nexus_bridge.py --port $Port
    } -ArgumentList $NexusPort, $ProjectDir
    
    # Wait for Nexus Bridge
    $nexusReady = Wait-ForService "http://localhost:$NexusPort/health" "Nexus Bridge"
    
    if ($nexusReady) {
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$NexusPort/health" -TimeoutSec 5
            Write-Color Green "  ✓ Nexus Bridge Ready"
            Write-Color Gray "    - Status: $($health.status)"
            Write-Color Gray "    - Mode: $($health.mode)"
            Write-Color Gray "    - Nexus Mind: $($health.nexus_available)"
            Write-Color Gray "    - Perception: $($health.perception_available)"
        } catch {
            Write-Color Yellow "  ⚠ Could not get Nexus Bridge details"
        }
    } else {
        Write-Color Yellow "  ⚠ Nexus Bridge failed to start - continuing without it"
    }
} else {
    Write-Section "Skipping Nexus Bridge"
}

# =============================================================================
# Start Backend
# =============================================================================
Write-Section "Starting Backend Server"
Write-Color Gray "  Port: $BackendPort"
Write-Host ""

$env:PORT = $BackendPort
$env:NEXUS_BRIDGE_URL = "http://localhost:$NexusPort"
$env:ENABLE_NEXUS_COGNITIVE = "true"
$env:ENABLE_NOAA_WEATHER = "true"

$BackendJob = Start-Job -ScriptBlock {
    param($Port, $Dir)
    $env:PORT = $Port
    Set-Location "$Dir\backend"
    npm start
} -ArgumentList $BackendPort, $ProjectDir

# Wait for Backend
$backendReady = Wait-ForService "http://localhost:$BackendPort/health" "Backend"

if ($backendReady) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$BackendPort/health" -TimeoutSec 5
        Write-Color Green "  ✓ Backend Ready"
        Write-Color Gray "    - Status: $($health.status)"
        Write-Color Gray "    - Version: $($health.version)"
        if ($health.integrations.nexus_mind) {
            Write-Color Gray "    - Nexus Mind: $($health.integrations.nexus_mind.initialized)"
        }
        if ($health.integrations.noaa_weather) {
            Write-Color Gray "    - NOAA Weather: $($health.integrations.noaa_weather.initialized)"
        }
    } catch {
        Write-Color Yellow "  ⚠ Could not get Backend details"
    }
} else {
    Write-Color Red "  ✗ Backend failed to start"
    exit 1
}

# =============================================================================
# Start Frontend
# =============================================================================
$FrontendJob = $null
if (-not $SkipFrontend) {
    Write-Section "Starting Frontend"
    Write-Color Gray "  Port: $FrontendPort"
    Write-Host ""
    
    # Create/update .env.local for frontend
    $envLocalPath = "$ProjectDir\frontend\.env.local"
    @"
REACT_APP_API_URL=http://localhost:$BackendPort/api
REACT_APP_WS_URL=ws://localhost:$BackendPort
PORT=$FrontendPort
"@ | Set-Content $envLocalPath -Force
    
    $FrontendJob = Start-Job -ScriptBlock {
        param($Port, $Dir)
        $env:PORT = $Port
        Set-Location "$Dir\frontend"
        npm start
    } -ArgumentList $FrontendPort, $ProjectDir
    
    # Wait for Frontend
    Write-Host "  Waiting for Frontend to compile..." -NoNewline -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    $frontendReady = $false
    for ($i = 1; $i -le 60; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host " OK!" -ForegroundColor Green
                $frontendReady = $true
                break
            }
        } catch {
            Write-Host "." -NoNewline -ForegroundColor Gray
            Start-Sleep -Milliseconds 1000
        }
    }
    
    if ($frontendReady) {
        Write-Color Green "  ✓ Frontend Ready"
    } else {
        Write-Color Yellow "  ⚠ Frontend still compiling... it should be ready soon"
    }
} else {
    Write-Section "Skipping Frontend"
}

# =============================================================================
# System Summary
# =============================================================================
Write-Section "System Status"

Write-Color Green "  ✓ All Systems Launched Successfully!"
Write-Host ""

Write-Color Cyan "  Service Endpoints:"
Write-Color White "    ────────────────────────────────────────────────────────────"
if (-not $SkipNexus -and $nexusReady) {
    Write-Color Gray "    Nexus Bridge:   http://localhost:$NexusPort"
}
Write-Color Gray "    Backend API:    http://localhost:$BackendPort"
Write-Color Gray "    Health Check:   http://localhost:$BackendPort/health"
Write-Color Gray "    API Docs:       http://localhost:$BackendPort/api"
if (-not $SkipFrontend) {
    Write-Color Gray "    Frontend:       http://localhost:$FrontendPort"
}
Write-Color White "    ────────────────────────────────────────────────────────────"

Write-Host ""
Write-Color Cyan "  Available APIs:"
Write-Color Gray "    • /api/auth/*           - Authentication"
Write-Color Gray "    • /api/storms/*         - Storm Intelligence"
Write-Color Gray "    • /api/properties/*     - Property Management"
Write-Color Gray "    • /api/assessments/*    - Damage Assessments"
Write-Color Gray "    • /api/leads/*          - Lead Management"
Write-Color Gray "    • /api/estimates/*      - Cost Estimates"
Write-Color Gray "    • /api/nexus/*          - Nexus Mind AI"
Write-Color Gray "    • /api/weather/*        - NOAA Weather"

Write-Host ""
Write-Color Cyan "  Quick Test Commands:"
Write-Color Gray "    curl http://localhost:$BackendPort/health"
Write-Color Gray "    curl http://localhost:$BackendPort/api/weather/status"
Write-Color Gray "    curl http://localhost:$BackendPort/api/nexus/status"

Write-Host ""
Write-Color Yellow "  Press Ctrl+C to stop all services"
Write-Host ""

# =============================================================================
# Monitor Services
# =============================================================================
Write-Section "Monitoring Services"

$running = $true
$stats = @{
    Nexus = 0
    Backend = 0
    Frontend = 0
}

while ($running) {
    Start-Sleep -Seconds 2
    
    # Check Nexus Bridge
    if ($NexusJob) {
        $nexusState = $NexusJob | Get-Job
        if ($nexusState.State -eq 'Failed') {
            if ($stats.Nexus -eq 0) {
                Write-Color Red "  ✗ Nexus Bridge has stopped!"
                $stats.Nexus = 1
            }
        }
    }
    
    # Check Backend
    if ($BackendJob) {
        $backendState = $BackendJob | Get-Job
        if ($backendState.State -eq 'Failed') {
            if ($stats.Backend -eq 0) {
                Write-Color Red "  ✗ Backend has stopped!"
                $stats.Backend = 1
            }
        }
    }
    
    # Check Frontend
    if ($FrontendJob) {
        $frontendState = $FrontendJob | Get-Job
        if ($frontendState.State -eq 'Failed') {
            if ($stats.Frontend -eq 0) {
                Write-Color Red "  ✗ Frontend has stopped!"
                $stats.Frontend = 1
            }
        }
    }
    
    # Check if user pressed Ctrl+C (handled by PowerShell)
}
