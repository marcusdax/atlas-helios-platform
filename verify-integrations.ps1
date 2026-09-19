# Atlas Helios Platform - Integration Verification Script
# Tests all connections between Atlas Helios, Nexus Mind AI, and Perception Models
# =================================================================================

param(
    [string]$NexusBridgeUrl = "http://localhost:5051",
    [string]$BackendUrl = "http://localhost:5000"
)

$ErrorActionPreference = "Continue"
$VerbosePreference = "Continue"

# Test results
$testResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Tests = @()
}

function Write-Section($title) {
    Write-Output ""
    Write-Output "================================================================="
    Write-Output "  $title"
    Write-Output "================================================================="
    Write-Output ""
}

function Write-Test($name, $status, $details = "") {
    $testResults.Total++
    $symbol = if ($status -eq "PASS") { " " } else { "X" }
    $color = if ($status -eq "PASS") { "Green" } else { "Red" }
    
    if ($status -eq "PASS") {
        $testResults.Passed++
    } else {
        $testResults.Failed++
    }
    
    $testResults.Tests += @{
        Name = $name
        Status = $status
        Details = $details
    }
    
    Write-Host "  [$symbol] $name" -ForegroundColor $color
    if ($details) {
        Write-Host "      $details" -ForegroundColor Gray
    }
}

# ================================
# Test 1: External Module Paths
# ================================
Write-Section "Test 1: External Module Paths"

$modulePaths = @{
    "Nexus Mind AI" = "G:\nexus-mind-ai"
    "Perception Models" = "G:\perception_models"
    "Perception Models Shared" = "G:\perception_models_shared"
}

foreach ($module in $modulePaths.GetEnumerator()) {
    $exists = Test-Path $module.Value
    Write-Test "$($module.Key) Path" $(if ($exists) { "PASS" } else { "FAIL" }) $module.Value
}

# Check key files in each module
$keyFiles = @(
    @{ Path = "G:\nexus-mind-ai\nexus_mind\helios_integration.py"; Desc = "Nexus Helios Integration" },
    @{ Path = "G:\nexus-mind-ai\nexus_mind\perception_integration.py"; Desc = "Nexus Perception Integration" },
    @{ Path = "G:\perception_models\core\__init__.py"; Desc = "Perception Core Module" },
    @{ Path = "G:\perception_models_shared\__init__.py"; Desc = "Perception Shared Module" }
)

foreach ($file in $keyFiles) {
    $exists = Test-Path $file.Path
    Write-Test $file.Desc $(if ($exists) { "PASS" } else { "FAIL" }) $file.Path
}

# ================================
# Test 2: Nexus Bridge Service
# ================================
Write-Section "Test 2: Nexus Bridge Service"

try {
    $response = Invoke-RestMethod -Uri "$NexusBridgeUrl/health" -TimeoutSec 5
    Write-Test "Bridge Health Endpoint" "PASS" "Status: $($response.status)"
    
    Write-Test "Nexus Mind Available" $(if ($response.nexus_available) { "PASS" } else { "FAIL" }) "Nexus Mind: $($response.nexus_available)"
    Write-Test "Perception Available" $(if ($response.perception_available) { "PASS" } else { "FAIL" }) "Perception: $($response.perception_available)"
    Write-Test "Bridge Initialized" $(if ($response.initialized) { "PASS" } else { "WARN" }) "Initialized: $($response.initialized)"
} catch {
    Write-Test "Bridge Health Endpoint" "FAIL" $_.Exception.Message
    Write-Test "Nexus Mind Available" "FAIL" "Bridge not accessible"
    Write-Test "Perception Available" "FAIL" "Bridge not accessible"
}

# Test Bridge Config
Write-Output ""
Write-Output "  Bridge Configuration:"
try {
    $config = Invoke-RestMethod -Uri "$NexusBridgeUrl/config" -TimeoutSec 5
    Write-Output "    - Nexus Path: $($config.nexus_path)"
    Write-Output "    - Perception Path: $($config.perception_path)"
    Write-Output "    - Shared Path: $($config.perception_shared_path)"
    Write-Output "    - Endpoints: $($config.endpoints.Count) available"
} catch {
    Write-Output "    Could not retrieve configuration: $_"
}

# ================================
# Test 3: Atlas Helios Backend
# ================================
Write-Section "Test 3: Atlas Helios Backend"

try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/health" -TimeoutSec 5
    Write-Test "Backend Health Endpoint" "PASS" "Status: $($response.status)"
    
    if ($response.integrations.nexus_mind) {
        $nexusStatus = $response.integrations.nexus_mind
        Write-Test "Backend-Nexus Integration" $(if ($nexusStatus.initialized) { "PASS" } else { "WARN" }) "Initialized: $($nexusStatus.initialized)"
        Write-Test "Nexus Component" $(if ($nexusStatus.nexus_available) { "PASS" } else { "WARN" }) "Available: $($nexusStatus.nexus_available)"
        Write-Test "Perception Component" $(if ($nexusStatus.perception_available) { "PASS" } else { "WARN" }) "Available: $($nexusStatus.perception_available)"
    } else {
        Write-Test "Backend-Nexus Integration" "WARN" "Integration status not in response"
    }
} catch {
    Write-Test "Backend Health Endpoint" "FAIL" $_.Exception.Message
}

# ================================
# Test 4: Nexus Mind API Routes
# ================================
Write-Section "Test 4: Nexus Mind API Routes"

$routes = @(
    @{ Method = "GET"; Path = "/api/nexus/status"; Desc = "Nexus Status Route" },
    @{ Method = "GET"; Path = "/api/nexus/config"; Desc = "Nexus Config Route" }
)

foreach ($route in $routes) {
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl$($route.Path)" -Method $route.Method -TimeoutSec 5
        Write-Test $route.Desc "PASS" "Route accessible"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Test $route.Desc "PASS" "Route accessible (requires auth)"
        } else {
            Write-Test $route.Desc "FAIL" $_.Exception.Message
        }
    }
}

# ================================
# Test 5: Initialize Bridge (if not initialized)
# ================================
Write-Section "Test 5: Bridge Initialization"

try {
    $health = Invoke-RestMethod -Uri "$NexusBridgeUrl/health" -TimeoutSec 5
    
    if (-not $health.initialized) {
        Write-Output "  Initializing Nexus Bridge..."
        $initResponse = Invoke-RestMethod -Uri "$NexusBridgeUrl/initialize" -Method POST -TimeoutSec 30
        Write-Test "Bridge Initialization" $(if ($initResponse.success) { "PASS" } else { "FAIL" }) $initResponse.message
        
        # Re-check health
        Start-Sleep -Seconds 2
        $health = Invoke-RestMethod -Uri "$NexusBridgeUrl/health" -TimeoutSec 5
    } else {
        Write-Test "Bridge Initialization" "PASS" "Already initialized"
    }
} catch {
    Write-Test "Bridge Initialization" "FAIL" $_.Exception.Message
}

# ================================
# Test 6: Functional Tests
# ================================
Write-Section "Test 6: Functional Tests"

# Test Storm Analysis Endpoint
try {
    $stormData = @{
        id = "test-storm-001"
        type = "hail"
        severity = 75
        affectedProperties = 150
        alertLevel = "warning"
        regionName = "Test Region"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$NexusBridgeUrl/storm/analyze" -Method POST -Body $stormData -ContentType "application/json" -TimeoutSec 10
    Write-Test "Storm Analysis" $(if ($response.success) { "PASS" } else { "FAIL" }) "Enhanced: $($response.enhanced)"
} catch {
    Write-Test "Storm Analysis" "FAIL" $_.Exception.Message
}

# Test Cognitive Processing
try {
    $sensorData = @{
        sensor_data = @(0.5, 0.3, 0.8, 0.2)
        context = @{ test = $true }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$NexusBridgeUrl/cognitive/process" -Method POST -Body $sensorData -ContentType "application/json" -TimeoutSec 10
    Write-Test "Cognitive Processing" $(if ($response.success) { "PASS" } else { "FAIL" })
} catch {
    Write-Test "Cognitive Processing" "FAIL" $_.Exception.Message
}

# ================================
# Test Summary
# ================================
Write-Section "Test Summary"

Write-Output "  Total Tests:  $($testResults.Total)"
Write-Host   "  Passed:       $($testResults.Passed)" -ForegroundColor Green
Write-Host   "  Failed:       $($testResults.Failed)" -ForegroundColor Red
Write-Output ""

$passRate = [math]::Round(($testResults.Passed / $testResults.Total) * 100, 1)
Write-Output "  Pass Rate:    $passRate%"
Write-Output ""

if ($testResults.Failed -eq 0) {
    Write-Host "  All tests passed! System is fully integrated." -ForegroundColor Green
} elseif ($passRate -ge 70) {
    Write-Host "  Most tests passed. System is functional with minor issues." -ForegroundColor Yellow
} else {
    Write-Host "  Several tests failed. Please review the configuration." -ForegroundColor Red
}

Write-Output ""

# Return exit code based on results
exit $testResults.Failed
