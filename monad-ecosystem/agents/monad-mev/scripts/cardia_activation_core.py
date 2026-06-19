import json
import os
import datetime

def activate_cardia(capacity_ceiling: int):
    print(f"[{datetime.datetime.now().isoformat()}] INITIATING CARDIA FUNDED ACTIVATION")
    print(f"[{datetime.datetime.now().isoformat()}] RECEIVED AGENT 0 CAPACITY CEILING: ${capacity_ceiling}")

    if capacity_ceiling < 4000:
        print("[!] CAPACITY CEILING BELOW MINIMUM SAFE THRESHOLD ($4k). ABORTING FUNDED ACTIVATION.")
        return False

    base_dir = os.path.dirname(__file__)
    state_dir = os.path.join(base_dir, ".runtime_state")
    
    if not os.path.exists(state_dir):
        os.makedirs(state_dir)
        
    cardia_state_file = os.path.join(state_dir, "cardia_state.json")

    new_state = {
        "status": "LIVE_FUNDED",
        "activation_timestamp": datetime.datetime.now().isoformat(),
        "dynamic_allocation_bands": [15000, 100000],
        "agent0_capacity_lock": capacity_ceiling,
        "mode": "PRODUCTION"
    }

    with open(cardia_state_file, 'w') as f:
        json.dump(new_state, f, indent=4)

    print(f"[{datetime.datetime.now().isoformat()}] CARDIA TRANSITIONED TO LIVE_FUNDED MODE.")
    print(f"[{datetime.datetime.now().isoformat()}] STATE WRITTEN TO: {cardia_state_file}")
    
    return True

if __name__ == "__main__":
    # From Shadow Markout Hardened metrics
    validated_ceiling = 4000 
    activate_cardia(validated_ceiling)
