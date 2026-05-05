#!/bin/bash
# York Chiller Optimizer API - Quick Start & Test Script

set -e

echo "=========================================="
echo "York Chiller Optimizer API"
echo "Quick Start & Testing Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${1:-http://localhost:7860}"
echo "Testing API at: $API_URL"
echo ""

# Function to print colored output
print_status() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
  fi
}

# Test 1: Health Check
echo "Test 1: Health Check (GET /health)"
echo "Command: curl -X GET $API_URL/health"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/health" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  print_status 0 "Health check passed (HTTP 200)"
  echo "Response: $BODY"
else
  print_status 1 "Health check failed (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 2: Predict Endpoint
echo "Test 2: Predict Endpoint (POST /predict)"
echo "Command: curl -X POST $API_URL/predict"
PREDICT_PAYLOAD='{
  "total_building_load": 150.0,
  "avg_chilled_water_rate": 100.0,
  "avg_cooling_water_temp": 30.5,
  "avg_outside_temp": 32.0,
  "avg_dew_point": 24.0,
  "avg_humidity": 65.0,
  "avg_wind_speed": 5.0,
  "avg_pressure": 30.0,
  "hour": 14,
  "day_of_week": 2,
  "month": 7,
  "day_of_year": 183
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/predict" \
  -H "Content-Type: application/json" \
  -d "$PREDICT_PAYLOAD" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  print_status 0 "Predict endpoint passed (HTTP 200)"
  echo "Response: $BODY"
  
  # Extract kw_per_tr value
  KW_PER_TR=$(echo "$BODY" | grep -o '"kw_per_tr":[0-9.]*' | grep -o '[0-9.]*' || echo "N/A")
  echo "Extracted kW/ton: $KW_PER_TR"
else
  print_status 1 "Predict endpoint failed (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Optimize Endpoint
echo "Test 3: Optimize Endpoint (POST /optimize)"
echo "Command: curl -X POST $API_URL/optimize"
OPTIMIZE_PAYLOAD='{
  "total_building_load": 150.0,
  "avg_chilled_water_rate": 100.0,
  "avg_cooling_water_temp": 30.5,
  "avg_outside_temp": 32.0,
  "avg_dew_point": 24.0,
  "avg_humidity": 65.0,
  "avg_wind_speed": 5.0,
  "avg_pressure": 30.0,
  "hour": 14,
  "day_of_week": 2,
  "month": 7,
  "day_of_year": 183
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/optimize" \
  -H "Content-Type: application/json" \
  -d "$OPTIMIZE_PAYLOAD" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  print_status 0 "Optimize endpoint passed (HTTP 200)"
  # Show truncated response (full response is too long)
  echo "Response (truncated):"
  echo "$BODY" | head -c 500
  echo "..."
  
  # Extract key values
  IMPROVEMENT=$(echo "$BODY" | grep -o '"improvement_pct":[0-9.]*' | grep -o '[0-9.]*' || echo "N/A")
  SETPOINT=$(echo "$BODY" | grep -o '"optimal_setpoint":[0-9.]*' | grep -o '[0-9.]*' || echo "N/A")
  SAVINGS=$(echo "$BODY" | grep -o '"cost_savings_usd":[0-9.]*' | grep -o '[0-9.]*' || echo "N/A")
  
  echo ""
  echo "Extracted values:"
  echo "  Improvement: ${IMPROVEMENT}%"
  echo "  Optimal Setpoint: ${SETPOINT}°C"
  echo "  Cost Savings: \$${SAVINGS}/hour"
else
  print_status 1 "Optimize endpoint failed (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 4: Error Handling (Invalid Input)
echo "Test 4: Error Handling (Invalid Input)"
echo "Sending request with missing required field..."
INVALID_PAYLOAD='{
  "total_building_load": 150.0
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/predict" \
  -H "Content-Type: application/json" \
  -d "$INVALID_PAYLOAD" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "422" ]; then
  print_status 0 "Error handling works (HTTP 422 - Validation Error)"
else
  print_status 1 "Error handling check failed (got HTTP $HTTP_CODE, expected 422)"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "All critical endpoints tested."
echo ""
echo "API URL: $API_URL"
echo ""
echo "For more details, see API_TESTING_GUIDE.md"
echo ""
