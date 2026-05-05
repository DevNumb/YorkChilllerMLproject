# York Chiller Optimizer API - Quick Start & Test Script (PowerShell)
# Usage: .\test-api.ps1 -ApiUrl "http://localhost:7860"

param(
    [string]$ApiUrl = "http://localhost:7860"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "York Chiller Optimizer API" -ForegroundColor Cyan
Write-Host "Quick Start & Testing Script (PowerShell)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing API at: $ApiUrl" -ForegroundColor Yellow
Write-Host ""

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body,
        [string]$Description
    )
    
    $Url = "$ApiUrl$Path"
    Write-Host "Test: $Description" -ForegroundColor Cyan
    Write-Host "  Command: curl -X $Method $Url" -ForegroundColor DarkGray
    
    try {
        $Response = Invoke-WebRequest -Uri $Url -Method $Method `
            -Headers @{"Content-Type" = "application/json"} `
            -Body $Body -ErrorAction Stop
        
        $StatusCode = $Response.StatusCode
        $ResponseBody = $Response.Content
        
        if ($StatusCode -eq 200) {
            Write-Host "  ✓ Success (HTTP $StatusCode)" -ForegroundColor Green
            Write-Host "  Response: $ResponseBody" -ForegroundColor Gray
            return $true
        } else {
            Write-Host "  ✗ Failed (HTTP $StatusCode)" -ForegroundColor Red
            Write-Host "  Response: $ResponseBody" -ForegroundColor Red
            return $false
        }
    }
    catch {
        $StatusCode = $_.Exception.Response.StatusCode.Value__
        $ErrorMsg = $_.Exception.Message
        Write-Host "  ✗ Error (HTTP $StatusCode): $ErrorMsg" -ForegroundColor Red
        return $false
    }
}

# Test 1: Health Check
Write-Host ""
Test-Endpoint -Method "GET" -Path "/health" -Description "Health Check (GET /health)" | Out-Null

# Test 2: Predict Endpoint
Write-Host ""
$PredictPayload = @{
    total_building_load = 150.0
    avg_chilled_water_rate = 100.0
    avg_cooling_water_temp = 30.5
    avg_outside_temp = 32.0
    avg_dew_point = 24.0
    avg_humidity = 65.0
    avg_wind_speed = 5.0
    avg_pressure = 30.0
    hour = 14
    day_of_week = 2
    month = 7
    day_of_year = 183
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Path "/predict" -Body $PredictPayload -Description "Predict Endpoint (POST /predict)" | Out-Null

# Test 3: Optimize Endpoint
Write-Host ""
$OptimizePayload = @{
    total_building_load = 150.0
    avg_chilled_water_rate = 100.0
    avg_cooling_water_temp = 30.5
    avg_outside_temp = 32.0
    avg_dew_point = 24.0
    avg_humidity = 65.0
    avg_wind_speed = 5.0
    avg_pressure = 30.0
    hour = 14
    day_of_week = 2
    month = 7
    day_of_year = 183
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Path "/optimize" -Body $OptimizePayload -Description "Optimize Endpoint (POST /optimize)" | Out-Null

# Test 4: Error Handling
Write-Host ""
Write-Host "Test: Error Handling (Invalid Input)" -ForegroundColor Cyan
$InvalidPayload = @{
    total_building_load = 150.0
} | ConvertTo-Json

try {
    $Response = Invoke-WebRequest -Uri "$ApiUrl/predict" -Method "POST" `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $InvalidPayload -ErrorAction Stop
    Write-Host "  ✗ Should have failed with validation error" -ForegroundColor Red
}
catch {
    $StatusCode = $_.Exception.Response.StatusCode.Value__
    if ($StatusCode -eq 422) {
        Write-Host "  ✓ Error handling works (HTTP 422 - Validation Error)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Unexpected error code: $StatusCode" -ForegroundColor Red
    }
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "All critical endpoints tested." -ForegroundColor Green
Write-Host ""
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "For more details, see API_TESTING_GUIDE.md" -ForegroundColor Gray
Write-Host ""
