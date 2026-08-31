import Debug "mo:core/Debug";
import Types "../types/pipeline";

module {
  /// Returns the canonical 15-layer build pipeline with initial statuses.
  public func defaultPipeline() : Types.BuildPipeline {
    let areas : [Types.BuildArea] = [
      { id = "L01"; name = "Core Ontology Layer"; layer = 1; status = #done; completionPct = 100 },
      { id = "L02"; name = "Axiom Encoding Layer"; layer = 2; status = #done; completionPct = 100 },
      { id = "L03"; name = "Gnosis Integrity Layer"; layer = 3; status = #done; completionPct = 100 },
      { id = "L04"; name = "Sovereign Identity Layer"; layer = 4; status = #partial; completionPct = 70 },
      { id = "L05"; name = "Cognitive Engine Layer"; layer = 5; status = #partial; completionPct = 55 },
      { id = "L06"; name = "Pattern Recognition Layer"; layer = 6; status = #partial; completionPct = 40 },
      { id = "L07"; name = "Narrative Synthesis Layer"; layer = 7; status = #partial; completionPct = 30 },
      { id = "L08"; name = "Epistemic Calibration Layer"; layer = 8; status = #blocked; completionPct = 10 },
      { id = "L09"; name = "Inter-Agent Communication Layer"; layer = 9; status = #blocked; completionPct = 5 },
      { id = "L10"; name = "Feedback Loop Layer"; layer = 10; status = #blocked; completionPct = 0 },
      { id = "L11"; name = "Value Alignment Layer"; layer = 11; status = #notStarted; completionPct = 0 },
      { id = "L12"; name = "Emergent Behavior Layer"; layer = 12; status = #notStarted; completionPct = 0 },
      { id = "L13"; name = "Self-Improvement Layer"; layer = 13; status = #notStarted; completionPct = 0 },
      { id = "L14"; name = "Ecosystem Governance Layer"; layer = 14; status = #notStarted; completionPct = 0 },
      { id = "L15"; name = "Sovereign Autonomy Layer"; layer = 15; status = #notStarted; completionPct = 0 },
    ];
    let done   = areas.filter(func(a : Types.BuildArea) : Bool { a.status == #done }).size();
    let total  = areas.size();
    {
      areas;
      summary = {
        majorAreas  = total;
        majorDone   = done;
        layerItems  = total;
        layerDone   = done;
        lastUpdated = 0;
      };
    };
  };

  /// Marks a build area as done by its id and recomputes summary.
  public func markAreaDone(
    pipeline : Types.BuildPipeline,
    areaId : Text,
  ) : Types.BuildPipeline {
    let updated = pipeline.areas.map(
      func(a) {
        if (a.id == areaId) { { a with status = #done; completionPct = 100 } }
        else a;
      }
    );
    let done  = updated.filter(func(a : Types.BuildArea) : Bool { a.status == #done }).size();
    let total = updated.size();
    {
      areas = updated;
      summary = { pipeline.summary with majorDone = done; layerDone = done; majorAreas = total; layerItems = total };
    };
  };
};
