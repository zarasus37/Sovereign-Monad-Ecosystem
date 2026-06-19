module {
  public type BuildStatus = {
    #done;
    #partial;
    #blocked;
    #notStarted;
  };

  public type BuildArea = {
    id : Text;
    name : Text;
    layer : Nat;
    status : BuildStatus;
    completionPct : Nat;
  };

  public type BuildSummary = {
    majorAreas : Nat;
    majorDone : Nat;
    layerItems : Nat;
    layerDone : Nat;
    lastUpdated : Int;
  };

  public type BuildPipeline = {
    areas : [BuildArea];
    summary : BuildSummary;
  };
};
