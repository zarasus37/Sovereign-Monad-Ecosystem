module {
  public type CostModel = {
    cyclesPerHour : Nat;
    rpcCallsPerHour : Nat;
    gasFeePerTx : Nat;
    agentCount : Nat;
    storageGB : Nat;
  };

  public type CostEstimate = {
    cycleCost : Nat;
    rpcCost : Nat;
    gasCost : Nat;
    storageCost : Nat;
    totalCostUsd : Nat;
    totalCostIcp : Nat;
  };
};
