import Types "../types/deployment";
import Common "../types/common";
import List "mo:core/List";
import DeployLib "../lib/deployment";

mixin (
  deploySteps : List.List<Types.DeployStep>,
  deployConfig : { var environment : Text; var networkId : Text; var deployedComponents : [Text]; var lastDeployTime : ?Int },
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
  public shared func markStepComplete(stepNumber : Nat) : async Common.Result<(), Text> {
    switch (DeployLib.markComplete(deploySteps, stepNumber)) {
      case (#ok(_)) #ok(());
      case (#err e) #err(e);
    };
  };

  /// Resets all deployment steps to #pending.
  public shared func resetDeployment() : async () {
    ignore DeployLib.resetAll(deploySteps);
  };
};
