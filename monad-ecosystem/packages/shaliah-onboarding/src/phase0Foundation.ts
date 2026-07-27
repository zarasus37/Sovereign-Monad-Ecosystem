/**
 * Phase 0 — Impartation foundation (NEO + SD3 + optional natal).
 * docs/VECTOR1_ONBOARDING_REDESIGN.md §1, §5 Phase 0
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  ImpartationFoundation,
  NatalPriors,
  NeoBigFive,
  OnboardingEvent,
  Sd3Profile,
} from './types.js';

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeNeo(neo: NeoBigFive): NeoBigFive {
  return {
    openness: clamp01(neo.openness),
    conscientiousness: clamp01(neo.conscientiousness),
    extraversion: clamp01(neo.extraversion),
    agreeableness: clamp01(neo.agreeableness),
    neuroticism: clamp01(neo.neuroticism),
  };
}

function normalizeSd3(sd3: Sd3Profile): Sd3Profile {
  return {
    machiavellianism: clamp01(sd3.machiavellianism),
    narcissism: clamp01(sd3.narcissism),
    psychopathy: clamp01(sd3.psychopathy),
  };
}

export function hashImpartation(
  principalId: string,
  neo: NeoBigFive,
  sd3: Sd3Profile,
  natal?: NatalPriors,
): string {
  const payload = JSON.stringify({ principalId, neo, sd3, natal: natal ?? null });
  return createHash('sha256').update(payload).digest('hex');
}

export interface CompleteFoundationInput {
  readonly principalId: string;
  readonly neo: NeoBigFive;
  readonly sd3: Sd3Profile;
  /** Opt-in only; omit if user declines. */
  readonly natal?: Omit<NatalPriors, 'consented'> & { consented?: boolean };
  readonly now?: number;
}

export interface FoundationResult {
  readonly foundation: ImpartationFoundation;
  readonly event: OnboardingEvent;
  readonly ok: boolean;
  readonly feedback: string;
}

/**
 * Complete Phase 0. Scores are domain placeholders until real NEO/SD3 instruments wire in;
 * structure and hash are load-bearing for Twin seed.
 */
export function completeFoundation(input: CompleteFoundationInput): FoundationResult {
  const neo = normalizeNeo(input.neo);
  const sd3 = normalizeSd3(input.sd3);
  let natal: NatalPriors | undefined;
  if (input.natal) {
    if (input.natal.consented === false) {
      natal = undefined;
    } else {
      natal = {
        consented: true,
        summary: input.natal.summary,
        emphasis: input.natal.emphasis,
      };
    }
  }
  const now = input.now ?? Date.now();
  const impartationHash = hashImpartation(input.principalId, neo, sd3, natal);
  const foundation: ImpartationFoundation = {
    principalId: input.principalId,
    neo,
    sd3,
    natal,
    impartationHash,
    completedAt: now,
  };
  const event: OnboardingEvent = {
    id: randomUUID(),
    kind: 'phase0.impartation',
    principalId: input.principalId,
    at: now,
    payload: {
      impartationHash,
      hasNatal: Boolean(natal),
      neo,
      sd3,
    },
  };
  return {
    foundation,
    event,
    ok: true,
    feedback:
      'Foundation recorded so your Shaliah can know you — not a grade. Hash anchored for provenance.',
  };
}

/** Demo / test defaults (not clinical). */
export const DEMO_NEO: NeoBigFive = {
  openness: 0.72,
  conscientiousness: 0.61,
  extraversion: 0.48,
  agreeableness: 0.55,
  neuroticism: 0.4,
};

export const DEMO_SD3: Sd3Profile = {
  machiavellianism: 0.25,
  narcissism: 0.3,
  psychopathy: 0.15,
};
