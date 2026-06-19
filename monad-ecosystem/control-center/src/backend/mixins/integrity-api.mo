import Types "../types/integrity";

mixin (
  integrityReport : { var agents : [Types.IntegrityAgent]; var axioms : [Types.Axiom]; var overallScore : Nat; var lastAudit : Int },
) {
  /// Returns the full Gnosis Integrity Layer report.
  public query func getIntegrityReport() : async Types.IntegrityReport {
    {
      agents        = integrityReport.agents;
      axioms        = integrityReport.axioms;
      overallScore  = integrityReport.overallScore;
      lastAudit     = integrityReport.lastAudit;
    };
  };
};
