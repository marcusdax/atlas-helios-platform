# Atlas Helios Platform - Integrated System Startup
# Powered by Nexus Mind AI + Perception Models
# =============================================================

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Output ""
Write-ColorOutput Green "============================================================="
Write-ColorOutput Green "  Atlas Helios Platform - Integrated System Startup"
Write-ColorOutput Green "  Powered by Nexus Mind AI + Perception Models"
Write-ColorOutput Green "============================================================="
Write-Output ""

# Configuration
$NexusBridgePort = 5051
$BackendPort = 5000
$FrontendPort = 3000
$BridgePath = "nexus-bridge\nexus_bridge_service.py"
$BackendPath = "backend\server.js"
$FrontendPath = "frontend"

# Check Python availability
Write-ColorOutput Yellow "[1/5] Checking Python environment..."
try {
    $pythonVersion = python --version 2>&1
    Write-ColorOutput Green "  Python found: $pythonVersion"
} catch {
    Write-ColorOutput Red "  Python not found! Please install Python 3.8+"
    exit 1
}

# Check Node.js availability
Write-ColorOutput Yellow "[2/5] Checking Node.js environment..."
try {
    $nodeVersion = node --version
    Write-ColorOutput Green "  Node.js found: $nodeVersion"
} catch {
    Write-ColorOutput Red "  Node.js not found! Please install Node.js 16+"
    exit 1
}

# Check external modules
Write-ColorOutput Yellow "[3/5] Checking external module paths..."
$externalModules = @(
    "G:\nexus-mind-ai",
    "G:\perception_models",
    "G:\perception_models_shared"
)

foreach ($module in $externalModules) {
    if (Test-Path $module) {
        Write-ColorOutput Green "  Found: $module"
    } else {
        Write-ColorOutput Red "  Missing: $module"
    }
}

# Start Nexus Bridge Service
Write-ColorOutput Yellow "[4/5] Starting Nexus Bridge Service on port $NexusBridgePort..."
$bridgeJob = Start-Job -ScriptBlock {
    param($path, $port)
    Set-Location $using:PWD
    python $path --port $port
} -ArgumentList $BridgePath, $NexusBridgePort

# Wait for bridge to start
Start-Sleep -Seconds 3

# Check if bridge is running
try {
    $response = Invoke-RestMethod -Uri "http://localhost:$NexusBridgePort/health" -TimeoutSec 5
    Write-ColorOutput Green "  Nexus Bridge Service is running!"
    Write-ColorOutput Gray "  Status: $($response.status)"
    Write-ColorOutput Gray "  Nexus Mind: $($response.nexus_available)"
    Write-ColorOutput Gray "  Perception Encoder: $($response.perception_available)"
} catch {
    Write-ColorOutput Red "  Warning: Could not connect to Nexus Bridge Service"
    Write-ColorOutput Gray "  Error: $_"
}

# Start Backend
Write-ColorOutput Yellow "[5/5] Starting Atlas Helios Backend on port $BackendPort..."
$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location "$using:PWD\backend"
    node $path
} -ArgumentList "server.js"

# Wait for backend to start
Start-Sleep -Seconds 3

# Check if backend is running
try {
    $response = Invoke-RestMethod -Uri "http://localhost:$BackendPort/health" -TimeoutSec 5
    Write-ColorOutput Green "  Atlas Helios Backend is running!"
    Write-ColorOutput Gray "  Status: $($response.status)"
    if ($response.integrations.nexus_mind) {
        Write-ColorOutput Gray "  Nexus Mind Integration: $($response.integrations.nexus_mind.initialized)"
    }
} catch {
    Write-ColorOutput Red "  Warning: Could not connect to Backend"
}

Write-Output ""
Write-ColorOutput Green "============================================================="
Write-ColorOutput Green "  All Services Started!"
Write-ColorOutput Green "============================================================="
Write-Output ""
Write-Output "  Service Endpoints:"
Write-Output "    - Nexus Bridge:   http://localhost:$NexusBridgePort"
Write-Output "    - Backend API:    http://localhost:$BackendPort"
Write-Output "    - Health Check:   http://localhost:$BackendPort/health"
Write-Output ""
Write-Output "  API Documentation:"
Write-Output "    - Nexus Status:   GET  /api/nexus/status"
Write-Output "    - Storm Analyze:  POST /api/nexus/storm/analyze"
Write-Output "    - Property:       POST /api/nexus/property/analyze"
Write-Output "    - Vision:         POST /api/nexus/vision/classify"
Write-Output ""
Write-ColorOutput Yellow "  Press Ctrl+C to stop all services"
Write-Output ""

# Keep script running
while ($true) {
    Start-Sleep -Seconds 1
    
    # Check job status
    $bridgeStatus = $bridgeJob | Get-Job
    $backendStatus = $backendJob | Get-Job
    
    if ($bridgeStatus.State -eq 'Failed') {
        Write-ColorOutput Red "Nexus Bridge Service failed!"
        Receive-Job $bridgeJob
    }
    
    if ($backendStatus.State -eq 'Failed') {
        Write-ColorOutput Red "Backend Service failed!"
        Receive-Job $backendJob
    }
}
