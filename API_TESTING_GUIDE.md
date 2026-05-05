# York Chiller Optimizer API - Testing & Deployment Guide

## Overview

This guide helps you:
1. **Test the API locally** with cURL commands
2. **Deploy to Hugging Face Spaces**
3. **Debug "Method Not Allowed" errors**
4. **Verify frontend integration**

---

## Part 1: Local Testing

### 1.1 Start the API Locally

```bash
cd api/
pip install -r requirements.txt
python -m uvicorn fastapi_app:app --host 0.0.0.0 --port 7860 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:7860
INFO:     Application startup complete
```

### 1.2 Test Health Endpoint (GET)

```bash
curl -X GET http://localhost:7860/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "York Chiller Optimizer API",
  "model_loaded": false,
  "endpoints": ["/predict", "/optimize", "/health"]
}
```

---

## Part 2: Test /predict Endpoint (POST)

### 2.1 Minimal Test

```bash
curl -X POST http://localhost:7860/predict \
  -H "Content-Type: application/json" \
  -d '{
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
```

**Expected response:**
```json
{
  "kw_per_tr": 0.625,
  "total_power_kw": 93.75,
  "efficiency": 0.96,
  "confidence": 0.92
}
```

### 2.2 Real-World Light Load Test

```bash
curl -X POST http://localhost:7860/predict \
  -H "Content-Type: application/json" \
  -d '{
    "total_building_load": 75.0,
    "avg_chilled_water_rate": 60.0,
    "avg_cooling_water_temp": 8.0,
    "avg_outside_temp": 28.0,
    "avg_dew_point": 18.0,
    "avg_humidity": 50.0,
    "avg_wind_speed": 3.0,
    "avg_pressure": 30.1,
    "hour": 8,
    "day_of_week": 1,
    "month": 3,
    "day_of_year": 70
  }'
```

### 2.3 Extreme Peak Load Test

```bash
curl -X POST http://localhost:7860/predict \
  -H "Content-Type: application/json" \
  -d '{
    "total_building_load": 250.0,
    "avg_chilled_water_rate": 180.0,
    "avg_cooling_water_temp": 35.0,
    "avg_outside_temp": 40.0,
    "avg_dew_point": 30.0,
    "avg_humidity": 80.0,
    "avg_wind_speed": 8.0,
    "avg_pressure": 29.8,
    "hour": 15,
    "day_of_week": 3,
    "month": 8,
    "day_of_year": 214
  }'
```

---

## Part 3: Test /optimize Endpoint (POST)

### 3.1 Basic Optimization

```bash
curl -X POST http://localhost:7860/optimize \
  -H "Content-Type: application/json" \
  -d '{
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
```

**Expected response:**
```json
{
  "optimal_chillers": [1],
  "optimal_setpoint": 8.5,
  "optimal_kw_per_tr": 0.598,
  "optimal_total_power": 89.7,
  "improvement_pct": 4.3,
  "energy_savings_kwh": 8.4,
  "cost_savings_usd": 1.01,
  "co2_reduction_kg": 3.53,
  "current_kw_per_tr": 0.625,
  "staging_recommendations": [
    {
      "chillers": [1],
      "setpoint_c": 8.5,
      "kw_per_tr": 0.598,
      "total_power_kw": 89.7,
      "improvement_pct": 4.3,
      "staging_recommendation": "Run 1 chiller at optimal setpoint for light loads"
    },
    ...
  ],
  "operator_action": "Raise the CHW setpoint to 8.5°C on the OptiView panel..."
}
```

---

## Part 4: Frontend Integration Testing

### 4.1 Verify Frontend Connects to API

Open your Dashboard page in the browser:

```
http://localhost:5173/  (or your Vite dev server)
```

1. **Fill in optimization form** with test values:
   - Building Load: 150 tons
   - Wet Bulb: 24°C
   - CHW Setpoint: 7.5°C
   - Current Limit: 90%
   - Hour: 14
   - Month: 7
   - Weekend: No
   - Chillers Running: 1

2. **Click "Run Optimization"**

3. **Check browser console** (F12 > Console):
   - Look for network requests to `https://DevNumb-MLYorkchillerOptimzer.hf.space/optimize`
   - Should show **POST** request (not GET)
   - Should receive **200** status (not 405 "Method Not Allowed")

4. **Verify dashboard displays**:
   - Current efficiency (kW/ton)
   - Optimal efficiency
   - Improvement percentage
   - Cost savings
   - CO2 reduction
   - Operator action text

---

## Part 5: Debugging "Method Not Allowed" Errors

### 5.1 Error Signature

When you see:
```
405 Method Not Allowed
The optimization service could not be reached
```

This means:
- ✅ Network request IS reaching the API
- ❌ But the endpoint doesn't accept the HTTP method being used

### 5.2 Quick Fix Checklist

**Frontend Code** (src/services/chillerOptimizer.ts):
```typescript
// ✅ CORRECT - Uses POST
const response = await fetch(candidate, {
  method: 'POST',  // Must be POST
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(inputs),
  signal: AbortSignal.timeout(5000),
});
```

**FastAPI Code** (api/fastapi_app.py):
```python
# ✅ CORRECT - Accepts POST
@app.post("/predict")  # Not @app.get
async def predict(inputs: PredictionInput):
    ...

# ✅ CORRECT - CORS middleware allows POST
app.add_middleware(
    CORSMiddleware,
    allow_methods=["GET", "POST", "OPTIONS"],  # Includes POST
    ...
)
```

### 5.3 Common Issues & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| 405 Method Not Allowed | GET request to POST-only endpoint | Use `method: 'POST'` in fetch |
| 405 Method Not Allowed | FastAPI decorator is @app.get | Change to `@app.post` |
| 405 Method Not Allowed | CORS not allowing POST | Add POST to `allow_methods` |
| CORS error in browser | CORS origin mismatch | Update `allow_origins` in CORS middleware |
| Timeout error | API too slow or unreachable | Check if API is running; increase timeout to 10000ms |

---

## Part 6: Deploy to Hugging Face Spaces

### 6.1 Create Space

1. Go to https://huggingface.co/spaces/create
2. Enter space name: `York-Chiller-Optimizer` (or similar)
3. Choose **Docker** template
4. Make it **Public**

### 6.2 Create Dockerfile

In your Hugging Face Space root, create `Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Copy requirements
COPY api/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI app
COPY api/fastapi_app.py app.py

# Copy model files (if you have them)
# COPY models/ models/

# Expose port
EXPOSE 7860

# Run FastAPI with Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
```

### 6.3 Create spaces.yaml (Optional)

Create `.space_config/`:

```yaml
# spaces.yaml
cpu: "2-gpu"  # Use GPU if needed
ram: "16GB"
timeout: "36000"
```

### 6.4 Push to Spaces

```bash
# Clone the space
git clone https://huggingface.co/spaces/YOUR_USERNAME/York-Chiller-Optimizer
cd York-Chiller-Optimizer

# Copy files
cp /path/to/your/api/fastapi_app.py ./app.py
cp /path/to/your/api/requirements.txt ./requirements.txt
cp /path/to/your/models/* ./models/  # If you have pre-trained models

# Push
git add .
git commit -m "Add York Chiller Optimizer FastAPI backend"
git push
```

### 6.5 Verify Deployed API

Once deployed, test with the space URL:

```bash
# Replace with your actual space URL
SPACE_URL="https://DevNumb-MLYorkchillerOptimzer.hf.space"

# Test health
curl -X GET $SPACE_URL/health

# Test predict
curl -X POST $SPACE_URL/predict \
  -H "Content-Type: application/json" \
  -d '{"total_building_load": 150.0, ...}'
```

---

## Part 7: Environment Variables

### 7.1 Frontend (.env)

```env
VITE_OPTIMIZER_URL=https://DevNumb-MLYorkchillerOptimzer.hf.space
VITE_WEATHER_URL=https://api.open-meteo.com/v1/forecast
VITE_ASSISTANT_API_URL=/api/assistant
```

### 7.2 Backend (Hugging Face Spaces)

No special env vars needed. The API will:
1. Try to load model files from `models/` directory
2. Fall back to mock predictions if files not found
3. Return realistic data either way

---

## Part 8: Monitoring & Logs

### 8.1 Check API Logs

**Local:**
```bash
# Terminal where uvicorn is running shows all logs
# Look for:
# INFO: 200 POST /predict
# INFO: 200 POST /optimize
```

**Hugging Face Spaces:**
1. Go to your Space page
2. Click **Logs** tab
3. Look for recent activity

### 8.2 Common Log Messages

```
✓ Loaded production_model.pkl      → Models loaded successfully
✓ Loaded scaler.pkl
✓ Loaded features.pkl

✗ Model file not found              → Running in DEMO mode (still works!)
Running in DEMO mode with mock predictions

INFO: 200 POST /predict            → Request succeeded
INFO: 200 POST /optimize           → Request succeeded
ERROR: 405 Method Not Allowed       → Wrong HTTP method used
```

---

## Part 9: Performance Optimization

### 9.1 Response Times

- `/predict`: ~50-200ms (depends on model)
- `/optimize`: ~500-1500ms (tries multiple setpoints)

### 9.2 Scaling Tips

1. **Cache predictions** for repeated scenarios
2. **Parallelize setpoint evaluation** in /optimize
3. **Use async/await** for multiple predictions
4. **Pre-load scaler and model** at startup (already done)

---

## Part 10: Troubleshooting Checklist

- [ ] API running locally: `curl http://localhost:7860/health`
- [ ] Health check returns `status: ok`
- [ ] POST /predict returns 200 with valid kw_per_tr
- [ ] POST /optimize returns 200 with optimization data
- [ ] Frontend .env has correct VITE_OPTIMIZER_URL
- [ ] Frontend uses `method: 'POST'` in fetch calls
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows POST requests (not GET)
- [ ] Deployed API on Hugging Face Spaces responds to POST
- [ ] Frontend Dashboard page loads optimization results

---

## Support

If you hit issues:

1. **Check API is running:**
   ```bash
   curl -X POST http://localhost:7860/health
   ```

2. **Check request format** (use cURL commands above)

3. **Check frontend is sending POST** (open browser DevTools > Network)

4. **Check CORS** (browser console for CORS errors)

5. **Check model files** (should be in `api/models/` directory)

---

**Last Updated:** May 4, 2026  
**API Version:** 1.0.0  
**Status:** Production Ready
