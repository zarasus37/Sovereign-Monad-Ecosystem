import Types "../types/kafka";

mixin (
  kafkaState : { var topics : [Types.KafkaTopic]; var connections : [Types.KafkaConnection]; var totalMessages : Nat },
) {
  /// Returns the Kafka topic wiring diagram and connection topology.
  public query func getKafkaTopology() : async Types.KafkaTopology {
    { topics = kafkaState.topics; connections = kafkaState.connections; totalMessages = kafkaState.totalMessages };
  };
};
