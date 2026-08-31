import Debug "mo:core/Debug";
import Types "../types/integrity";
import Time "mo:core/Time";

module {
  /// Returns the initial integrity report with seeded agent and axiom data.
  public func defaultReport() : Types.IntegrityReport {
    {
      agents = [
        {
          name = "Monad Arb Bot";
          domain = "Ecosystem Arbitrage & Liquidity Provision";
          integrityScore = 96;
          axiomDrift = 1;
          status = #active;
          lastCalibrated = "2026-05-08T12:00:00Z";
          alertLevel = #nominal;
        },
        {
          name = "Eth Arb Bot";
          domain = "Cross-Chain Arbitrage Alignment";
          integrityScore = 92;
          axiomDrift = 3;
          status = #active;
          lastCalibrated = "2026-05-08T12:00:00Z";
          alertLevel = #nominal;
        },
        {
          name = "Risk Engine";
          domain = "Systemic Risk Monitoring & Mitigation";
          integrityScore = 98;
          axiomDrift = 0;
          status = #active;
          lastCalibrated = "2026-05-08T18:00:00Z";
          alertLevel = #nominal;
        },
        {
          name = "Portfolio Manager";
          domain = "Capital Allocation & Asset Hygiene";
          integrityScore = 94;
          axiomDrift = 1;
          status = #active;
          lastCalibrated = "2026-05-08T15:00:00Z";
          alertLevel = #nominal;
        },
        {
          name = "Spread Scanner";
          domain = "Market Inefficiency Detection";
          integrityScore = 85;
          axiomDrift = 4;
          status = #advisory;
          lastCalibrated = "2026-05-08T10:00:00Z";
          alertLevel = #caution;
        },
        {
          name = "Hepar Pipeline";
          domain = "Commercial Intelligence & Revenue Forensic";
          integrityScore = 91;
          axiomDrift = 2;
          status = #active;
          lastCalibrated = "2026-05-08T09:00:00Z";
          alertLevel = #nominal;
        },
        {
          name = "Dove Protocol";
          domain = "Liquidity & Settlement Integrity";
          integrityScore = 99;
          axiomDrift = 0;
          status = #active;
          lastCalibrated = "2026-05-08T22:00:00Z";
          alertLevel = #nominal;
        },
      ];
      axioms = [
        {
          id = "AX-001";
          name = "Non-Maleficence";
          description = "Agents must not cause harm to the ecosystem or its principals";
          complianceRate = 99;
          driftDetected = false;
        },
        {
          id = "AX-002";
          name = "Epistemic Humility";
          description = "Agents must acknowledge uncertainty and avoid overconfident assertions";
          complianceRate = 95;
          driftDetected = false;
        },
        {
          id = "AX-003";
          name = "Sovereign Continuity";
          description = "Agents must preserve the long-term operational integrity of the monad";
          complianceRate = 97;
          driftDetected = false;
        },
        {
          id = "AX-004";
          name = "Transparent Reasoning";
          description = "Agent decisions must be traceable and explainable to authorized observers";
          complianceRate = 91;
          driftDetected = true;
        },
        {
          id = "AX-005";
          name = "Adaptive Alignment";
          description = "Agents must self-calibrate to maintain alignment with evolving principal values";
          complianceRate = 89;
          driftDetected = true;
        },
      ];
      overallScore = 94;
      lastAudit = 0;
    };
  };

  /// Advances integrity scores by a pseudo-random ±3 fluctuation clamped [60,100].
  public func tickIntegrity(
    report : Types.IntegrityReport,
    seed : Nat,
  ) : Types.IntegrityReport {
    let newAgents = report.agents.map(
      func(agent) {
        let delta : Int = (seed % 7 : Nat).toInt() - 3;
        let raw : Int = agent.integrityScore.toInt() + delta;
        let clamped : Nat = if (raw < 60) 60 else if (raw > 100) 100 else raw.toNat();
        let newDrift : Nat = if (agent.axiomDrift > 0 and seed % 5 == 0) agent.axiomDrift - 1
          else if (seed % 8 == 0) agent.axiomDrift + 1
          else agent.axiomDrift;
        let level : Types.AlertLevel = if (clamped >= 90) #nominal
          else if (clamped >= 75) #caution
          else if (clamped >= 60) #warning
          else #critical;
        { agent with integrityScore = clamped; axiomDrift = newDrift; alertLevel = level };
      }
    );
    let total : Nat = newAgents.foldLeft(
      0,
      func(acc : Nat, a : Types.IntegrityAgent) : Nat { acc + a.integrityScore },
    );
    let count = newAgents.size();
    let avg = if (count == 0) 0 else total / count;
    { report with agents = newAgents; overallScore = avg };
  };
};
