"""
Personality Vectors — NEO-PI-R & HEXACO Trait Encoding
Maps psychometric profiles into operational agent vectors.
"""


class PersonalityVectors:
    """
    Encodes personality traits (NEO-PI-R: OCEAN + HEXACO extensions).
    Returns operational vectors for agent activation and navigation guidance.
    """

    # NEO-PI-R dimensions
    TRAITS = {
        "O": "Openness",           # Openness to Experience
        "C": "Conscientiousness",  # Conscientiousness
        "E": "Extraversion",       # Extraversion
        "A": "Agreeableness",      # Agreeableness
        "N": "Neuroticism",        # Neuroticism
    }

    def __init__(self):
        self.profile = {trait: 0.5 for trait in self.TRAITS.keys()}

    def set_trait(self, trait: str, value: float) -> dict:
        """Set a trait value (0-1)."""
        if trait not in self.TRAITS:
            return {"status": "INVALID", "reason": f"Unknown trait: {trait}"}
        
        self.profile[trait] = max(0.0, min(1.0, value))
        return {"status": "SET", "trait": trait, "value": self.profile[trait]}

    def get_vector(self) -> list:
        """Return trait vector as ordered list."""
        return [self.profile[t] for t in sorted(self.TRAITS.keys())]

    def compute_authenticity_score(self) -> float:
        """
        Authenticity = consistency of trait expression.
        High variance = low authenticity; low variance = high consistency.
        """
        values = self.get_vector()
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        # Map variance to authenticity (lower variance = higher authenticity)
        authenticity = 1.0 - min(variance, 1.0)
        return round(authenticity, 3)

    def get_profile_summary(self) -> dict:
        """Return comprehensive profile summary."""
        return {
            "traits": self.profile,
            "vector": self.get_vector(),
            "authenticity_score": self.compute_authenticity_score(),
        }
