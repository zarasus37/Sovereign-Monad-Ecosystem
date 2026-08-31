import Types "../types/cost";
import Common "../types/common";
import CostLib "../lib/cost";
import Operators "../lib/operators";

/// P0: updateCostModel takes `shared(msg)`, rejects the anonymous caller,
/// and verifies the caller is in the operator allowlist before mutating.
mixin (
  costModelState : { var cyclesPerHour : Nat; var rpcCallsPerHour : Nat; var gasFeePerTx : Nat; var agentCount : Nat; var storageGB : Nat },
  operators : [Principal],
) {
  /// Returns the current cost model parameters.
  public query func getCostModel() : async Types.CostModel {
    {
      cyclesPerHour   = costModelState.cyclesPerHour;
      rpcCallsPerHour = costModelState.rpcCallsPerHour;
      gasFeePerTx     = costModelState.gasFeePerTx;
      agentCount      = costModelState.agentCount;
      storageGB       = costModelState.storageGB;
    };
  };

  /// Estimates cost from the provided model (does not persist state).
  public query func estimateCost(model : Types.CostModel) : async Types.CostEstimate {
    CostLib.estimate(model);
  };

  /// Persists updated cost model parameters.
  public shared(msg) func updateCostModel(model : Types.CostModel) : async Common.Result<(), Text> {
    switch (Operators.checkCaller(msg.caller)) {
      case (?err) return #err(err);
      case null {};
    };
    if (not Operators.isOperator(msg.caller, operators)) {
      return #err(Operators.notOperatorErr());
    };
    costModelState.cyclesPerHour   := model.cyclesPerHour;
    costModelState.rpcCallsPerHour := model.rpcCallsPerHour;
    costModelState.gasFeePerTx     := model.gasFeePerTx;
    costModelState.agentCount      := model.agentCount;
    costModelState.storageGB       := model.storageGB;
    #ok(());
  };
};
