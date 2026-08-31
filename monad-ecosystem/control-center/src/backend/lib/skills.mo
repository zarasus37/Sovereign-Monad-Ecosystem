import Debug "mo:core/Debug";
import Types "../types/skills";

module {
  /// Returns the full agent skills matrix for all three improvement agents.
  public func defaultMatrix() : Types.SkillsMatrix {
    let sharedSkills : [Text] = ["Axiomatic Compliance", "Self-Monitoring"];
    {
      agents = [
        {
          agentName = "Risk Engine";
          domain = "Systemic Risk Monitoring & Mitigation";
          overallRating = 98;
          skills = [
            { name = "Exposure Calculation"; category = #core; level = 99; isShared = false },
            { name = "Volatility Modeling"; category = #domain; level = 97; isShared = false },
            { name = "Drift Detection"; category = #domain; level = 96; isShared = false },
            { name = "Axiomatic Compliance"; category = #integrity; level = 98; isShared = true },
            { name = "Self-Monitoring"; category = #integrity; level = 95; isShared = true },
          ];
        },
        {
          agentName = "Monad Arb Bot";
          domain = "Ecosystem Arbitrage & Liquidity Provision";
          overallRating = 95;
          skills = [
            { name = "Atomic Execution"; category = #core; level = 98; isShared = false },
            { name = "Gas Optimization"; category = #domain; level = 94; isShared = false },
            { name = "Path Finding"; category = #domain; level = 92; isShared = false },
            { name = "Axiomatic Compliance"; category = #integrity; level = 96; isShared = true },
            { name = "Self-Monitoring"; category = #integrity; level = 93; isShared = true },
          ];
        },
        {
          agentName = "Spread Scanner";
          domain = "Market Inefficiency Detection";
          overallRating = 89;
          skills = [
            { name = "High-Frequency Polling"; category = #core; level = 96; isShared = false },
            { name = "DEX Integration"; category = #integration; level = 94; isShared = false },
            { name = "Signal Synthesis"; category = #domain; level = 85; isShared = false },
            { name = "Axiomatic Compliance"; category = #integrity; level = 90; isShared = true },
            { name = "Self-Monitoring"; category = #integrity; level = 88; isShared = true },
          ];
        },
      ];
      sharedSkills;
    };
  };
};
