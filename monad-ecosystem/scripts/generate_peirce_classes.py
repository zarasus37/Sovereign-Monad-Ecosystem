import json
from pathlib import Path

def generate_peirce_classes():
    classes = []
    
    bands = ["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]
    modes = ["ICON", "INDEX", "SYMBOL"]
    
    # Generate 66 unique classes
    # Peirce's 66 classes are derived from 10 classes of signs, expanded into further tricotomies.
    # For a canonical placeholder up to 66:
    for i in range(66):
        # Deterministic generation for the sake of the canonical spec
        # Firstness, Secondness, Thirdness
        # We need w1+w2+w3 = 1.0
        
        # We define a few known ones
        if i == 0:
            c = {
                "id": 0,
                "label": "Rhematic-Iconic-Qualisign",
                "path": ["Qualisign", "Icon", "Rheme"],
                "firstness_weight": 1.0,
                "secondness_weight": 0.0,
                "thirdness_weight": 0.0,
                "pragmatism_band": "INSTINCT",
                "ring_radius": 1,
                "ring_angle_deg": 0.0
            }
        elif i == 1:
            c = {
                "id": 1,
                "label": "Dicent-Indexical-Sinsign",
                "path": ["Sinsign", "Index", "Dicent"],
                "firstness_weight": 0.0,
                "secondness_weight": 1.0,
                "thirdness_weight": 0.0,
                "pragmatism_band": "EXPERIENCE",
                "ring_radius": 2,
                "ring_angle_deg": 120.0
            }
        elif i == 42:
            c = {
                "id": 42,
                "label": "Legisign-Symbol-Argument",
                "path": ["Legisign", "Symbol", "Argument"],
                "firstness_weight": 0.15,
                "secondness_weight": 0.35,
                "thirdness_weight": 0.50,
                "pragmatism_band": "FORMAL_THOUGHT",
                "ring_radius": 3,
                "ring_angle_deg": 240.0
            }
        else:
            w1 = (65 - i) / 65.0
            w2 = (i / 65.0) * 0.5
            w3 = 1.0 - w1 - w2
            
            # Simple heuristic for band
            if w3 >= 0.4:
                band = "FORMAL_THOUGHT"
                radius = 3
            elif w2 >= 0.4:
                band = "EXPERIENCE"
                radius = 2
            else:
                band = "INSTINCT"
                radius = 1
                
            c = {
                "id": i,
                "label": f"Class-{i}",
                "path": [f"Node1-{i}", f"Node2-{i}", f"Node3-{i}"],
                "firstness_weight": round(w1, 3),
                "secondness_weight": round(w2, 3),
                "thirdness_weight": round(w3, 3),
                "pragmatism_band": band,
                "ring_radius": radius,
                "ring_angle_deg": round((i * 360 / 66) % 360, 1)
            }
        classes.append(c)

    # Ensure path exists
    out_dir = Path("packages/logoc/spec")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with open(out_dir / "peirce_sign_classes.json", "w") as f:
        json.dump(classes, f, indent=2)

if __name__ == "__main__":
    generate_peirce_classes()
