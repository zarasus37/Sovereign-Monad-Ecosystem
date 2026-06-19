"""
12-Voice Adversarial Reflection Matrix
Council of agents providing independent verification and reflection.
"""


class VoiceMatrix:
    """
    Implements 12-voice adversarial reflection.
    Each voice provides independent assessment; majority consensus required.
    """

    def __init__(self):
        self.voices = {f"voice_{i:02d}": {"position": None, "confidence": 0.0} for i in range(1, 13)}
        self.consensus_log = []

    def voice_position(self, voice_id: str, position: bool, confidence: float) -> dict:
        """Register a voice's position and confidence."""
        if voice_id not in self.voices:
            return {"status": "INVALID", "reason": f"Unknown voice: {voice_id}"}
        
        self.voices[voice_id] = {
            "position": position,
            "confidence": confidence,
        }
        return {"status": "REGISTERED", "voice": voice_id}

    def compute_consensus(self) -> dict:
        """Compute consensus from all 12 voices."""
        if not any(v["position"] is not None for v in self.voices.values()):
            return {"consensus": "NO_DATA", "agreement": 0.0}
        
        positions = [v["position"] for v in self.voices.values() if v["position"] is not None]
        avg_confidence = sum(v["confidence"] for v in self.voices.values()) / len(self.voices)
        
        if not positions:
            return {"consensus": "ABSTAIN", "agreement": 0.0}
        
        agreement = sum(positions) / len(positions)
        consensus = "APPROVE" if agreement > 0.66 else "REJECT"
        
        return {
            "consensus": consensus,
            "agreement": round(agreement, 3),
            "avg_confidence": round(avg_confidence, 3),
        }

    def log_consensus(self, decision: dict):
        """Log consensus decision for historical tracking."""
        self.consensus_log.append(decision)
