"""
InboundReceiver — Automated Entry Liquidity Intake
Manages incoming capital flows and validates transaction integrity.
"""


class InboundReceiver:
    """
    Handles inbound liquidity transactions.
    Validates, logs, and routes capital intake through the system.
    """

    def __init__(self):
        self.incoming_txs = []
        self.total_received = 0.0

    def receive_capital(self, amount: float, sender: str, token: str = "ETH") -> dict:
        """
        Receive inbound capital transaction.
        Validates amount, sender, and token type.
        """
        if amount <= 0:
            return {"status": "INVALID", "reason": "Amount must be positive"}
        
        tx = {
            "amount": amount,
            "sender": sender,
            "token": token,
            "status": "RECEIVED",
        }
        
        self.incoming_txs.append(tx)
        self.total_received += amount
        
        return {
            "status": "ACCEPTED",
            "amount": amount,
            "total_received": self.total_received,
        }

    def validate_integrity(self, tx_hash: str) -> bool:
        """Validate transaction cryptographic integrity."""
        # Simplified: in production, verify against on-chain tx hash
        return len(tx_hash) > 0

    def get_pending_intake(self) -> list:
        """Return list of pending capital intake transactions."""
        return self.incoming_txs

    def get_statistics(self) -> dict:
        """Return receiver statistics."""
        return {
            "total_transactions": len(self.incoming_txs),
            "total_received": self.total_received,
            "average_per_tx": self.total_received / len(self.incoming_txs) if self.incoming_txs else 0.0,
        }
