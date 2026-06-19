import azure.functions as func
import logging
import json
import os

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

@app.route(route="telemetry")
def telemetry(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request for telemetry.')

    # Path to the .runtime_state directory where the execution logs exist
    # Assuming this API runs from infrastructure/api and targets monad-ecosystem
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    state_dir = os.path.join(base_dir, "monad-ecosystem", "agents", "monad-mev", "scripts", ".runtime_state")
    
    markout_summary_file = os.path.join(state_dir, "shadow_markout_summary.json")

    telemetry_data = {
        "status": "active",
        "agent0": {
            "capacity_ceiling": 4000,
            "status": "FUNDED_TRADING_AUTHORITY_GRANTED",
            "markout_data": None
        },
        "cardia": {
            "status": "LIVE_FUNDED",
            "dynamic_allocation_bands": [15000, 100000]
        }
    }

    if os.path.exists(markout_summary_file):
        with open(markout_summary_file, 'r') as f:
            telemetry_data["agent0"]["markout_data"] = json.load(f)

    return func.HttpResponse(
        json.dumps(telemetry_data),
        mimetype="application/json",
        status_code=200
    )
