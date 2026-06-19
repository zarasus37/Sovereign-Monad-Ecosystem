module {
  public type DeployStepStatus = {
    #pending;
    #running;
    #complete;
    #failed;
    #skipped;
  };

  public type DeployStep = {
    stepNumber : Nat;
    component : Text;
    command : Text;
    status : DeployStepStatus;
    description : Text;
    notes : ?Text;
  };

  public type DeploymentConfig = {
    environment : Text;
    networkId : Text;
    deployedComponents : [Text];
    lastDeployTime : ?Int;
  };
};
