/**
 * @sovereign/shaliah-onboarding
 * Vector 1 primary: mutual knowing + communication genesis.
 * Authority: docs/VECTOR1_ONBOARDING_REDESIGN.md · docs/SHALIAH_IDENTITY_V2.md
 */

export * from './types.js';
export * from './phase0Foundation.js';
export * from './phaseAChannel.js';
export * from './phaseBReadMind.js';
export * from './phaseCCovenant.js';
export * from './arc.js';

// FG curriculum + lesson engine + prompts (middle track)
export * from './lessonEngine/index.js';
export * from './fg/index.js';
export * from './prompts/index.js';

// Legacy puzzle modules still importable for transition
export * as legacy from './legacy/index.js';
export * from './phase1Circuit.js';
export * from './phase2ShadowMarket.js';
export * from './phase3Archon.js';
