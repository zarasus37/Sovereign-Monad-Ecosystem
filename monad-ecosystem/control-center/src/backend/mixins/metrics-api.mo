import Array "mo:base/Array";
import Types "../types/metrics";
import IntegrityTypes "../types/integrity";
import KafkaTypes "../types/kafka";
import MetricsLib "../lib/metrics";
import Queue "mo:core/Queue";
import Time "mo:core/Time";

mixin (
  metrics : { var cpuLoad : Nat; var memoryUsage : Nat; var uptime : Nat; var timestamp : Int },
  controls : { var armed : Bool; var primaryMode : Types.PrimaryMode; var secondaryMode : Types.SecondaryMode },
  config : { var pollingInterval : Nat; var cpuThreshold : Nat; var memoryThreshold : Nat; var responseDelay : Nat },
  activityLog : Queue.Queue<Types.LogEntry>,
  integrityReport : { var agents : [IntegrityTypes.IntegrityAgent]; var axioms : [IntegrityTypes.Axiom]; var overallScore : Nat; var lastAudit : Int },
  kafkaState : { var topics : [KafkaTypes.KafkaTopic]; var connections : [KafkaTypes.KafkaConnection]; var totalMessages : Nat },
  bootTime : Int,
) {

  func currentUptimeSeconds() : Nat {
    let elapsed = Time.now() - bootTime;
    if (elapsed <= 0) {
      0;
    } else {
      (elapsed / 1_000_000_000).toNat();
    };
  };

  /// Returns a snapshot of the current system metrics.
  public query func getMetrics() : async Types.Metrics {
    {
      cpuLoad     = metrics.cpuLoad;
      memoryUsage = metrics.memoryUsage;
      uptime      = if (metrics.uptime > 0) { metrics.uptime } else { currentUptimeSeconds() };
      timestamp   = metrics.timestamp;
    };
  };

  /// Returns the current control states.
  public query func getControls() : async Types.Controls {
    {
      armed         = controls.armed;
      primaryMode   = controls.primaryMode;
      secondaryMode = controls.secondaryMode;
    };
  };

  /// Returns the current configuration.
  public query func getConfig() : async Types.Config {
    {
      pollingInterval  = config.pollingInterval;
      cpuThreshold     = config.cpuThreshold;
      memoryThreshold  = config.memoryThreshold;
      responseDelay    = config.responseDelay;
    };
  };

  /// Returns the last up-to-8 activity log entries (oldest first).
  public query func getActivityLog() : async [Types.LogEntry] {
    activityLog.toArray();
  };

  /// Arms or disarms the system.
  public shared func setArmed(value : Bool) : async { #ok; #err : Text } {
    let oldVal = if (controls.armed) "true" else "false";
    let newVal = if (value) "true" else "false";
    controls.armed := value;
    MetricsLib.appendLog(
      activityLog,
      {
        timestamp = Time.now();
        action    = "setArmed";
        oldValue  = oldVal;
        newValue  = newVal;
      },
    );
    #ok;
  };

  /// Changes the primary operating mode.
  public shared func setPrimaryMode(mode : Types.PrimaryMode) : async { #ok; #err : Text } {
    let oldVal = primaryModeText(controls.primaryMode);
    let newVal = primaryModeText(mode);
    controls.primaryMode := mode;
    MetricsLib.appendLog(
      activityLog,
      {
        timestamp = Time.now();
        action    = "setPrimaryMode";
        oldValue  = oldVal;
        newValue  = newVal;
      },
    );
    #ok;
  };

  /// Changes the secondary operating mode.
  public shared func setSecondaryMode(mode : Types.SecondaryMode) : async { #ok; #err : Text } {
    let oldVal = secondaryModeText(controls.secondaryMode);
    let newVal = secondaryModeText(mode);
    controls.secondaryMode := mode;
    MetricsLib.appendLog(
      activityLog,
      {
        timestamp = Time.now();
        action    = "setSecondaryMode";
        oldValue  = oldVal;
        newValue  = newVal;
      },
    );
    #ok;
  };

  /// Updates configuration settings with validation.
  public shared func updateConfig(
    newCpuThreshold : Nat,
    newMemThreshold : Nat,
    newPollingInterval : Nat,
    newResponseDelay : Nat,
  ) : async { #ok; #err : Text } {
    if (not MetricsLib.validatePercent(newCpuThreshold)) {
      return #err("cpuThreshold must be between 1 and 99");
    };
    if (not MetricsLib.validatePercent(newMemThreshold)) {
      return #err("memoryThreshold must be between 1 and 99");
    };
    if (not MetricsLib.validateInterval(newPollingInterval)) {
      return #err("pollingInterval must be between 100 and 60000 ms");
    };
    if (newResponseDelay > 60000) {
      return #err("responseDelay must be at most 60000 ms");
    };
    let oldCfg = debug_show({
      cpu = config.cpuThreshold;
      mem = config.memoryThreshold;
      interval = config.pollingInterval;
      delay = config.responseDelay;
    });
    config.cpuThreshold    := newCpuThreshold;
    config.memoryThreshold := newMemThreshold;
    config.pollingInterval := newPollingInterval;
    config.responseDelay   := newResponseDelay;
    let newCfg = debug_show({
      cpu = config.cpuThreshold;
      mem = config.memoryThreshold;
      interval = config.pollingInterval;
      delay = config.responseDelay;
    });
    MetricsLib.appendLog(
      activityLog,
      {
        timestamp = Time.now();
        action    = "updateConfig";
        oldValue  = oldCfg;
        newValue  = newCfg;
      },
    );
    #ok;
  };

  /// Ingests a live agent status update from an external Python agent or watcher.
  public shared func updateAgentStatus(update : Types.AgentStatusUpdate) : async { #ok; #err : Text } {
    let newAgent : IntegrityTypes.IntegrityAgent = {
      name = update.agentName;
      domain = update.domain;
      integrityScore = update.integrityScore;
      axiomDrift = update.axiomDrift;
      status = update.status;
      lastCalibrated = update.lastCalibrated;
      alertLevel = update.alertLevel;
    };

    var replaced = false;
    let nextAgents = Array.map<IntegrityTypes.IntegrityAgent, IntegrityTypes.IntegrityAgent>(
      integrityReport.agents,
      func(agent : IntegrityTypes.IntegrityAgent) : IntegrityTypes.IntegrityAgent {
        if (agent.name == update.agentName) {
          replaced := true;
          newAgent;
        } else {
          agent;
        };
      },
    );

    integrityReport.agents := if (replaced) {
      nextAgents;
    } else {
      Array.append<IntegrityTypes.IntegrityAgent>(nextAgents, [newAgent]);
    };

    var total : Nat = 0;
    for (agent in integrityReport.agents.vals()) {
      total += agent.integrityScore;
    };
    integrityReport.overallScore := if (integrityReport.agents.size() == 0) { 0 } else { total / integrityReport.agents.size() };
    integrityReport.lastAudit := Time.now();

    switch (update.cpuLoad) {
      case (?cpu) { metrics.cpuLoad := cpu };
      case null {};
    };
    switch (update.memoryUsage) {
      case (?mem) { metrics.memoryUsage := mem };
      case null {};
    };
    switch (update.uptime) {
      case (?uptime) { metrics.uptime := uptime };
      case null {};
    };
    metrics.timestamp := Time.now();

    MetricsLib.appendLog(
      activityLog,
      {
        timestamp = Time.now();
        action    = "updateAgentStatus";
        oldValue  = update.agentName # "@" # update.source;
        newValue  = update.domain # " " # agentStatusText(update.status) # " score=" # Nat.toText(update.integrityScore);
      },
    );

    #ok;
  };

  /// Ingests a live Kafka/event-bus signal from an external agent or on-chain watcher.
  public shared func pushKafkaSignal(signal : Types.KafkaSignal) : async { #ok; #err : Text } {
    let newTopic : KafkaTypes.KafkaTopic = {
      id = signal.topicId;
      name = signal.topicName;
      description = signal.description;
      messageCount = signal.messageCountDelta;
      throughput = signal.throughput;
    };

    var replaced = false;
    let nextTopics = Array.map<KafkaTypes.KafkaTopic, KafkaTypes.KafkaTopic>(
      kafkaState.topics,
      func(topic : KafkaTypes.KafkaTopic) : KafkaTypes.KafkaTopic {
        if (topic.id == signal.topicId) {
          replaced := true;
          {
            id = topic.id;
            name = signal.topicName;
            description = signal.description;
            messageCount = topic.messageCount + signal.messageCountDelta;
            throughput = signal.throughput;
          };
        } else {
          topic;
        };
      },
    );

    kafkaState.topics := if (replaced) {
      nextTopics;
    } else {
      Array.append<KafkaTypes.KafkaTopic>(nextTopics, [newTopic]);
    };

    kafkaState.totalMessages += signal.messageCountDelta;
    metrics.timestamp := Time.now();

    MetricsLib.appendLog(
      activityLog,
      {
        timestamp = Time.now();
        action    = "pushKafkaSignal";
        oldValue  = signal.sourceAgent # " -> " # signal.topicId;
        newValue  = Nat.toText(signal.messageCountDelta) # " msgs @" # Nat.toText(signal.throughput) # " tps";
      },
    );

    #ok;
  };

  // --- helpers ---

  func agentStatusText(status : IntegrityTypes.AgentStatus) : Text {
    switch (status) {
      case (#active) "active";
      case (#advisory) "advisory";
      case (#gated) "gated";
      case (#offline) "offline";
    };
  };

  func primaryModeText(mode : Types.PrimaryMode) : Text {
    switch (mode) {
      case (#standby)    "standby";
      case (#active)     "active";
      case (#diagnostic) "diagnostic";
    };
  };

  func secondaryModeText(mode : Types.SecondaryMode) : Text {
    switch (mode) {
      case (#monitor)  "monitor";
      case (#control)  "control";
      case (#optimize) "optimize";
    };
  };
};
