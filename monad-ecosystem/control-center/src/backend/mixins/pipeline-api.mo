import Types "../types/pipeline";

mixin (
  pipelineAreas : { var areas : [Types.BuildArea]; var summary : Types.BuildSummary },
) {
  /// Returns the full 15-layer build pipeline with status and completion.
  public query func getBuildPipeline() : async Types.BuildPipeline {
    { areas = pipelineAreas.areas; summary = pipelineAreas.summary };
  };
};
