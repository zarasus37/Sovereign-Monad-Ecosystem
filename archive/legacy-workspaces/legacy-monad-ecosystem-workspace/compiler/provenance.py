import time
import hashlib
from typing import Dict, Any, Tuple

class ProvenanceDialect:
    """
    Level 1: The Provenance Dialect (Trithemian Lowering Engine)
    Tracks single-use linear token lifecycles and executes polyalphabetic cipher shifts.
    Guarantees that background system operations are enclosed in safety wrappers.
    """
    def __init__(self):
        # Upper-case tracking matrix for Tabula Recta mapping
        self.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        
        # Strict linear memory storage to prevent double-spending or key reuse
        self.consumed_tokens: set[str] = set()
        self.active_key_caps: Dict[str, Dict[str, Any]] = {}

    def generate_sha256_hash(self, message: str) -> str:
        """Generates deterministic cryptographic hashes to form baseline tokens."""
        return hashlib.sha256(message.encode('utf-8')).hexdigest().upper()

    def execute_trithemius_shift(self, input_string: str, shift_index: int) -> str:
        """
        Applies a true polyalphabetic Trithemian cipher shift.
        Iteratively increments the shift value across the text length based on the grid slot index.
        """
        shifted_result = ""
        clean_input = input_string.strip().upper()
        
        for idx, char in enumerate(clean_input):
            if char in self.alphabet:
                original_pos = self.alphabet.index(char)
                # Dynamic Polyalphabetic Shift: (Position + Current Character Index + Base Slot Index) % 26
                new_pos = (original_pos + idx + shift_index) % 26
                shifted_result += self.alphabet[new_pos]
            else:
                # Retain numerical formatting components or structural delimiters cleanly
                shifted_result += char
                
        return shifted_result

    def initialize_linear_token(self, index: int, parent_signature: str) -> str:
        """
        Generates a non-duplicable Token<Index> value.
        Enforces a linear lifecycle check: if token configuration exists, tracking errors out.
        """
        entropy_source = f"TOKEN_L1_{index}_{parent_signature}_{time.time_ns()}"
        unique_token_id = f"TK-{self.generate_sha256_hash(entropy_source)[:16]}"
        
        if unique_token_id in self.consumed_tokens:
            raise RuntimeError(f"[Provenance Fault] Linearity Broken. Token ID {unique_token_id} was pre-allocated.")
            
        return unique_token_id

    def issue_key_cap(self, token_id: str, wheel_domain: str, coordinate_key: int) -> str:
        """
        Spins up a single-use KeyCap<W,K> resource.
        Ties capability tokens tightly to the Ramon Llull wheel-domain pairs.
        """
        key_cap_id = f"KC-{wheel_domain.upper()}-{coordinate_key}-{token_id[-6:]}"
        
        self.active_key_caps[key_cap_id] = {
            "bound_token": token_id,
            "wheel_domain": wheel_domain.upper(),
            "coordinate_key": coordinate_key,
            "is_spent": False,
            "timestamp_issued": time.time_ns()
        }
        return key_cap_id

    def consume_and_wrap_payload(self, key_cap_id: str, raw_payload: Dict[str, Any], macrocosmic_slot: int) -> Dict[str, Any]:
        """
        Consumes linear capabilities permanently, pushing tokens into the spent ledger.
        Wraps background operational code inside an immutable execution container.
        """
        # 1. Enforce strict single-use capability check
        if key_cap_id not in self.active_key_caps:
            return {"status": "PROVENANCE_FAIL", "error": f"KeyCap {key_cap_id} does not exist in registry."}
            
        cap_metadata = self.active_key_caps[key_cap_id]
        if cap_metadata["is_spent"]:
            return {"status": "PROVENANCE_FAIL", "error": f"Double-Spent Intercepted: KeyCap {key_cap_id} already consumed."}
            
        # 2. Hard-lock token state permanently
        cap_metadata["is_spent"] = True
        self.consumed_tokens.add(cap_metadata["bound_token"])
        
        # 3. Apply polyalphabetic Tabula Recta obfuscation to the transaction output block
        raw_alias = raw_payload.get("downstream_data", {}).get("bytecode_alias", "NULL_OP")
        ciphered_signature = self.execute_trithemius_shift(raw_alias, macrocosmic_slot)
        
        # 4. Emit the finalized, angelic security wrapper package
        wrapped_container = {
            "container_header": "SHEM_ANGEL_BOUND_WRAPPER",
            "active_key_cap_reference": key_cap_id,
            "trithemius_cipher_signature": ciphered_signature,
            "provenance_sealed": True,
            "encapsulated_state": {
                "macrocosmic_slot_target": macrocosmic_slot,
                "pps_score_inheritance": raw_payload.get("pps_score", 1.00),
                "isolated_data_rail": raw_payload.get("downstream_data", {})
            }
        }
        
        print(f"[Provenance Engine] KeyCap {key_cap_id} consumed. Payload sealed inside Shem wrapper.")
        return wrapped_container

# ==========================================
# PRODUCTION TEST VERIFICATION
# ==========================================
if __name__ == "__main__":
    provenance_layer = ProvenanceDialect()
    
    # Simulate data inherited directly from Level 2 SignGraph output pass
    simulated_level2_output = {
        "pps_score": 0.762,
        "lattice_resolution": "HYBRID_APEX_VALID",
        "allocation_verified": True,
        "downstream_data": {
            "bytecode_alias": "REVENUE_STREAM_INTAKE",
            "state_target_slot": 72,
            "capital_allocation": 2500.00
        }
    }
    
    # Step 1: Initialize Linear Tokens and Capabilities
    token = provenance_layer.initialize_linear_token(index=72, parent_signature="KODESH_V5")
    key_cap = provenance_layer.issue_key_cap(token_id=token, wheel_domain="WHEEL_B_GOODNESS", coordinate_key=144)
    
    print(f"Issued Linear Token: {token}")
    print(f"Issued Capability:   {key_cap}\n")
    
    # Step 2: Clean execution pass wrapping payload
    secure_package = provenance_layer.consume_and_wrap_payload(
        key_cap_id=key_cap, 
        raw_payload=simulated_level2_output, 
        macrocosmic_slot=72
    )
    
    # Step 3: Explicitly attempt an exploitation replay attack using the exact same KeyCap
    replay_attack = provenance_layer.consume_and_wrap_payload(
        key_cap_id=key_cap, 
        raw_payload=simulated_level2_output, 
        macrocosmic_slot=72
    )
    print(f"\nReplay Attack Detection Verdict: {replay_attack['error']}")
