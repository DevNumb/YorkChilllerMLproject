# ML Fault Detection Use Case

## Overview
The ML Fault Detection feature integrates an external Random Forest model (hosted on Hugging Face) to analyze chiller plant sensor data and predict operational anomalies.

## Primary Actor
**Plant Operator**: Responsible for monitoring system health and initiating diagnostic scans.

## System Components
1.  **Frontend**: React-based dashboard (FaultDetection.jsx).
2.  **External ML API**: Gradio-based inference service at `https://devnumb-fault.hf.space`.
3.  **Database**: Supabase `fault_detection_history` table for persistence.

## Key Scenarios

### 1. Manual Diagnostics Scan
- **Trigger**: Operator clicks "Run Full Diagnostics Scan".
- **Action**: 
    1. System collects Cooling Load, Wet Bulb, and Chiller Unit data.
    2. System sends POST request to ML API to initiate event.
    3. System polls API with `event_id` until result is ready.
- **Outcome**: UI displays "Fault" or "System Stable" and updates anomaly scores.

### 2. Result Persistence
- **Trigger**: Successful completion of a diagnostic scan.
- **Action**: System automatically saves inputs (load, wet bulb, unit settings) and model outputs (prediction, score) to Supabase.
- **Outcome**: Historical data is available for audit and trend analysis.

### 3. Error Handling
- **Trigger**: Network failure or API timeout.
- **Action**: System automatically retries once; if still failing, shows "Scan failed" toast.
- **Outcome**: User is informed of connectivity issues without crashing the UI.

## API Data Contract

### Request (JSON)
```json
{
  "data": [
    "{ \"cooling_load\": 1200, \"wet_bulb\": 17.1, \"units\": [...] }"
  ]
}
```

### Response (JSON)
```json
[
  {
    "prediction": "Fault" | "Normal",
    "fault_score": -0.0080
  }
]
```
