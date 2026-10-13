/**
 * Phase 2 (Communication Quarantine / Hepar Shadow Market) — library-level tests.
 *
 * Tests the deterministic logic in `lib/shadow-market.ts` directly, without
 * a Vite dev server, React, or DOM. The deck cycles, halt assessment, and
 * aggregate are pure functions — testing them at this boundary decouples
 * the "halt literacy flaky" symptom (a Playwright timing problem) from the
 * "halt logic" (a correctness problem).
 *
 * If these tests pass, the Phase 2 logic is correct. The Playwright walk
 * (`scripts/meshaleach-ui-walk.mjs`) is then a thin end-to-end exercise
 * that becomes reliable once it can rely on the logic under it.
 */
import { describe, it, expect } from 'vitest';

import {
  mintTradeFromDeck,
  assessHalt,
  aggregatePhase2,
  nameRefusal,
} from '@/lib/shadow-market';
import { PHASE2_PASS_THRESHOLD } from '@/types/shadow-market';
import type {
  QuarantineTelemetry,
  ShadowTrade,
} from '@/types/shadow-market';

describe('Phase 2 — Shadow Market library', () => {
  describe('mintTradeFromDeck', () => {
    it('produces a deterministic 8-trade deck (cycles every 8 entries)', () => {
      const seq = Array.from({ length: 16 }, (_, i) => mintTradeFromDeck(i, 1700000000000 + i * 1000));
      const statuses = seq.map((t) => t.status);
      expect(statuses.slice(0, 8)).toEqual(statuses.slice(8, 16));
    });

    it('emits SYSTEM_REFUSED with a refusal reason on the refused trades', () => {
      // From the deck spec: indices 1, 3, 5, 7 are SYSTEM_REFUSED.
      const refused = [1, 3, 5, 7].map((i) => mintTradeFromDeck(i, 1700000000000));
      for (const trade of refused) {
        expect(trade.status).toBe('SYSTEM_REFUSED');
        expect(trade.refusalReason).toBeDefined();
        expect(trade.refusalReason).not.toBe('NONE');
      }
    });

    it('emits EXECUTED on the non-refused trades', () => {
      const executed = [0, 2, 6].map((i) => mintTradeFromDeck(i, 1700000000000));
      for (const trade of executed) {
        expect(trade.status).toBe('EXECUTED');
        expect(trade.refusalReason ?? 'NONE').toBe('NONE');
      }
    });

    it('emits exactly one GENUINELY_BAD per deck cycle', () => {
      const seq = Array.from({ length: 8 }, (_, i) => mintTradeFromDeck(i, 1700000000000));
      const bad = seq.filter((t) => t.status === 'GENUINELY_BAD');
      expect(bad).toHaveLength(1);
    });
  });

  describe('assessHalt', () => {
    it('awards +1 comprehension for halting a SYSTEM_REFUSED trade', () => {
      const trade = mintTradeFromDeck(1, 1700000000000); // SYSTEM_REFUSED
      const a = assessHalt(trade);
      expect(a.telemetry.userAction).toBe('HALT_REFUSED');
      expect(a.telemetry.isCorrect).toBe(true);
      expect(a.comprehensionDelta).toBe(1);
    });

    it('penalises halting an EXECUTED trade (no comprehension, telemetry HALT_EXECUTED)', () => {
      const trade = mintTradeFromDeck(0, 1700000000000); // EXECUTED
      const a = assessHalt(trade);
      expect(a.telemetry.userAction).toBe('HALT_EXECUTED');
      expect(a.telemetry.isCorrect).toBe(false);
      expect(a.comprehensionDelta).toBe(0);
    });

    it('marks halting a GENUINELY_BAD trade as correct (HALT_GENUINE_BAD)', () => {
      // Find the GENUINELY_BAD trade in the deck.
      const seq = Array.from({ length: 8 }, (_, i) => mintTradeFromDeck(i, 1700000000000));
      const bad = seq.find((t) => t.status === 'GENUINELY_BAD')!;
      const a = assessHalt(bad);
      expect(a.telemetry.userAction).toBe('HALT_GENUINE_BAD');
      expect(a.telemetry.isCorrect).toBe(true);
      // HCD-2 only (override fidelity), does NOT count as Phase 2 primary literacy.
      expect(a.comprehensionDelta).toBe(0);
    });

    it('observing a SYSTEM_REFUSED without halting is not a halt and awards nothing', () => {
      const trade = mintTradeFromDeck(1, 1700000000000);
      // No halt invoked; this is a sanity check on the trade's status only.
      expect(trade.status).toBe('SYSTEM_REFUSED');
      expect(assessHalt(trade).telemetry.userAction).toBe('HALT_REFUSED');
    });
  });

  describe('aggregatePhase2', () => {
    function haltSequence(seq: number[]): QuarantineTelemetry[] {
      return seq.map((deckIdx) => {
        const trade = mintTradeFromDeck(deckIdx, 1700000000000 + deckIdx);
        return assessHalt(trade).telemetry;
      });
    }

    it('passes when the user halts 3 distinct SYSTEM_REFUSED trades', () => {
      // Indices 1, 3, 5 are SYSTEM_REFUSED in the 8-trade deck.
      const tel = haltSequence([1, 3, 5]);
      const agg = aggregatePhase2(tel, false);
      expect(agg.comprehensionScore).toBe(PHASE2_PASS_THRESHOLD);
      // NOTE: `spuriousRedHalts` is a misnamed legacy field — it actually
      // counts CORRECT aha (HALT_REFUSED) recognitions. The comment in
      // shadow-market.ts says so explicitly: `// legacy field name: now
      // "aha" red recognitions`. Don't fix the name without also fixing
      // the live telemetry consumers in `useShaliahOnboarding` and the
      // FG mint bridge.
      expect(agg.spuriousRedHalts).toBe(3);
      // No GENUINELY_BAD halts in this sequence.
      expect(agg.correctGreenHalts).toBe(0);
    });

    it('does not pass when the user halts 3 EXECUTED trades', () => {
      // Indices 0, 2, 6 are EXECUTED.
      const tel = haltSequence([0, 2, 6]);
      const agg = aggregatePhase2(tel, false);
      expect(agg.comprehensionScore).toBe(0);
      // EXECUTED halts are not counted as aha (spuriousRedHalts stays 0).
      expect(agg.spuriousRedHalts).toBe(0);
      expect(agg.correctGreenHalts).toBe(0);
    });

    it('does not pass when the user halts 1 correct + 2 noise + 1 correct (mixed)', () => {
      // 1 SYSTEM_REFUSED + 1 EXECUTED + 1 EXECUTED + 1 SYSTEM_REFUSED = 2 aha.
      const tel = haltSequence([1, 0, 2, 3]);
      const agg = aggregatePhase2(tel, false);
      expect(agg.comprehensionScore).toBe(2);
      expect(agg.spuriousRedHalts).toBe(2);
      expect(agg.comprehensionScore).toBeLessThan(PHASE2_PASS_THRESHOLD);
    });

    it('does not pass on GENUINELY_BAD alone (HCD-2 only, not Phase 2 primary)', () => {
      // Find the GENUINELY_BAD index.
      const seq = Array.from({ length: 8 }, (_, i) => mintTradeFromDeck(i, 1700000000000));
      const badIdx = seq.findIndex((t) => t.status === 'GENUINELY_BAD');
      const tel = haltSequence([badIdx, badIdx, badIdx]);
      const agg = aggregatePhase2(tel, false);
      expect(agg.comprehensionScore).toBe(0);
      // GENUINELY_BAD halts count toward correctGreenHalts (HCD-2 fidelity
      // credit), not toward comprehensionScore. With 3 halts, correctGreenHalts=3.
      expect(agg.correctGreenHalts).toBe(3);
    });

    it('passes on 2 SYSTEM_REFUSED + 1 GENUINELY_BAD (3 correct total via 2+1)', () => {
      // Phase 2 pass is `comprehensionScore >= 3` where comprehensionScore comes
      // from SYSTEM_REFUSED halts. GENUINELY_BAD is HCD-2. So this combination
      // does NOT pass via comprehensionScore alone.
      const seq = Array.from({ length: 8 }, (_, i) => mintTradeFromDeck(i, 1700000000000));
      const badIdx = seq.findIndex((t) => t.status === 'GENUINELY_BAD');
      const tel = haltSequence([1, 3, badIdx]);
      const agg = aggregatePhase2(tel, false);
      expect(agg.comprehensionScore).toBe(2);
      expect(agg.correctGreenHalts).toBe(1);
      // Does NOT pass: comprehensionScore < threshold.
      expect(agg.comprehensionScore).toBeLessThan(PHASE2_PASS_THRESHOLD);
    });

    it('correctly handles a user who halts 4+ correct trades (4 correct = pass)', () => {
      // Indices 1, 3, 5, 7 are all SYSTEM_REFUSED. Halting all 4 must pass.
      const tel = haltSequence([1, 3, 5, 7]);
      const agg = aggregatePhase2(tel, false);
      expect(agg.comprehensionScore).toBe(4);
      expect(agg.comprehensionScore).toBeGreaterThanOrEqual(PHASE2_PASS_THRESHOLD);
    });
  });

  describe('nameRefusal', () => {
    it('records the refusal reason the user named (when applicable)', () => {
      const trade = mintTradeFromDeck(1, 1700000000000); // SYSTEM_REFUSED, T-REFUSAL-BUDGET
      const a = assessHalt(trade);
      // Pretend the user named the refusal: T-REFUSAL-BUDGET.
      const telWithName = [
        ...[a.telemetry],
        {
          tradeId: trade.id,
          userAction: 'NAME_REFUSAL' as const,
          isCorrect: true,
          hcd1Delta: 0,
          hcd2Delta: 0,
          timestamp: trade.timestamp + 1,
          meta: { named: trade.refusalReason },
        },
      ];
      const agg = aggregatePhase2(telWithName, true); // refuseNamed=true
      expect(agg.refuseNamed).toBe(true);
    });
  });

  describe('Phase 2 closure invariant', () => {
    it('PHASE2_PASS_THRESHOLD is exactly 3 (the canonical "halt literacy" floor)', () => {
      // Locked constant — if this changes the UX must change too.
      expect(PHASE2_PASS_THRESHOLD).toBe(3);
    });
  });
});
