import requests
import json
import time
import re
import concurrent.futures

BASE_URL = "https://DevNumb-randomforestmodel.hf.space/gradio_api/call/predict"

def get_prediction(data_array):
    """
    Follows the POST then GET workflow for Gradio API.
    Parses "**Prediction:** X.Y" from the response.
    """
    try:
        response = requests.post(BASE_URL, json={"data": data_array}, timeout=15)
        if response.status_code != 200:
            return None
        
        event_id = response.json().get("event_id")
        if not event_id:
            return None
        
        result_url = f"{BASE_URL}/{event_id}"
        
        # Poll for result
        start_time = time.time()
        while time.time() - start_time < 20:
            with requests.get(result_url, stream=True, timeout=15) as r:
                for line in r.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith("data: "):
                            data_content = line_str[6:]
                            try:
                                parsed = json.loads(data_content)
                                if isinstance(parsed, list) and len(parsed) > 0:
                                    val_str = str(parsed[0])
                                    match = re.search(r"([\d\.]+)", val_str.replace("**Prediction:**", ""))
                                    if match:
                                        return float(match.group(1))
                            except:
                                continue
            time.sleep(2) # Wait 2 seconds between polls as requested
        return None
    except Exception:
        return None

def build_data_array(env, settings):
    return [
        env['OA_TEMP'], env['OA_TEMP_WB'], env['Hour'], env['Weekday'], env['Month'],
        settings['CHL_STA_1'], settings['CHL_STA_2'], settings['CHL_STA_3'],
        settings['CHL_COMP_SPD_CTRL_1'], settings['CHL_COMP_SPD_CTRL_2'], settings['CHL_COMP_SPD_CTRL_3'],
        settings['CT_FAN_SPD_CTRL_1'], settings['CT_FAN_SPD_CTRL_2'], settings['CT_FAN_SPD_CTRL_3'],
        settings['CHL_CD_FLOW_1'], settings['CHL_CD_FLOW_2'], settings['CHL_CD_FLOW_3'],
        env['CWL_SEC_LOAD']
    ]

def optimize():
    # Fixed Parameters
    env = {
        'OA_TEMP': 85.0,
        'OA_TEMP_WB': 65.0,
        'Hour': 14,
        'Weekday': 2,
        'Month': 8,
        'CWL_SEC_LOAD': 350.0 # 200-400 tons range
    }
    
    scenarios = []
    
    # Strategy 1: Baseline (current inefficient)
    scenarios.append({
        'name': 'Baseline',
        'CHL_STA_1': 1, 'CHL_STA_2': 1, 'CHL_STA_3': 0,
        'CHL_COMP_SPD_CTRL_1': 90, 'CHL_COMP_SPD_CTRL_2': 90, 'CHL_COMP_SPD_CTRL_3': 0,
        'CT_FAN_SPD_CTRL_1': 80, 'CT_FAN_SPD_CTRL_2': 80, 'CT_FAN_SPD_CTRL_3': 0,
        'CHL_CD_FLOW_1': 285, 'CHL_CD_FLOW_2': 285, 'CHL_CD_FLOW_3': 0
    })
    
    # Strategy 2: Single chiller at 40%, 50%, 60%, 70%
    # (Testing Chiller 2 as it was identified as efficient)
    for spd in [40, 50, 60, 70]:
        fan = round(spd * 0.7) # 70% rule
        flow = 150 + (spd * 1.5)
        scenarios.append({
            'name': f'1-Chl {spd}%',
            'CHL_STA_1': 0, 'CHL_STA_2': 1, 'CHL_STA_3': 0,
            'CHL_COMP_SPD_CTRL_1': 0, 'CHL_COMP_SPD_CTRL_2': spd, 'CHL_COMP_SPD_CTRL_3': 0,
            'CT_FAN_SPD_CTRL_1': 0, 'CT_FAN_SPD_CTRL_2': fan, 'CT_FAN_SPD_CTRL_3': 0,
            'CHL_CD_FLOW_1': 0, 'CHL_CD_FLOW_2': flow, 'CHL_CD_FLOW_3': 0
        })
        
    # Strategy 3: Two chillers at 35%, 40%, 45%, 50%
    for spd in [35, 40, 45, 50]:
        fan = round(spd * 0.7)
        flow = 150 + (spd * 1.5)
        scenarios.append({
            'name': f'2-Chl {spd}%',
            'CHL_STA_1': 1, 'CHL_STA_2': 1, 'CHL_STA_3': 0,
            'CHL_COMP_SPD_CTRL_1': spd, 'CHL_COMP_SPD_CTRL_2': spd, 'CHL_COMP_SPD_CTRL_3': 0,
            'CT_FAN_SPD_CTRL_1': fan, 'CT_FAN_SPD_CTRL_2': fan, 'CT_FAN_SPD_CTRL_3': 0,
            'CHL_CD_FLOW_1': flow, 'CHL_CD_FLOW_2': flow, 'CHL_CD_FLOW_3': 0
        })

    print(f"Testing {len(scenarios)} scenarios via API...")
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_scenario = {executor.submit(get_prediction, build_data_array(env, s)): s for s in scenarios}
        for future in concurrent.futures.as_completed(future_to_scenario):
            s = future_to_scenario[future]
            kw = future.result()
            if kw is not None:
                results.append({'scenario': s, 'kw': kw})
                print(f"Result: {s['name']} -> {kw} kW")

    if not results:
        print("Failed to get any results.")
        return

    best = min(results, key=lambda x: x['kw'])
    
    print("\n" + "="*50)
    print("FINAL OPTIMAL COMBINATION")
    print("="*50)
    print(f"Scenario Name: {best['scenario']['name']}")
    print(f"Minimum Power: {best['kw']} kW")
    print("\n18 Parameter Array (Data Array):")
    print(build_data_array(env, best['scenario']))
    print("\nIndividual Parameters:")
    for k, v in best['scenario'].items():
        if k != 'name': print(f"  {k}: {v}")
    print("="*50)

if __name__ == "__main__":
    optimize()
