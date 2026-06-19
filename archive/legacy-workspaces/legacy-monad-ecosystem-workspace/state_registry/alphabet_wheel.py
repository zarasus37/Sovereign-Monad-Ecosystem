"""
Alphabet Wheel — Ramon Llull 144-Fold Combinatorial Matrix
Digitizes the Ars Combinatoria principles into a computable state space.
"""

import json


class AlphabetWheel:
    """
    Implements the 144-element Llull alphabet matrix.
    B = 9 elements × K = 16 elements = 144 combinations.
    Used for state enumeration and symbolic ground truth.
    """

    # Base Llull B-set (9 divine attributes)
    B_SET = [
        "Goodness", "Greatness", "Eternity", "Power",
        "Wisdom", "Will", "Virtue", "Truth", "Glory"
    ]

    # Llull K-set (16 divine questions/principles)
    K_SET = [
        "What", "Why", "How", "Whence", "Whither",
        "When", "Whether", "Degree", "Opposition",
        "Beginning", "Middle", "End", "Conjunction",
        "Division", "Union", "Harmony"
    ]

    def __init__(self):
        self.matrix = self._generate_matrix()

    def _generate_matrix(self) -> dict:
        """Generate all 144 B×K combinations."""
        matrix = {}
        idx = 0
        for b_elem in self.B_SET:
            for k_elem in self.K_SET:
                matrix[idx] = {
                    "index": idx,
                    "B_attribute": b_elem,
                    "K_principle": k_elem,
                    "combination": f"{b_elem}_{k_elem}",
                }
                idx += 1
        return matrix

    def get_state(self, index: int) -> dict:
        """Retrieve state by combinatorial index."""
        return self.matrix.get(index, None)

    def find_by_attribute(self, b_elem: str) -> list:
        """Find all states containing a B attribute."""
        return [s for s in self.matrix.values() if s["B_attribute"] == b_elem]

    def find_by_principle(self, k_elem: str) -> list:
        """Find all states containing a K principle."""
        return [s for s in self.matrix.values() if s["K_principle"] == k_elem]

    def export_to_json(self, filepath: str):
        """Export matrix to JSON file."""
        with open(filepath, "w") as f:
            json.dump(self.matrix, f, indent=2)

    def get_statistics(self) -> dict:
        """Return matrix statistics."""
        return {
            "total_states": len(self.matrix),
            "b_set_size": len(self.B_SET),
            "k_set_size": len(self.K_SET),
            "combination_count": len(self.B_SET) * len(self.K_SET),
        }
