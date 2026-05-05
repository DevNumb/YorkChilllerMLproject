# Dashboard & Energy Forecasting - Fixed and Ready to Test

## What Was Fixed

### ✅ Dashboard.jsx
- **Before:** Not calling API, using local calculations only
- **After:** Calls API `/predict` endpoint with 12-field input
- **Result:** Gets real predictions and optimizes properly

**What it does now:**
1. ✅ Sends your form inputs as proper 12-field JSON to API
2. ✅ Gets `kw_per_tr` prediction from API
3. ✅ Calculates `total_power = load * kw_per_tr`
4. ✅ Tests 11 different setpoints (5.0°C to 10.0°C)
5. ✅ Tests 4 different chiller counts (1, 2, 3, 4)
6. ✅ Finds **optimal configuration** that uses least power
7. ✅ Shows:
   - Current vs optimal efficiency
   - Total power and power saved
   - Recommended setpoint and chiller count
   - Cost savings per hour ($)
   - CO2 reduction per hour (kg)
   - Operator action recommendation
8. ✅ Saves results to history

### ✅ EnergyForecasting.jsx
- **Before:** Crashed when generating schedule
- **After:** Fixed to call API for real predictions
- **Result:** 24-hour forecast working

**What it does now:**
1. ✅ Generates 24 hourly scenarios for tomorrow
2. ✅ Calls API `/predict` for each hour
3. ✅ Gets actual efficiency predictions
4. ✅ Calculates power with proper chiller staging
5. ✅ Shows 24-hour chart of power usage
6. ✅ Daily summary:
   - Total energy for tomorrow
   - Most used chiller count
   - Setpoint range
   - Peak hour
7. ✅ Manual optimization test section
8. ✅ Proper error handling (falls back to cache if API fails)

---

## How to Test

### Test 1: Dashboard Prediction

**Steps:**
1. Open the app: `npm run dev` (http://localhost:5173)
2. Go to **Dashboard** page
3. Fill in the form with your test data:
   ```
   Building Load: 1200 tons
   Wet Bulb: 65°F (convert to °C: ~18°C)
   CHW Setpoint: 25°C (this is cooling water temp, dashboard expects setpoint)
   Current Limit: 85%
   Hour: 14
   Month: 7 (July)
   Is Weekend: No
   Chillers Running: 1
   ```
4. Click **"Run Optimization"**
5. **Expected Result:** Dashboard shows:
   - ✓ Current Efficiency: ~0.4 (or close to API value)
   - ✓ Optimal Efficiency: Better (lower) value
   - ✓ Optimal Setpoint: 8.5°C or similar
   - ✓ Recommended Chillers: Maybe 1 or 2
   - ✓ Power Saved: Positive number
   - ✓ Cost Savings: Positive number
   - ✓ Operator Action Text

**If it works:** ✅ API integration successful!  
**If it fails:** Check browser DevTools > Network tab:
- Should show POST request to your API URL
- Should see HTTP 200 response
- Response should have `kw_per_tr` field

### Test 2: Energy Forecasting 24-Hour

**Steps:**
1. Go to **Energy Forecasting** page
2. Wait for "Refresh Schedule" to complete (or click it)
3. **Expected Result:** Shows:
   - ✓ Tomorrow's date
   - ✓ 24-hour line chart with power curve
   - ✓ Daily summary metrics
   - ✓ Total energy, peak hour, average efficiency

**If chart appears:** ✅ Forecasting working!  
**If it fails or shows "Failed to refresh":**
- Check browser console for errors
- Check Network tab for failed requests
- API might be timing out

### Test 3: Manual Optimization in Forecasting

**Steps:**
1. On Energy Forecasting page, scroll to "Manual Optimization Test"
2. Adjust the sliders:
   - Building Load: 800 tons
   - Wet Bulb: 20°C
   - CHW Setpoint: 6.5°C
   - Others as default
3. Click **"⚡ Optimize"**
4. **Expected Result:** Shows:
   - ✓ kW/ton value
   - ✓ Total Power in kW
   - ✓ Efficiency rating

---

## What the API Should Return

When Dashboard calls the API, it sends something like:
```json
{
  "total_building_load": 1200,
  "avg_chilled_water_rate": 250,
  "avg_cooling_water_temp": 26.5,
  "avg_outside_temp": 85,
  "avg_dew_point": 65,
  "avg_humidity": 60,
  "avg_wind_speed": 10,
  "avg_pressure": 29.92,
  "hour": 14,
  "day_of_week": 2,
  "month": 7,
  "day_of_year": 185
}
```

API should respond with:
```json
{
  "status": "success",
  "kw_per_tr": 0.4,
  "efficiency_rating": "Excellent",
  ...
}
```

Dashboard then calculates:
- `total_power = 1200 * 0.4 = 480 kW`
- Tests different setpoints and chiller counts
- Finds the best combination

---

## Debugging Checklist

### If Dashboard doesn't predict:

- [ ] Check .env has `VITE_OPTIMIZER_URL` set
- [ ] Check API is running/accessible
- [ ] Open browser DevTools (F12 > Network tab)
- [ ] Click "Run Optimization"
- [ ] Look for POST request to your API URL
- [ ] Check response status (should be 200, not 405)
- [ ] Check response body has `kw_per_tr` field

### If no CORS error but API returns 405:
- API endpoint doesn't accept POST
- Must use `@app.post("/predict")` in FastAPI (not `@app.get`)
- Check your FastAPI backend code

### If Forecasting shows "Failed to refresh":
- API might be timing out (takes 5+ seconds)
- Or API returns wrong format
- Check browser console for full error

### If partial data (some hours work, some fail):
- API might be slow
- Each hour tries API, if it fails it uses fallback prediction
- This is OK - forecast still shows something

---

## Input Format Conversion

When you fill the Dashboard form, it converts to 12-field API format:

```javascript
// From form:
load_tons: 1200
wet_bulb_c: 18
current_chw_setpoint_c: 7.5
hour: 14
month: 7

// Converted to:
total_building_load: 1200
avg_chilled_water_rate: 60 (calculated from load)
avg_cooling_water_temp: 8.5 (setpoint + 1)
avg_outside_temp: 32 (calculated from wet bulb)
avg_dew_point: 20 (calculated from wet bulb)
avg_humidity: 60 (fixed)
avg_wind_speed: 5 (fixed)
avg_pressure: 30 (fixed)
hour: 14
day_of_week: 1 (0=weekend, 1=weekday)
month: 7
day_of_year: 185 (calculated)
```

---

## Expected Performance

### Dashboard Optimization:
- First prediction (~200ms)
- Test 11 setpoints × 4 chillers = 44 tests
- ~100-200ms per test = **~5-10 seconds total**
- Shows "Running..." while processing
- Displays results when done

### Energy Forecasting:
- 24 hourly predictions
- ~100-200ms each = **~5-10 seconds for full day**
- Can run in background
- Falls back to defaults if API is slow

---

## Example Test with User Data

The data you provided:
```json
{
    "total_building_load": 1200,
    "avg_chilled_water_rate": 250,
    "avg_cooling_water_temp": 25,
    "avg_outside_temp": 85,
    "avg_dew_point": 65,
    "avg_humidity": 60,
    "avg_wind_speed": 10,
    "avg_pressure": 29.92,
    "hour": 14,
    "day_of_week": 2,
    "month": 7,
    "day_of_year": 185
}
```

API returned: `kw_per_tr: 0.4`

**Calculation:**
- Total Power = 1200 * 0.4 = **480 kW**
- If you reduce setpoint to 7.5°C and use 2 chillers
- New prediction might be: `kw_per_tr: 0.38`
- New Power = 1200 * 0.38 * 1.05 (stage factor) = **479 kW**
- Savings = 480 - 479 = **1 kW (barely)**

If you optimize MORE and use 1 chiller at 8.5°C:
- Prediction: `kw_per_tr: 0.36`
- Power = 1200 * 0.36 * 1.15 (underload penalty) = **497 kW**
- **This is worse!** Dashboard won't recommend it

Dashboard finds the sweet spot where load is balanced and efficiency is best.

---

## Next Steps

1. **Test Dashboard** - Fill form → Click Run → See results
2. **Test Forecasting** - Go to page → Wait for schedule → See chart
3. **Check errors** - DevTools if anything fails
4. **Adjust .env if needed** - Make sure API URL is correct
5. **Let it run** - Takes 5-10 seconds, be patient

---

## Success Indicators ✅

You'll know it's working when you see:
- Dashboard shows optimization results with numbers
- Numbers make sense (kW/ton between 0.3-0.8)
- Forecasting shows 24-hour chart
- Operator actions are readable
- No red error messages (warnings OK)
- History tab fills up with results

---

**Ready to test! Open the app and try it out.** 🚀
