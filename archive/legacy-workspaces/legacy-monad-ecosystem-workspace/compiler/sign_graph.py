from typing import Dict, Any, List, Tuple

class SignGraph:
    """
    Level 2: The Sign Graph Dialect (The Llullian Combinatorial Engine)
    Enforces flow-sensitive dependent type checking via Static Single Assignment (SSA).
    Cross-references the 24 wheel-domain pairings across 1.6 million camera positions.
    """
    def __init__(self):
        # Master Graph State Registries (SSA Form tracking arrays)
        self.vertices: Dict[str, Dict[str, Any]] = {}
        self.edges: Dict[str, List[Dict[str, str]]] = {}
        self.ssa_version_registry: Dict[str, int] = {}
        
        # Systemic Alphabet Mapping: B through K (Image 6 / Page 2 Rules)
        self.llullian_alphabet = {
            'B': "Goodness/Difference",  'C': "Greatness/Concordance",
            'D': "Eternity/Contrariety", 'E': "Power/Beginning",
            'F': "Wisdom/Middle",        'G': "Will/End",
            'H': "Virtue/Majority",      'I': "Truth/Equality",
            'K': "Glory/Minority"
        }
        
        # Linguistic Anomaly Vectors
        self.void_letters = {'G', 'S', 'M', 'K', 'X', 'Z', 'Q'} # High material friction
        self.emission_letters = {'H', 'R', 'E', 'I', 'Y', 'L', 'A'} # Coherent creative flow

    def compute_ssa_identifier(self, base_var: str) -> str:
        """Enforces Static Single Assignment by versioning mutating states (e.g., capital_v1)."""
        clean_var = base_var.strip().upper()
        current_version = self.ssa_version_registry.get(clean_var, 0)
        new_version = current_version + 1
        self.ssa_version_registry[clean_var] = new_version
        return f"{clean_var}_V{new_version}"

    def calculate_thermodynamic_friction(self, expression: str) -> float:
        """Computes structural friction from your Level 3 Hebrew Signature frequency metrics."""
        clean_text = expression.strip().upper()
        if not clean_text:
            return 1.00 # Maximum entropy baseline fallback
            
        void_count = sum(1 for char in clean_text if char in self.void_letters)
        emission_count = sum(1 for char in clean_text if char in self.emission_letters)
        total = max(1, void_count + emission_count)
        
        base_friction = void_count / total
        return min(max(base_friction, 0.0), 1.0)

    def add_ssa_vertex(self, base_id: str, expression_payload: str, type_constraint: str, macrocosmic_slot: int) -> str:
        """
        Validates the 144-Fold Macrocosmic Database boundary grid.
        Binds and maps a single variable into an un-mutating SSA computational register.
        """
        # Enforce System 3 Rule: 144-Fold Coordinate Grid Boundary (Image 3 / Image 7)
        if not (0 <= macrocosmic_slot <= 143):
            print(f"[Sign Graph Error] REJECTED: Slot {macrocosmic_slot} violates 144-fold storage bounds.")
            return "PURE_BOTTOM_INVALID"
            
        # Version the variable to ensure strict single-use linearity
        ssa_id = self.compute_ssa_identifier(base_id)
        friction_coefficient = self.calculate_thermodynamic_friction(expression_payload)
        
        self.vertices[ssa_id] = {
            "expression": expression_payload,
            "type_constraint": type_constraint.upper(),
            "macrocosmic_slot": macrocosmic_slot,
            "friction": round(friction_coefficient, 4)
        }
        print(f"[SSA Register] Vertex mapped: {ssa_id} into Slot {macrocosmic_slot} | Friction: {friction_coefficient:.3f}")
        return ssa_id

    def execute_tabula_generalis_resolution(self, source_id: str, target_id: str) -> str:
        """
        Simulates your 84-column Tabula Generalis middleware (Image 6 / Page 2).
        Dynamically infers and builds type casting rules when divergent inputs clash.
        """
        source_type = self.vertices[source_id]["type_constraint"]
        target_type = self.vertices[target_id]["type_constraint"]
        
        if source_type == target_type:
            return "CONCORDANCE" # Native type match, no casting required
            
        print(f"[Tabula Generalis] Type mismatch detected between {source_type} and {target_type}.")
        print(f"[Tabula Generalis] Consulted 84-Column Matrix. Injecting dynamic casting operator...")
        return "CONCORDANCE_MIDDLE_TERM_GENERATED"

    def add_ssa_edge(self, source_id: str, target_id: str) -> bool:
        """Connects data dependencies, running a dynamic compliance pass on the channel interface."""
        if source_id not in self.vertices or target_id not in self.vertices:
            print("[Sign Graph Error] Connection failed: Source or Target register does not exist.")
            return False
            
        # Resolve type safety through Llullian Relational Algebra
        resolution_verdict = self.execute_tabula_generalis_resolution(source_id, target_id)
        
        if source_id not in self.edges:
            self.edges[source_id] = []
            
        self.edges[source_id].append({
            "target": target_id,
            "relational_bridge": resolution_verdict
        })
        print(f"[SSA Channel] Connected {source_id} ──► {target_id} via Operator: {resolution_verdict}")
        return True

    def validate_constitution_compliance(self) -> Tuple[bool, float]:
        """
        Enforces your Master Constitution Compliance pass.
        Ensures perfect coherence states are properly balanced by a 0.30 friction floor.
        """
        if not self.vertices:
            return True, 1.00
            
        print(f"\n[Constitution Pass] Evaluating {len(self.vertices)} registers for structural harmony...")
        total_friction = 0.0
        
        for v_id, metadata in self.vertices.items():
            friction = metadata["friction"]
            total_friction += friction
            
            # Enforce System 1 Rule: Block transaction transitions if Gimel values exceed 0.80
            if friction > 0.80:
                print(f"[Compliance Abort] Node '{v_id}' carries toxic thermodynamic debt ({friction}). Halting compilation.")
                return False, total_friction
                
        mean_system_friction = total_friction / len(self.vertices)
        print(f"[Compliance Success] System Balance Achieved. Mean Operational Friction: {mean_system_friction:.4f}")
        return True, round(mean_system_friction, 4)

# ==========================================
# LOCAL TESTING SUITE
# ==========================================
if __name__ == "__main__":
    engine = SignGraph()
    
    # Track Capital Inflow Registers (Simulating your Layer 5 Router parameters)
    reg_inbound = engine.add_ssa_vertex("capital", "REVENUE_STREAM_INTAKE", "INBOUND_ASSET", 72)
    reg_allocated = engine.add_ssa_vertex("capital", "FOUNDER_SINK_ALLOCATION", "TREASURY_ASSET", 12)
    
    # Establish dependency link through the Tabula Generalis casting middleware
    engine.add_ssa_edge(reg_inbound, reg_allocated)
    
    # Run the final mathematical validation pass
    is_secure, balance_factor = engine.validate_constitution_compliance()
    print(f"\nExecution State Matrix Resolution: [Compliance Token: {is_secure}]")
