import Types "../types/cost";

module {
  /// Returns the default cost model based on Sovereign Monad infrastructure.
  public func defaultModel() : Types.CostModel {
    {
      cyclesPerHour  = 5_000_000_000; // 5B cycles/hr
      rpcCallsPerHour = 3600;          // 1 call/sec
      gasFeePerTx    = 1_000_000;      // 0.001 ICP per tx in e8s
      agentCount     = 3;
      storageGB      = 10;
    };
  };

  /// Computes a cost estimate from the provided model.
  public func estimate(model : Types.CostModel) : Types.CostEstimate {
    // cycle cost: cycles/hr * 24hrs => daily cycles; 1T cycles ~ $0.13
    let dailyCycles = model.cyclesPerHour * 24;
    let cycleCost   = dailyCycles / 1_000_000_000_000; // in whole T-cycles
    // rpc cost: $0.001 per 100 calls -> scaled to cents
    let rpcCost = model.rpcCallsPerHour * 24 / 100;
    // gas: gasFeePerTx is in e8s; multiply by 10 estimated txs per day per agent
    let gasCost = model.gasFeePerTx * 10 * model.agentCount / 100_000_000;
    // storage: $0.23 / GB / month -> ~1 cent/GB/day
    let storageCost = model.storageGB;
    // total in cents -> truncated to whole dollars for simplicity
    let totalCents = cycleCost + rpcCost + gasCost + storageCost;
    let totalUsd   = totalCents / 100;
    // ICP at ~$8 => totalUsd * 100 / 800 = totalUsd / 8
    let totalIcp   = if (totalUsd == 0) 0 else totalUsd / 8;
    {
      cycleCost;
      rpcCost;
      gasCost;
      storageCost;
      totalCostUsd = totalUsd;
      totalCostIcp = totalIcp;
    };
  };
};
