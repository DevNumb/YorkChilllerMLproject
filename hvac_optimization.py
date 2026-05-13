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
        response = requests.post(BASE_URL, json={"data": data_array}, timeout=10)
        if response.status_code != 200:
            return None
        
        event_id = response.json().get("event_id")
        if not event_id:
            return None
        
        result_url = f"{BASE_URL}/{event_id}"
        
        with requests.get(result_url, stream=True, timeout=30) as r:
            for line in r.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith("data: "):
                        data_content = line_str[6:]
                        try:
                            parsed = json.loads(data_content)
                            if isinstance(parsed, list) and len(parsed) > 0:
                                val_str = str(parsed[0])
                                # Match number in "**Prediction:** 207.74"
                                match = re.search(r"([\d\.]+)", val_str.replace("**Prediction:**", ""))
                                if match:
                                    return float(match.group(1))
                        except:
                            continue
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

def optimize_hvac(env):
    print(f"Starting optimization for Environment: {env}")
    
    # Define scenarios to test
    # 1. Chiller staging options
    stagings = [
        [1, 0, 0], [0, 1, 0], [0, 0, 1], # 1 Chiller
        [1, 1, 0], [1, 0, 1], [0, 1, 1], # 2 Chillers
        [1, 1, 1]                      # 3 Chillers
    ]
    
    # 2. Control points (Speed %, Flow)
    # We'll test a few levels: Low, Med-Low, Med, Med-High, High
    control_levels = [
        {'spd': 40, 'fan': 35, 'flow': 200},
        {'spd': 60, 'fan': 50, 'flow': 250},
        {'spd': 80, 'fan': 70, 'flow': 350},
        {'spd': 95, 'fan': 85, 'flow': 400}
    ]
    
    scenarios = []
    for stage in stagings:
        for ctrl in control_levels:
            settings = {
                'CHL_STA_1': stage[0], 'CHL_STA_2': stage[1], 'CHL_STA_3': stage[2],
                'CHL_COMP_SPD_CTRL_1': ctrl['spd'] if stage[0] else 0,
                'CHL_COMP_SPD_CTRL_2': ctrl['spd'] if stage[1] else 0,
                'CHL_COMP_SPD_CTRL_3': ctrl['spd'] if stage[2] else 0,
                'CT_FAN_SPD_CTRL_1': ctrl['fan'] if stage[0] else 0,
                'CT_FAN_SPD_CTRL_2': ctrl['fan'] if stage[1] else 0,
                'CT_FAN_SPD_CTRL_3': ctrl['fan'] if stage[2] else 0,
                'CHL_CD_FLOW_1': ctrl['flow'] if stage[0] else 0,
                'CHL_CD_FLOW_2': ctrl['flow'] if stage[1] else 0,
                'CHL_CD_FLOW_3': ctrl['flow'] if stage[2] else 0
            }
            scenarios.append(settings)
    
    print(f"Testing {len(scenarios)} scenarios...")
    
    results = []
    
    # We use ThreadPoolExecutor to run requests in parallel to save time
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_settings = {executor.submit(get_prediction, build_data_array(env, s)): s for s in scenarios}
        for future in concurrent.futures.as_completed(future_to_settings):
            settings = future_to_settings[future]
            try:
                kw = future.result()
                if kw is not None:
                    results.append({'settings': settings, 'power_kw': kw})
                    print(f"Scenario: {sum([settings['CHL_STA_1'], settings['CHL_STA_2'], settings['CHL_STA_3']])} Chl, Spd {max([settings['CHL_COMP_SPD_CTRL_1'], settings['CHL_COMP_SPD_CTRL_2'], settings['CHL_COMP_SPD_CTRL_3']])} -> {kw} kW")
            except Exception as e:
                print(f"Error testing scenario: {e}")

    if not results:
        print("No results obtained.")
        return None
    
    # Find minimum power
    best = min(results, key=lambda x: x['power_kw'])
    
    print("\n" + "="*40)
    print("OPTIMIZATION RESULT")
    print("="*40)
    print(f"Minimum Power: {best['power_kw']} kW")
    print(f"Efficiency: {best['power_kw'] / env['CWL_SEC_LOAD']:.4f} kw/TR")
    print("\nBest Settings:")
    for k, v in best['settings'].items():
        print(f"  {k}: {v}")
    print("="*40)
    
    return best

if __name__ == "__main__":
    env = {
        'OA_TEMP': 92.0,
        'OA_TEMP_WB': 72.0,
        'Hour': 14,
        'Weekday': 4, # Thursday
        'Month': 8,   # August
        'CWL_SEC_LOAD': 1000.0
    }
    
    # Refined control levels
    control_levels = []
    for spd in range(30, 101, 10):
        control_levels.append({'spd': spd, 'fan': int(spd*0.8), 'flow': 150 + spd*2})
    
    # We'll just update the optimize_hvac to use these if we want, 
    # but the current function takes levels from inside. 
    # Let's modify the function to accept levels.
    
def optimize_hvac(env, control_levels=None):
    if control_levels is None:
        control_levels = [
            {'spd': 40, 'fan': 35, 'flow': 200},
            {'spd': 60, 'fan': 50, 'flow': 250},
            {'spd': 80, 'fan': 70, 'flow': 350},
            {'spd': 95, 'fan': 85, 'flow': 400}
        ]
    print(f"Starting optimization for Environment: {env}")
    
    # Define scenarios to test
    stagings = [
        [1, 0, 0], [0, 1, 0], [0, 0, 1], # 1 Chiller
        [1, 1, 0], [1, 0, 1], [0, 1, 1], # 2 Chillers
        [1, 1, 1]                      # 3 Chillers
    ]
    
    scenarios = []
    for stage in stagings:
        for ctrl in control_levels:
            settings = {
                'CHL_STA_1': stage[0], 'CHL_STA_2': stage[1], 'CHL_STA_3': stage[2],
                'CHL_COMP_SPD_CTRL_1': ctrl['spd'] if stage[0] else 0,
                'CHL_COMP_SPD_CTRL_2': ctrl['spd'] if stage[1] else 0,
                'CHL_COMP_SPD_CTRL_3': ctrl['spd'] if stage[2] else 0,
                'CT_FAN_SPD_CTRL_1': ctrl['fan'] if stage[0] else 0,
                'CT_FAN_SPD_CTRL_2': ctrl['fan'] if stage[1] else 0,
                'CT_FAN_SPD_CTRL_3': ctrl['fan'] if stage[2] else 0,
                'CHL_CD_FLOW_1': ctrl['flow'] if stage[0] else 0,
                'CHL_CD_FLOW_2': ctrl['flow'] if stage[1] else 0,
                'CHL_CD_FLOW_3': ctrl['flow'] if stage[2] else 0
            }
            scenarios.append(settings)
    
    print(f"Testing {len(scenarios)} scenarios...")
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_settings = {executor.submit(get_prediction, build_data_array(env, s)): s for s in scenarios}
        for future in concurrent.futures.as_completed(future_to_settings):
            settings = future_to_settings[future]
            try:
                kw = future.result()
                if kw is not None:
                    results.append({'settings': settings, 'power_kw': kw})
            except Exception:
                pass

    if not results:
        print("No results obtained.")
        return None
    
    best = min(results, key=lambda x: x['power_kw'])
    
    print("\n" + "="*40)
    print("OPTIMIZATION RESULT")
    print("="*40)
    print(f"Minimum Power: {best['power_kw']} kW")
    print(f"Efficiency: {best['power_kw'] / env['CWL_SEC_LOAD']:.4f} kw/TR")
    print("\nBest Settings:")
    for k, v in best['settings'].items():
        if v > 0: print(f"  {k}: {v}")
    print("="*40)
    return best

if __name__ == "__main__":
    env = {
        'OA_TEMP': 92.0,
        'OA_TEMP_WB': 72.0,
        'Hour': 14,
        'Weekday': 4,
        'Month': 8,
        'CWL_SEC_LOAD': 1000.0
    }
    levels = [{'spd': s, 'fan': int(s*0.7), 'flow': 150 + s*2} for s in range(30, 101, 10)]
    optimize_hvac(env, levels)
