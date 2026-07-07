// Peirce manifold + semiotic primitives (PragmatismBand / CoarseMode /
// PeirceSignature / getManifold / PeirceManifold / PeirceSignClass) were
// relocated to @sovereign/types — the shared essence both TTCL and LOGOC
// derive from. Import them from @sovereign/types. What remains here is the
// LOGOC classifier (PeirceClassifier / AmbiguousClassificationError), the
// manifold-derived tier producer (produceLogocTier / neighborDensity), and
// the classifier-domain types (LogocEvent / SemioticFlags).
export * from "./peirce/models.js";
export * from "./peirce/classifier.js";
export * from "./peirce/tier.js";
