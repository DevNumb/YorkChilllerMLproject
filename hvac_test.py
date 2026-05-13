import requests
import json
import time
import random

BASE_URL = "https://DevNumb-randomforestmodel.hf.space/gradio_api/call/predict"

def get_prediction(data_array):
    """
    Follows the POST then GET workflow for Gradio API.
    """
    try:
        print(f"Initiating POST to {BASE_URL}...")
        response = requests.post(BASE_URL, json={"data": data_array}, timeout=10)
        if response.status_code != 200:
            print(f"POST Error: {response.status_code} - {response.text}")
            return None
        
        event_id = response.json().get("event_id")
        if not event_id:
            print(f"No event_id in response: {response.json()}")
            return None
        
        print(f"Event ID: {event_id}. Waiting for result...")
        
        result_url = f"{BASE_URL}/{event_id}"
        
        # We'll use stream=True to handle SSE
        with requests.get(result_url, stream=True, timeout=30) as r:
            for line in r.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    print(f"Received: {line_str}")
                    if line_str.startswith("data: "):
                        data_content = line_str[6:]
                        try:
                            parsed = json.loads(data_content)
                            # Gradio can send different messages. 
                            # If it's the result, it's usually a list.
                            if isinstance(parsed, list) and len(parsed) > 0:
                                val = parsed[0]
                                try:
                                    return float(val)
                                except:
                                    print(f"Could not convert {val} to float")
                            elif isinstance(parsed, dict):
                                if parsed.get("msg") == "process_completed":
                                    output = parsed.get("output", {})
                                    data = output.get("data", [])
                                    if data:
                                        return float(data[0])
                                elif parsed.get("msg") == "heartbeat":
                                    continue
                        except (json.JSONDecodeError, ValueError) as e:
                            print(f"JSON Parse error: {e}")
                            continue
        
        print(f"Stream ended without finding result for event {event_id}")
        return None
    except Exception as e:
        print(f"Exception in get_prediction: {e}")
        return None

def build_data_array(env, settings):
    """
    Builds the 18-parameter array.
    """
    return [
        env['OA_TEMP'], env['OA_TEMP_WB'], env['Hour'], env['Weekday'], env['Month'],
        settings['CHL_STA_1'], settings['CHL_STA_2'], settings['CHL_STA_3'],
        settings['CHL_COMP_SPD_CTRL_1'], settings['CHL_COMP_SPD_CTRL_2'], settings['CHL_COMP_SPD_CTRL_3'],
        settings['CT_FAN_SPD_CTRL_1'], settings['CT_FAN_SPD_CTRL_2'], settings['CT_FAN_SPD_CTRL_3'],
        settings['CHL_CD_FLOW_1'], settings['CHL_CD_FLOW_2'], settings['CHL_CD_FLOW_3'],
        env['CWL_SEC_LOAD']
    ]

def run_test():
    # Environmental conditions
    env = {
        'OA_TEMP': 85.0,
        'OA_TEMP_WB': 65.0,
        'Hour': 14,
        'Weekday': 2,
        'Month': 8,
        'CWL_SEC_LOAD': 350.0
    }
    
    # Sample settings (3 chillers running)
    settings = {
        'CHL_STA_1': 1, 'CHL_STA_2': 1, 'CHL_STA_3': 1,
        'CHL_COMP_SPD_CTRL_1': 60, 'CHL_COMP_SPD_CTRL_2': 60, 'CHL_COMP_SPD_CTRL_3': 60,
        'CT_FAN_SPD_CTRL_1': 45, 'CT_FAN_SPD_CTRL_2': 45, 'CT_FAN_SPD_CTRL_3': 45,
        'CHL_CD_FLOW_1': 250, 'CHL_CD_FLOW_2': 250, 'CHL_CD_FLOW_3': 250
    }
    
    data = build_data_array(env, settings)
    print(f"Testing with data: {data}")
    result = get_prediction(data)
    print(f"Prediction result (kw/TR): {result}")
    return result

if __name__ == "__main__":
    run_test()
