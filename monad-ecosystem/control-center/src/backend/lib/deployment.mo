import Types "../types/deployment";
import List "mo:core/List";

module {
  /// Returns the canonical Sovereign Monad deployment steps.
  public func defaultSteps() : List.List<Types.DeployStep> {
    let steps : [Types.DeployStep] = [
      { stepNumber = 1; component = "ICP Canister"; command = "dfx deploy backend"; status = #pending; description = "Deploy the Sovereign Monad backend canister to the IC"; notes = ?"Requires dfx identity with cycles" },
      { stepNumber = 2; component = "Kafka Broker"; command = "docker compose up -d kafka"; status = #pending; description = "Start Kafka broker for inter-agent messaging"; notes = null },
      { stepNumber = 3; component = "Synapse Agent"; command = "docker compose up -d synapse"; status = #pending; description = "Launch Synapse pattern-analysis agent"; notes = ?"Depends on Kafka broker" },
      { stepNumber = 4; component = "Vox Agent"; command = "docker compose up -d vox"; status = #pending; description = "Launch Vox narrative-output agent"; notes = ?"Depends on Kafka broker" },
      { stepNumber = 5; component = "Pneuma Agent"; command = "docker compose up -d pneuma"; status = #pending; description = "Launch Pneuma axiom-preservation agent"; notes = ?"Depends on Synapse and Vox" },
      { stepNumber = 6; component = "Gnosis Layer"; command = "docker compose up -d gnosis"; status = #pending; description = "Activate Gnosis Integrity Layer audit daemon"; notes = null },
      { stepNumber = 7; component = "Frontend"; command = "dfx deploy frontend"; status = #pending; description = "Deploy Control Center frontend canister"; notes = null },
    ];
    let list = List.empty<Types.DeployStep>();
    for (step in steps.values()) {
      list.add(step);
    };
    list;
  };

  /// Returns the default deployment configuration.
  public func defaultConfig() : Types.DeploymentConfig {
    {
      environment        = "production";
      networkId          = "ic";
      deployedComponents = [];
      lastDeployTime     = null;
    };
  };

  /// Marks a step complete by step number. Returns updated list or error.
  public func markComplete(
    steps : List.List<Types.DeployStep>,
    stepNumber : Nat,
  ) : { #ok : List.List<Types.DeployStep>; #err : Text } {
    var found = false;
    steps.mapInPlace(
      func(s) {
        if (s.stepNumber == stepNumber) {
          found := true;
          { s with status = #complete };
        } else s;
      }
    );
    if (found) #ok(steps) else #err("Step " # debug_show stepNumber # " not found");
  };

  /// Resets all steps to #pending.
  public func resetAll(steps : List.List<Types.DeployStep>) : List.List<Types.DeployStep> {
    steps.mapInPlace(func(s) { { s with status = #pending } });
    steps;
  };
};
