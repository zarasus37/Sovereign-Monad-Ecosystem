import Types "../types/skills";

mixin (
  skillsMatrix : { var agents : [Types.AgentCapabilities]; var sharedSkills : [Text] },
) {
  /// Returns the full skills matrix for all improvement agents.
  public query func getSkillsMatrix() : async Types.SkillsMatrix {
    { agents = skillsMatrix.agents; sharedSkills = skillsMatrix.sharedSkills };
  };
};
