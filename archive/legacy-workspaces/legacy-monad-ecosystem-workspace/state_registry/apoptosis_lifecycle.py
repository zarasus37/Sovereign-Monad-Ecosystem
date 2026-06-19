"""
Apoptosis Lifecycle — Programmed Cleanup & Isolation Logic
Manages lifecycle of states scoring < 0.72 authenticity.
Implements 30-day review period before permanent deletion or recalibration.
"""

from datetime import datetime, timedelta


class ApoptosisLifecycle:
    """
    Manages the lifecycle of low-authenticity states.
    Threshold: 0.72 — states below this trigger 30-day isolation.
    After 30 days: review decision (delete, recalibrate, or restore).
    """

    def __init__(self, threshold: float = 0.72):
        self.threshold = threshold
        self.isolated_states = {}  # state_id → isolation_record
        self.review_queue = []

    def trigger_isolation(self, state_id: str, authenticity_score: float) -> dict:
        """Trigger isolation for a low-authenticity state."""
        if authenticity_score >= self.threshold:
            return {"status": "NO_ACTION", "reason": "Score above threshold"}
        
        isolation_date = datetime.now()
        review_date = isolation_date + timedelta(days=30)
        
        self.isolated_states[state_id] = {
            "state_id": state_id,
            "authenticity_score": authenticity_score,
            "isolation_date": isolation_date.isoformat(),
            "review_date": review_date.isoformat(),
            "status": "ISOLATED",
        }
        
        self.review_queue.append(state_id)
        
        return {
            "status": "ISOLATED",
            "state_id": state_id,
            "review_date": review_date.isoformat(),
        }

    def check_ready_for_review(self) -> list:
        """Return list of states ready for review (30 days elapsed)."""
        now = datetime.now()
        ready = []
        for state_id in self.review_queue:
            if state_id in self.isolated_states:
                review_date_str = self.isolated_states[state_id]["review_date"]
                review_date = datetime.fromisoformat(review_date_str)
                if now >= review_date:
                    ready.append(state_id)
        return ready

    def review_isolated_state(self, state_id: str, decision: str) -> dict:
        """
        Review an isolated state after 30 days.
        decision: "DELETE", "RECALIBRATE", or "RESTORE"
        """
        if state_id not in self.isolated_states:
            return {"status": "NOT_FOUND"}
        
        isolation_record = self.isolated_states[state_id]
        isolation_record["review_decision"] = decision
        isolation_record["review_date_actual"] = datetime.now().isoformat()
        isolation_record["status"] = f"REVIEWED_{decision}"
        
        if decision == "DELETE":
            del self.isolated_states[state_id]
        
        return {
            "status": "REVIEWED",
            "state_id": state_id,
            "decision": decision,
        }

    def get_isolation_status(self) -> dict:
        """Return current isolation queue status."""
        return {
            "total_isolated": len(self.isolated_states),
            "review_queue_length": len(self.review_queue),
            "ready_for_review": len(self.check_ready_for_review()),
        }
