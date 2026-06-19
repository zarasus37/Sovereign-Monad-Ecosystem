import time
import math
from typing import Dict, Any, Tuple

class SemioticDialect:
    """
    Level 3: The Semiotic Dialect (The Astrological Hard Drive)
    Executes deep frequency parsing on raw .amen expression strings.
    Measures thermodynamic friction based on emission vs. void-face configurations.
    """
    def __init__(self):
        # Emission-Face Alphabetic Array (Creative, Low-Friction, Coherent)
        self.emission_tokens = {'H', 'R', 'E', 'I', 'Y', 'L', 'A', 'O', 'U', 'V'}
        
        # Void-Face Alphabetic Array (Material, High-Friction, Entropic)
        # Features the critical linguistic anomaly variables: Gimel (G) and Samekh (S)
        self.void_tokens = {'G', 'S', 'M', 'K', 'X', 'Z', 'Q', 'B', 'D', 'F'}
        
        print("[Compiler Core] Level 3 Semiotic Dialect analyzer online.")

    def calculate_celestial_slice(self, slot_index: int) -> float:
        """
        Maps a 144-fold macrocosmic coordinate slot onto its precise 
        2.5-degree celestial arc slice (dodecatemoria) of the ecliptic.
        """
        # Formally normalize index to ensure absolute bounds compliance
        bounded_slot = min(max(slot_index, 0), 143)
        arc_degree = (bounded_slot * 2.5) % 360.0
        return round(arc_degree, 2)

    def analyze_lexical_frequency(self, raw_expression: str) -> Dict[str, Any]:
        """
        Scans input source strings for character distributions.
        Computes the Hebrew Signature balance and outputs thermodynamic constraints.
        """
        clean_text = raw_expression.strip().upper()
        if not clean_text:
            return {
                "signature": "VACUOUS_VOID",
                "friction_coefficient": 1.0000,
                "coherence_index": 0.0000
            }

        # Calculate exact letter frequencies
        emission_count = sum(1 for char in clean_text if char in self.emission_tokens)
        void_count = sum(1 for char in clean_text if char in self.void_tokens)
        total_tracked = emission_count + void_count

        # Prevent division-by-zero on purely numerical or symbolic delimiter streams
        if total_tracked == 0:
            return {
                "signature": "STASIS_NEUTRAL",
                "friction_coefficient": 0.5000,
                "coherence_index": 0.5000
            }

        # Mathematical calculation of linguistic friction (Void dominance)
        friction_coefficient = void_count / total_tracked
        coherence_index = emission_count / total_tracked
        
        # Enforce Rule: High Gimel/Samekh frequency marks payload as a material transaction execution
        if friction_coefficient > 0.50:
            signature_classification = "VOID_DOMINANT_MATERIAL_TX"
        else:
            signature_classification = "EMISSION_DOMINANT_LOGIC_BLOCK"

        return {
            "signature": signature_classification,
            "friction_coefficient": round(friction_coefficient, 4),
            "coherence_index": round(coherence_index, 4),
            "raw_metrics": {
                "emission_count": emission_count,
                "void_count": void_count,
                "total_string_length": len(clean_text)
            }
        }

    def process_level3_lowering(self, input_expression: str, target_slot: int) -> Tuple[bool, Dict[str, Any]]:
        """
        Lowers a raw human-readable input expression down to Level 2.
        Binds spatial-temporal coordinates to the text's thermodynamic metadata package.
        """
        print(f"\n[Semiotic Dialect] Parsing incoming source sequence: '{input_expression}'")
        
        # 1. Compute lexical properties and signature classifications
        metrics = self.analyze_lexical_frequency(input_expression)
        
        # 2. Map structural coordinate positioning onto the geometric grid
        celestial_coordinate = self.calculate_celestial_slice(target_slot)
        
        print(f"[Semiotic Dialect] Calculated Celestial Longitude: {celestial_coordinate}° on 144-fold Grid.")
        print(f"[Semiotic Dialect] Evaluated Character Signature: {metrics['signature']}")

        # Formulate output metadata payload
        lowering_manifest = {
            "origin_expression": input_expression,
            "astrological_grid_target": target_slot,
            "celestial_longitude_degrees": celestial_coordinate,
            "thermodynamic_metrics": metrics,
            "timestamp_lowered_ns": time.time_ns()
        }
        
        return True, lowering_manifest

# ==========================================
# PRODUCTION ENVIRONMENT UNIT VERIFICATION
# ==========================================
if __name__ == "__main__":
    dialect_parser = SemioticDialect()
    
    # Test Payload 1: Material Transaction Input (Heavy in high-friction void tokens)
    material_tx = "GIMEL_MARKET_CAPITAL_ALLOCATION_SINK"
    success, manifest_material = dialect_parser.process_level3_lowering(material_tx, target_slot=42)
    
    # Test Payload 2: High Coherence Logic Input (Heavy in low-friction emission tokens)
    logic_block = "HE_RESH_AURA_RESONANCE_INITIALIZE"
    success, manifest_logic = dialect_parser.process_level3_lowering(logic_block, target_slot=108)
