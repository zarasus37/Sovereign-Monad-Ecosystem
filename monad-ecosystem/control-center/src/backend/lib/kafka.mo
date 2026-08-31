import Debug "mo:core/Debug";
import Types "../types/kafka";

module {
  /// Returns the Sovereign Monad Kafka topology with seeded message counts.
  public func defaultTopology() : Types.KafkaTopology {
    let topics : [Types.KafkaTopic] = [
      { id = "T1"; name = "market-signals"; description = "Raw market price and depth signals"; messageCount = 45020; throughput = 120 },
      { id = "T2"; name = "opportunity-detected"; description = "Arb opportunities identified by scanners"; messageCount = 12830; throughput = 35 },
      { id = "T3"; name = "execution-commands"; description = "Signed execution orders for bots"; messageCount = 5210; throughput = 15 },
      { id = "T4"; name = "risk-alerts"; description = "Exposure and drift alerts from Risk Engine"; messageCount = 1650; throughput = 5 },
      { id = "T5"; name = "settlement-events"; description = "On-chain settlement confirmations"; messageCount = 4100; throughput = 12 },
      { id = "T6"; name = "agent-telemetry"; description = "Real-time health from all agents"; messageCount = 31400; throughput = 90 },
    ];
    let connections : [Types.KafkaConnection] = [
      { fromAgent = "Spread Scanner"; toTopic = "market-signals"; connectionType = #publisher },
      { fromAgent = "Spread Scanner"; toTopic = "opportunity-detected"; connectionType = #publisher },
      { fromAgent = "Opportunity Constructor"; toTopic = "opportunity-detected"; connectionType = #subscriber },
      { fromAgent = "Opportunity Constructor"; toTopic = "execution-commands"; connectionType = #publisher },
      { fromAgent = "Monad Arb Bot"; toTopic = "execution-commands"; connectionType = #subscriber },
      { fromAgent = "Monad Arb Bot"; toTopic = "settlement-events"; connectionType = #publisher },
      { fromAgent = "Eth Arb Bot"; toTopic = "execution-commands"; connectionType = #subscriber },
      { fromAgent = "Eth Arb Bot"; toTopic = "settlement-events"; connectionType = #publisher },
      { fromAgent = "Risk Engine"; toTopic = "market-signals"; connectionType = #subscriber },
      { fromAgent = "Risk Engine"; toTopic = "risk-alerts"; connectionType = #publisher },
      { fromAgent = "Portfolio Manager"; toTopic = "settlement-events"; connectionType = #subscriber },
      { fromAgent = "Portfolio Manager"; toTopic = "risk-alerts"; connectionType = #subscriber },
    ];
    let total = topics.foldLeft(0, func(acc : Nat, t : Types.KafkaTopic) : Nat { acc + t.messageCount });
    { topics; connections; totalMessages = total };
  };

  /// Advances message counts and throughput via pseudo-random fluctuation.
  public func tickTopology(
    topology : Types.KafkaTopology,
    seed : Nat,
  ) : Types.KafkaTopology {
    let newTopics = topology.topics.map(
      func(t) {
        let bump : Nat = (seed % 20) + 1;
        let tpDelta : Int = (seed % 5 : Nat).toInt() - 2;
        let newTp : Nat = if (t.throughput.toInt() + tpDelta < 1) 1
          else (t.throughput.toInt() + tpDelta).toNat();
        { t with messageCount = t.messageCount + bump; throughput = newTp };
      }
    );
    let total = newTopics.foldLeft(0, func(acc : Nat, t : Types.KafkaTopic) : Nat { acc + t.messageCount });
    { topology with topics = newTopics; totalMessages = total };
  };
};
