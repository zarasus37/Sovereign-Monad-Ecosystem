import Types "types/metrics";
import MetricsApi "mixins/metrics-api";
import IntegrityApi "mixins/integrity-api";
import PipelineApi "mixins/pipeline-api";
import KafkaApi "mixins/kafka-api";
import SkillsApi "mixins/skills-api";
import CostApi "mixins/cost-api";
import DeploymentApi "mixins/deployment-api";
import IntegrityTypes "types/integrity";
import PipelineTypes "types/pipeline";
import KafkaTypes "types/kafka";
import SkillsTypes "types/skills";
import IntegrityLib "lib/integrity";
import PipelineLib "lib/pipeline";
import KafkaLib "lib/kafka";
import SkillsLib "lib/skills";
import CostLib "lib/cost";
import DeploymentLib "lib/deployment";
import Queue "mo:core/Queue";
import Time "mo:core/Time";
import Principal "mo:base/Principal";

/// P0 caller-check operator allowlist.
///
/// Seeded as `[]` (no operators). Every state-mutating public function in
/// mixins/ takes `shared(msg)`, rejects the anonymous principal, and
/// refuses to mutate unless `msg.caller` is in this list. With an empty
/// list, no one can call the mutators — the correct fail-closed default
/// for a canister that is not yet deployed (or for which operators have
/// not yet been provisioned).
///
/// PHASE 2 (deferred — canister is not deployed, see
/// `lib/operators.mo` header and `mixins/*` doc comments):
/// 1. Provision the canister's controller principal here (typically via
///    canister init args; the simplest is hardcoding the controller's
///    principal below).
/// 2. Add any operator identities that need to call the mutators
///    (e.g. the front-end identity used by the dashboard, a CI identity
///    that runs deployment-step toggles).
/// 3. Land a `setOperators` admin function (itself gated by the same
///    caller check) so the list can be rotated without redeploying.
///
/// Until those land, the mutators are intentionally locked.
let operators : [Principal] = [];

actor {
  // --- Metrics state (mutable record injected into mixin) ---
  let metricsState = { var cpuLoad : Nat = 42; var memoryUsage : Nat = 58; var uptime : Nat = 0; var timestamp : Int = 0 };

  // --- Controls state ---
  let controlsState = { var armed : Bool = false; var primaryMode : Types.PrimaryMode = #standby; var secondaryMode : Types.SecondaryMode = #monitor };

  // --- Config state ---
  let configState = { var pollingInterval : Nat = 2000; var cpuThreshold : Nat = 80; var memoryThreshold : Nat = 85; var responseDelay : Nat = 100 };

  // --- Activity log (max 8 entries, circular buffer via Queue) ---
  let activityLog : Queue.Queue<Types.LogEntry> = Queue.empty();

  // --- Seed counter for pseudo-randomness ---
  let bootTime : Int = Time.now();

  // --- Integrity state ---
  let _integrityInit = IntegrityLib.defaultReport();
  let integrityState = {
    var agents : [IntegrityTypes.IntegrityAgent] = _integrityInit.agents;
    var axioms : [IntegrityTypes.Axiom]          = _integrityInit.axioms;
    var overallScore : Nat                       = _integrityInit.overallScore;
    var lastAudit : Int                          = _integrityInit.lastAudit;
  };

  // --- Build pipeline state ---
  let _pipelineInit = PipelineLib.defaultPipeline();
  let pipelineState = {
    var areas : [PipelineTypes.BuildArea]    = _pipelineInit.areas;
    var summary : PipelineTypes.BuildSummary = _pipelineInit.summary;
  };

  // --- Kafka state ---
  let _kafkaInit = KafkaLib.defaultTopology();
  let kafkaState = {
    var topics : [KafkaTypes.KafkaTopic]              = _kafkaInit.topics;
    var connections : [KafkaTypes.KafkaConnection]    = _kafkaInit.connections;
    var totalMessages : Nat                           = _kafkaInit.totalMessages;
  };

  // --- Skills state ---
  let _skillsInit = SkillsLib.defaultMatrix();
  let skillsState = {
    var agents : [SkillsTypes.AgentCapabilities] = _skillsInit.agents;
    var sharedSkills : [Text]                    = _skillsInit.sharedSkills;
  };

  // --- Cost model state ---
  let _costInit = CostLib.defaultModel();
  let costModelState = {
    var cyclesPerHour : Nat   = _costInit.cyclesPerHour;
    var rpcCallsPerHour : Nat = _costInit.rpcCallsPerHour;
    var gasFeePerTx : Nat     = _costInit.gasFeePerTx;
    var agentCount : Nat      = _costInit.agentCount;
    var storageGB : Nat       = _costInit.storageGB;
  };

  // --- Deployment state ---
  let deploySteps  = DeploymentLib.defaultSteps();
  let _deployConf  = DeploymentLib.defaultConfig();
  let deployConfig = {
    var environment : Text          = _deployConf.environment;
    var networkId : Text            = _deployConf.networkId;
    var deployedComponents : [Text] = _deployConf.deployedComponents;
    var lastDeployTime : ?Int       = _deployConf.lastDeployTime;
  };

  // --- Mixin wiring ---
  include MetricsApi(
    metricsState,
    controlsState,
    configState,
    activityLog,
    integrityState,
    kafkaState,
    bootTime,
    operators,
  );
  include IntegrityApi(integrityState);
  include PipelineApi(pipelineState);
  include KafkaApi(kafkaState);
  include SkillsApi(skillsState);
  include CostApi(costModelState, operators);
  include DeploymentApi(deploySteps, deployConfig, operators);
};
