import Types "../types/deployment";
import Common "../types/common";
import List "mo:core/List";
import DeployLib "../lib/deployment";
import Operators "../lib/operators";

/// P0: every public shared mutator in this mixin takes `shared(msg)`,
/// rejects the anonymous caller, and verifies the caller is in the
/// operator allowlist before any state change.
///
/// `resetDeployment` returns Common.Result<(), Text> (was `()`) so an
/// auth failure is observable on the wire — frontend updates to match.
mixin (
  deploySteps : List.List<Types.DeployStep>,
  deployConfig : { var environment : Text; var networkId : Text; var deployedComponents : [Text]; var lastDeployTime : ?Int },
  operators : [Principal],
) {
  /// Returns all deployment steps in order.
  public query func getDeploymentSteps() : async [Types.DeployStep] {
    deploySteps.toArray();
  };

  /// Returns the current deployment configuration.
  public query func getDeploymentConfig() : async Types.DeploymentConfig {
    {
      environment        = deployConfig.environment;
      networkId          = deployConfig.networkId;
      deployedComponents = deployConfig.deployedComponents;
      lastDeployTime     = deployConfig.lastDeployTime;
    };
  };

  /// Marks a step complete by step number.
  public shared(msg) func markStepComplete(stepNumber : Nat) : async Common.Result<(), Text> {
    switch (Operators.checkCaller(msg.caller)) {
      case (?err) return #err(err);
      case null {};
    };
    if (not Operators.isOperator(msg.caller, operators)) {
      return #err(Operators.notOperatorErr());
    };
    switch (DeployLib.markComplete(deploySteps, stepNumber)) {
      case (#ok(_)) #ok(());
      case (#err e) #err(e);
    };
  };

  /// Resets all deployment steps to #pending.
  public shared(msg) func resetDeployment() : async Common.Result<(), Text> {
    switch (Operators.checkCaller(msg.caller)) {
      case (?err) return #err(err);
      case null {};
    };
    if (not Operators.isOperator(msg.caller, operators)) {
      return #err(Operators.notOperatorErr());
    };
    ignore DeployLib.resetAll(deploySteps);
    #ok(());
  };
};
