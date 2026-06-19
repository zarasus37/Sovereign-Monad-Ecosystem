module {
  public type SkillCategory = {
    #core;
    #domain;
    #integration;
    #integrity;
  };

  public type AgentSkill = {
    name : Text;
    category : SkillCategory;
    level : Nat;
    isShared : Bool;
  };

  public type AgentCapabilities = {
    agentName : Text;
    domain : Text;
    skills : [AgentSkill];
    overallRating : Nat;
  };

  public type SkillsMatrix = {
    agents : [AgentCapabilities];
    sharedSkills : [Text];
  };
};
