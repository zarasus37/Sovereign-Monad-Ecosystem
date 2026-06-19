import os

def build_system():
    # 1. Define the Project Map
    project_name = "Gnostic_Engine"
    files = {
        # THE CORE ENGINE LOGIC
        "src/gnostic_engine.py": '''import numpy as np

class GnosticEngine:
    """Volumetric 4D Gnostic Engine with Stokes-Mueller Resonance."""
    def __init__(self, threshold=0.85):
        self.threshold = threshold
        self.history = {}

    def calculate_stokes(self, a, b, c):
        s0 = a + b + c 
        s1 = a - b     
        s2 = 2 * np.sqrt(a * b)
        s3 = c         
        return np.array([s0, s1, s2, s3])

    def process_packet(self, var_id, a, b, c):
        if var_id not in self.history: self.history[var_id] = []
        self.history[var_id].append({'a': a, 'b': b})
        
        # Pulfrich Phase Shift (Synthetic Parallax)
        tilt = 0.0
        if len(self.history[var_id]) >= 2:
            tilt = abs(self.history[var_id][-1]['a'] - self.history[var_id][-2]['b']) * 10
            
        stokes = self.calculate_stokes(a, b, c)
        s0, s1, s2, s3 = stokes
        dop = np.sqrt(s1**2 + s2**2 + s3**2) / s0 if s0 != 0 else 0
        sr = round(dop * np.cos(np.radians(tilt)), 4)
        
        verdict = "FOCAL_LOCK" if sr >= self.threshold else "REJECT"
        return {"verdict": verdict, "var": var_id, "structural_read": sr, "phase_tilt": tilt}
''',

        # THE API GATEWAY
        "api/gnostic_api.py": '''from fastapi import FastAPI
from pydantic import BaseModel
import sys
import os

# Ensure API can see the src folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
from gnostic_engine import GnosticEngine

app = FastAPI(title="Gnostic Engine API")
engine = GnosticEngine()

class Packet(BaseModel):
    var_id: str
    lane_a: float
    lane_b: float
    lane_c: float

@app.post("/intake/forage")
async def forage(packet: Packet):
    return engine.process_packet(packet.var_id, packet.lane_a, packet.lane_b, packet.lane_c)

@app.get("/")
async def root():
    return {"status": "ONLINE", "mode": "Volumetric-4D"}
''',

        # THE PROJECT DOCUMENTATION
        "README.md": f'''# {project_name}
## Author: Cris Colon
## Architecture: Volumetric 4D-Kinetic Parallax

### Description
A non-linear analytical engine designed to detect "Silent Updates" in supply chains 
using Stokes-Mueller resonance and Pulfrich phase shifts.

### How to Run:
1. `pip install fastapi uvicorn numpy`
2. `python build_sge_system.py` (Creates the folders)
3. `uvicorn api.gnostic_api:app --reload`
'''
    }

    # 2. Execute the Build
    print(f"--- Building {project_name} ---")
    for path, content in files.items():
        # Create subfolders if needed
        folder = os.path.dirname(path)
        if folder and not os.path.exists(folder):
            os.makedirs(folder)
        
        # Write the file
        with open(path, "w") as f:
            f.write(content)
        print(f"[CREATED] {path}")

    print("\n--- System Built Successfully ---")
    print("Run: uvicorn api.gnostic_api:app --reload")

if __name__ == "__main__":
    build_system()
