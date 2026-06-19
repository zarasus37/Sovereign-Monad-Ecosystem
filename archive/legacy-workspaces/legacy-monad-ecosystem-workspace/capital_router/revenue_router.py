"""
RevenueRouter — Programmatic Payout Distribution
Implements 40/25/10/5/5 distribution philosophy.
Routes capital through treasury, ops, delegate pools, and ecosystem development.
"""


class RevenueRouter:
    """
    Routes revenue according to canonical distribution:
    - 40% → Treasury (reserves & stability)
    - 25% → MEV/Operations (engine execution)
    - 10% → Ecosystem Development
    - 5% → Delegate Pools
    - 5% → Founder / Origination Attribution
    
    Remaining flows: governance, data rail, other pools.
    """

    DISTRIBUTION = {
        "treasury": 0.40,
        "mev_operations": 0.25,
        "ecosystem_development": 0.10,
        "delegate_pools": 0.05,
        "founder_attribution": 0.05,
    }

    def __init__(self):
        self.allocations = {k: 0.0 for k in self.DISTRIBUTION.keys()}
        self.routing_log = []

    def route_revenue(self, amount: float) -> dict:
        """
        Route incoming revenue according to distribution policy.
        Returns allocation breakdown.
        """
        if amount <= 0:
            return {"status": "INVALID", "reason": "Amount must be positive"}
        
        allocation = {}
        for pool, ratio in self.DISTRIBUTION.items():
            alloc_amount = amount * ratio
            allocation[pool] = alloc_amount
            self.allocations[pool] += alloc_amount
        
        route_record = {
            "input_amount": amount,
            "allocation": allocation,
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        }
        
        self.routing_log.append(route_record)
        
        return {
            "status": "ROUTED",
            "allocation": allocation,
        }

    def get_allocation_status(self) -> dict:
        """Return current allocation balances."""
        return {
            "allocations": self.allocations,
            "total_routed": sum(self.allocations.values()),
        }

    def get_routing_history(self, limit: int = 10) -> list:
        """Return recent routing history (last N transactions)."""
        return self.routing_log[-limit:]

    def get_policy(self) -> dict:
        """Return canonical distribution policy."""
        return {
            "policy_name": "Sovereign Distribution v1",
            "distribution": self.DISTRIBUTION,
            "philosophy": "Maximal Extracted Value with Alignment",
        }
