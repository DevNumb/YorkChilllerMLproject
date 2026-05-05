# Architecture Diagram: York Chiller Optimizer System

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER BROWSER                                  │
│                  (http://localhost:5173)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Dashboard Component                                       │ │
│  │  - Collect optimization inputs (12 fields)                │ │
│  │  - Display results (efficiency, savings, etc)             │ │
│  │  - Show operator action recommendations                   │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │                                              │
│                   │ Uses chillerOptimizer.ts service            │
│                   │ method: 'POST'                              │
│                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Fetch API (Frontend)                                      │ │
│  │  POST /predict   (get efficiency prediction)              │ │
│  │  POST /optimize  (get optimization recommendations)       │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
        HTTP POST (JSON payload with 12 fields)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (api/fastapi_app.py)                │
│           https://DevNumb-MLYorkchillerOptimzer.hf.space        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  @app.post("/health")                                    │   │
│  │  ✓ GET requests accepted                                │   │
│  │  Returns: {"status": "ok", "model_loaded": ...}        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  @app.post("/predict") ← Accepts POST (not GET!)        │   │
│  │  ✓ Validates 12-field input                            │   │
│  │  ✓ Loads or mocks ML model                             │   │
│  │  ✓ Returns kW/ton prediction                           │   │
│  │  Returns: {"kw_per_tr": 0.625, ...}                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  @app.post("/optimize") ← Accepts POST (not GET!)       │   │
│  │  ✓ Evaluates 11 setpoints (5.0 - 10.0 °C)             │   │
│  │  ✓ Finds optimal chiller staging                       │   │
│  │  ✓ Calculates cost & emissions savings                 │   │
│  │  ✓ Generates operator action text                      │   │
│  │  Returns: {...optimal setpoint, improvement, savings...}│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CORS Middleware ✓                                       │   │
│  │  ✓ Allows: POST, GET, OPTIONS                          │   │
│  │  ✓ Origins: *.hf.space, *.vercel.app, localhost       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Model Files (Optional)                                  │   │
│  │  api/models/production_model.pkl  (Random Forest)       │   │
│  │  api/models/scaler.pkl             (Feature scaling)     │   │
│  │  api/models/features.pkl           (Feature list)        │   │
│  │                                                          │   │
│  │  ⚠️  Not found? → DEMO mode (realistic mock data) ✓     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                    │
        HTTP 200 (JSON response with predictions)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER BROWSER                                  │
│                   (Results Displayed)                            │
│                                                                   │
│  ✓ Current Efficiency: 0.625 kW/ton                            │
│  ✓ Optimal Efficiency: 0.598 kW/ton                            │
│  ✓ Improvement: 4.3%                                            │
│  ✓ Cost Savings: $1.01/hour                                     │
│  ✓ Operator Action: "Raise CHW setpoint to 8.5°C..."           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Request Flow: What Happens When You Click "Run Optimization"

```
1. USER FILLS FORM
   └─ Load: 150 tons
   └─ Wet Bulb: 24°C
   └─ CHW Setpoint: 7.5°C
   └─ Hour: 14
   └─ etc... (8 more fields)

2. FRONTEND BUILDS REQUEST
   └─ Converts form to 12-field JSON payload
   └─ Calls: buildDashboardPredictionInput()
   └─ Creates: PredictionInput object

3. FRONTEND SENDS POST REQUEST
   └─ Method: POST (not GET) ✓
   └─ URL: https://.../optimize
   └─ Headers: Content-Type: application/json
   └─ Body: { ...12 fields... }

4. FASTAPI BACKEND RECEIVES
   └─ Router matches: @app.post("/optimize")
   └─ Pydantic validates: All 12 fields present & correct type ✓
   └─ Logs: INFO: POST /optimize received

5. BACKEND PROCESSES
   └─ Gets baseline efficiency (calls /predict)
   └─ Tests setpoint: 5.0°C → efficiency: 0.65
   └─ Tests setpoint: 5.5°C → efficiency: 0.63
   └─ ... (9 more setpoints)
   └─ Tests setpoint: 10.0°C → efficiency: 0.58
   └─ Finds best: 8.5°C (0.598 kW/ton, 4.3% improvement)

6. BACKEND RETURNS 200 OK
   └─ Response: {
       "optimal_setpoint": 8.5,
       "optimal_kw_per_tr": 0.598,
       "improvement_pct": 4.3,
       "cost_savings_usd": 1.01,
       "co2_reduction_kg": 3.53,
       "staging_recommendations": [...],
       "operator_action": "Raise the CHW setpoint..."
     }

7. FRONTEND DISPLAYS RESULTS
   └─ deriveResultMetrics() parses response
   └─ Dashboard updates with:
      └─ Current vs Optimal Efficiency graph
      └─ Cost & emissions savings
      └─ Operator action text
      └─ Staging recommendations

8. USER SEES RESULTS ✓
   └─ Optimization complete!
```

---

## HTTP Methods Explained (Why GET Failed)

```
GET Request (❌ WRONG for /predict and /optimize)
┌──────────────────────────────────────────────┐
│ GET /optimize HTTP/1.1                       │
│ Host: api.example.com                        │
│ Content-Type: application/json               │
│                                              │
│ (No body - GET ignores request body)        │
└──────────────────────────────────────────────┘
      ↓
API sees: "You want to GET /optimize"
Response: 405 Method Not Allowed ❌


POST Request (✓ CORRECT for /predict and /optimize)
┌──────────────────────────────────────────────┐
│ POST /optimize HTTP/1.1                      │
│ Host: api.example.com                        │
│ Content-Type: application/json               │
│                                              │
│ {                                            │
│   "total_building_load": 150.0,             │
│   "avg_chilled_water_rate": 100.0,          │
│   ... (10 more fields)                       │
│ }                                            │
└──────────────────────────────────────────────┘
      ↓
API sees: "You want to POST /optimize with data"
Response: 200 OK + Results ✓
```

---

## File Structure (What You Have Now)

```
your-project/
├── api/
│   ├── fastapi_app.py           ← Production FastAPI backend (900+ lines)
│   ├── requirements.txt          ← Python dependencies
│   ├── assistant.js              ← Existing (unchanged)
│   └── models/                   ← Optional: Add your .pkl files here
│       ├── production_model.pkl  (when ready)
│       ├── scaler.pkl            (when ready)
│       └── features.pkl          (when ready)
│
├── src/
│   ├── services/
│   │   ├── chillerOptimizer.ts   ← Frontend service (uses POST) ✓
│   │   └── ... (other services)
│   ├── pages/
│   │   ├── Dashboard.jsx         ← Uses chillerOptimizer service ✓
│   │   └── ... (other pages)
│   └── ... (other source files)
│
├── .env                          ← Frontend config (VITE_OPTIMIZER_URL) ✓
├── .env.local                    ← Local overrides (optional)
├── package.json
├── vite.config.js
├── Dockerfile                    ← Docker for HF Spaces deployment
│
├── API_TESTING_GUIDE.md          ← Complete testing guide with cURL
├── SOLUTION_SUMMARY.md           ← Detailed solution explanation
├── QUICK_REFERENCE.md            ← One-page cheat sheet
├── API_CONFIG.env                ← Configuration reference
│
├── test-api.sh                   ← Bash test script (Linux/Mac)
├── test-api.ps1                  ← PowerShell test script (Windows)
│
└── git repo (commits pushed)
```

---

## CORS Configuration Visualization

```
Before (❌ Problem):
┌─────────────────┐
│  Your Frontend  │
│  localhost:3000 │
└────────┬────────┘
         │
         │ Sends POST request
         ▼
┌──────────────────────────────┐
│  API                         │
│  CORS allow_origins: []      │ ← Empty! Blocks all
│  CORS allow_methods: [GET]   │ ← GET only!
└──────────────────────────────┘
         ↓
    405 Method Not Allowed ❌
    CORS error in browser ❌


After (✓ Fixed):
┌─────────────────┐
│  Your Frontend  │
│  localhost:3000 │
└────────┬────────┘
         │
         │ Sends POST request (method: 'POST')
         ▼
┌─────────────────────────────────────────────┐
│  API (fastapi_app.py)                       │
│  CORS allow_origins:                        │
│    - *.hf.space                            │
│    - *.vercel.app                          │
│    - localhost:*                           │
│    - *                                      │
│  CORS allow_methods: [GET, POST, OPTIONS]  │
│  @app.post("/predict")  ← Accepts POST ✓  │
│  @app.post("/optimize") ← Accepts POST ✓  │
└─────────────────────────────────────────────┘
         ↓
    200 OK + Results ✓
```

---

## Data Flow: 12 Fields to Results

```
User Form Inputs
├─ Building Load: 150 tons
├─ Wet Bulb: 24°C
├─ CHW Setpoint: 7.5°C
├─ Current Limit: 90%
├─ Hour: 14
├─ Month: 7
├─ Is Weekend: No
└─ Chillers Running: 1

        │
        ▼
Frontend: buildDashboardPredictionInput()
        │
        │ Converts to 12 ML model fields
        │
        ▼
PredictionInput (12 fields)
├─ total_building_load: 150.0
├─ avg_chilled_water_rate: 100.0
├─ avg_cooling_water_temp: 8.0
├─ avg_outside_temp: 32.0
├─ avg_dew_point: 24.0
├─ avg_humidity: 65.0
├─ avg_wind_speed: 5.0
├─ avg_pressure: 30.0
├─ hour: 14
├─ day_of_week: 2
├─ month: 7
└─ day_of_year: 183

        │
        ▼
POST /optimize
        │
        ▼
FastAPI Backend
├─ Loads ML model (or uses DEMO)
├─ Tests 11 setpoints (5.0 to 10.0°C)
├─ Finds optimal: 8.5°C with 4.3% improvement
├─ Calculates savings:
│  ├─ Energy: 8.4 kWh/hour
│  ├─ Cost: $1.01/hour
│  └─ CO2: 3.53 kg/hour
├─ Generates operator action text
└─ Returns all results

        │
        ▼
OptimizeResponse (JSON)
├─ optimal_chillers: [1]
├─ optimal_setpoint: 8.5
├─ optimal_kw_per_tr: 0.598
├─ improvement_pct: 4.3
├─ energy_savings_kwh: 8.4
├─ cost_savings_usd: 1.01
├─ co2_reduction_kg: 3.53
├─ staging_recommendations: [...]
└─ operator_action: "Raise CHW setpoint..."

        │
        ▼
Frontend Dashboard Displays Results ✓
├─ Efficiency improvement chart
├─ Cost & emissions savings
├─ Operator action text
└─ Staging options
```

---

## Deployment Options

```
Option 1: Local Development (5 min)
┌──────────────────┐
│  Your Computer   │
├──────────────────┤
│ Terminal 1:      │
│ npm run dev      │ ← Frontend on localhost:5173
│                  │
│ Terminal 2:      │
│ uvicorn app      │ ← Backend on localhost:7860
└──────────────────┘


Option 2: Hugging Face Spaces (10 min + deploy time)
┌────────────────────────────────────┐
│  Hugging Face Spaces               │
├────────────────────────────────────┤
│  Docker Container                  │
│  ├─ fastapi_app.py                │
│  ├─ requirements.txt               │
│  └─ models/ (optional)             │
│  Runs on port 7860                │
│  Public URL: https://.hf.space    │
└────────────────────────────────────┘


Option 3: Multiple Deployment (Production)
┌──────────────┐          ┌──────────────────┐
│  Vercel      │          │  Hugging Face    │
├──────────────┤          ├──────────────────┤
│  Frontend    │          │  Backend API     │
│  React       │ ◄────►   │  FastAPI         │
│  Vite        │          │  Docker          │
│  .vercel.app │          │  .hf.space       │
└──────────────┘          └──────────────────┘
```

---

## Summary

✅ **Frontend:** Correctly sends POST requests  
✅ **Backend:** Now accepts POST (uses @app.post)  
✅ **CORS:** Configured to allow cross-origin POST  
✅ **Models:** Works with or without pre-trained models  
✅ **Testing:** Multiple test scripts provided  
✅ **Deployment:** Dockerfile ready for Hugging Face Spaces  

**Result:** "Method Not Allowed" error is FIXED! 🎉
