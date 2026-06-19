import IntegrityTypes "integrity";

module {
  public type Metrics = {
    cpuLoad : Nat;
    memoryUsage : Nat;
    uptime : Nat;
    timestamp : Int;
  };

  public type PrimaryMode = {
    #standby;
    #active;
    #diagnostic;
  };

  public type SecondaryMode = {
    #monitor;
    #control;
    #optimize;
  };

  public type Controls = {
    armed : Bool;
    primaryMode : PrimaryMode;
    secondaryMode : SecondaryMode;
  };

  public type Config = {
    pollingInterval : Nat;
    cpuThreshold : Nat;
    memoryThreshold : Nat;
    responseDelay : Nat;
  };

  public type LogEntry = {
    timestamp : Int;
    action : Text;
    oldValue : Text;
    newValue : Text;
  };

  public type AgentStatusUpdate = {
    agentName : Text;
    domain : Text;
    status : IntegrityTypes.AgentStatus;
    alertLevel : IntegrityTypes.AlertLevel;
    integrityScore : Nat;
    axiomDrift : Nat;
    lastCalibrated : Text;
    cpuLoad : ?Nat;
    memoryUsage : ?Nat;
    uptime : ?Nat;
    source : Text;
  };

  public type KafkaSignal = {
    sourceAgent : Text;
    topicId : Text;
    topicName : Text;
    description : Text;
    messageCountDelta : Nat;
    throughput : Nat;
  };
};
