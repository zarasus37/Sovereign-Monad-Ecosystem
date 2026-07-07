// @sovereign/ttcl — Theo-Techno-Cosmological Language runtime.
// Re-exports the full runtime surface (types + executable combinators).
export * from "./runtime/index.js";

// Generated Sign factories (Phase B codegen) — thin makeSign wrappers over the
// LOGOC manifold. The manifold stays the sole source of truth for the peirce
// block. Source: shared/ttcl-specs/sign-events.json; drift-guarded by
// scripts/check-ttcl-artifacts-drift.mjs.
export * from "./generated/sign-factories.js";