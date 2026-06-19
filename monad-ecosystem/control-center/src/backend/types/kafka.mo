module {
  public type TopicRole = {
    #publisher;
    #subscriber;
    #both;
  };

  public type KafkaTopic = {
    id : Text;
    name : Text;
    description : Text;
    messageCount : Nat;
    throughput : Nat;
  };

  public type KafkaConnection = {
    fromAgent : Text;
    toTopic : Text;
    connectionType : TopicRole;
  };

  public type KafkaTopology = {
    topics : [KafkaTopic];
    connections : [KafkaConnection];
    totalMessages : Nat;
  };
};
