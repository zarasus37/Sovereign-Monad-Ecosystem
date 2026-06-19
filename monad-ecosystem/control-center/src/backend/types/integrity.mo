module {
  public type AgentStatus = {
    #active;
    #advisory;
    #gated;
    #offline;
  };

  public type AlertLevel = {
    #nominal;
    #caution;
    #warning;
    #critical;
  };

  public type IntegrityAgent = {
    name : Text;
    domain : Text;
    integrityScore : Nat;
    axiomDrift : Nat;
    status : AgentStatus;
    lastCalibrated : Text;
    alertLevel : AlertLevel;
  };

  public type Axiom = {
    id : Text;
    name : Text;
    description : Text;
    complianceRate : Nat;
    driftDetected : Bool;
  };

  public type IntegrityReport = {
    agents : [IntegrityAgent];
    axioms : [Axiom];
    overallScore : Nat;
    lastAudit : Int;
  };
};
