// Sovereign Monad Control Center — dashboard domain types
// Aligned with generated backend.d.ts after pnpm bindgen

// Re-export backend enum types for use throughout the app
export { PrimaryMode, SecondaryMode } from "@/backend";
export type { Config, Controls, LogEntry, Metrics } from "@/backend";

// Backend result discriminated union
export type BackendResult =
  | { __kind__: "ok"; ok: null }
  | { __kind__: "err"; err: string };

// DashboardActor matches the generated backendInterface
export type { backendInterface as DashboardActor } from "@/backend";

// Legacy Candid types — kept for type-compatibility across imports
// These are now identity types since the backend uses enums directly
export type CandidPrimaryMode = import("@/backend").PrimaryMode;
export type CandidSecondaryMode = import("@/backend").SecondaryMode;
export type CandidControls = import("@/backend").Controls;
