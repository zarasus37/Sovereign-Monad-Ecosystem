/**
 * @sovereign/monad-mev — DEPRECATED back-compat shim.
 *
 * This package has been renamed to `@sovereign/loop`. The Sovereign
 * Execution Loop implements bounded-agency trade execution (Capital
 * Mandate, Capacity Ceiling, Shadow Markout, Router B yield), not a
 * MEV engine. See docs/P0_MONADMEV_DECISION_2026-10-11.md for the
 * rename rationale.
 *
 * New code should import directly from `@sovereign/loop`. This shim
 * will be removed after one release.
 */

export * from '@sovereign/loop';
