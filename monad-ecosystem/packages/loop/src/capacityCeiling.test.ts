import { describe, it, expect, vi } from 'vitest';
import { CapacityCeilingMonitor } from './capacityCeiling.js';
import type { CapacityCeilingEvent, TradeOutcome } from '@sovereign/types';

function outcome(
  partial: Partial<TradeOutcome> & Pick<TradeOutcome, 'tradeId'>,
): TradeOutcome {
  return {
    notionalUsd: 100,
    realizedSlippage: 0,
    pnlUsd: 0,
    ...partial,
  };
}

describe('CapacityCeilingMonitor', () => {
  it('allows normal trade below slippage thresholds', () => {
    const mon = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      emitEvent: () => {},
    });
    const d = mon.checkCeiling(1_000);
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('OK');
    expect(d.throttledSize).toBeUndefined();
    expect(d.remainingAllocationUsd).toBe(15_000);
  });

  it('returns throttled size when rolling slippage is in the warning band', () => {
    const events: CapacityCeilingEvent[] = [];
    const mon = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      warningThreshold: 0.01,
      densityFloor: 0.02,
      rollingWindowSize: 10,
      emitEvent: (e) => {
        events.push(e);
      },
    });

    // Seed window at 1.5% avg (mid warning band → 50% throttle factor)
    for (let i = 0; i < 5; i++) {
      mon.recordTradeOutcome(
        outcome({
          tradeId: `w-${i}`,
          notionalUsd: 10,
          realizedSlippage: 0.015,
          capitalConsumedUsd: 10,
        }),
      );
    }

    const d = mon.checkCeiling(1_000);
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('THROTTLED');
    expect(d.throttledSize).toBeDefined();
    // factor = 1 - (0.015-0.01)/(0.02-0.01) = 0.5
    expect(d.throttledSize!).toBeCloseTo(500, 5);
    expect(d.avgSlippage).toBeCloseTo(0.015, 5);
    expect(events.some((e) => e.kind === 'THROTTLE_ACTIVE')).toBe(true);
  });

  it('halts when rolling slippage exceeds C-DENSITY-FLOOR', () => {
    const mon = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      densityFloor: 0.02,
      warningThreshold: 0.01,
      rollingWindowSize: 10,
      emitEvent: () => {},
    });

    for (let i = 0; i < 3; i++) {
      mon.recordTradeOutcome(
        outcome({
          tradeId: `h-${i}`,
          notionalUsd: 50,
          realizedSlippage: 0.03,
          capitalConsumedUsd: 50,
        }),
      );
    }

    expect(mon.isDensityHalted).toBe(true);
    const d = mon.checkCeiling(500);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('C_DENSITY_FLOOR');
  });

  it('emits CAPACITY_EXHAUSTED when allocation drops below min floor', () => {
    const events: CapacityCeilingEvent[] = [];
    const mon = new CapacityCeilingMonitor({
      initialAllocationUsd: 1_000,
      minAllocationFloorUsd: 500,
      emitEvent: (e) => {
        events.push(e);
      },
    });

    mon.recordTradeOutcome(
      outcome({
        tradeId: 'burn-1',
        notionalUsd: 600,
        capitalConsumedUsd: 600,
        realizedSlippage: 0.001,
        pnlUsd: 0,
      }),
    );

    // remaining 400 < 500
    expect(mon.remainingAllocationUsd).toBeCloseTo(400, 5);
    expect(mon.isExhausted).toBe(true);
    expect(events.some((e) => e.kind === 'CAPACITY_EXHAUSTED')).toBe(true);

    const d = mon.checkCeiling(50);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('CAPACITY_EXHAUSTED');
  });

  it('rolling window drops oldest after N trades and can recover density halt', () => {
    const mon = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      rollingWindowSize: 10,
      densityFloor: 0.02,
      warningThreshold: 0.01,
      emitEvent: () => {},
    });

    // 10 high-slippage trades → halt
    for (let i = 0; i < 10; i++) {
      mon.recordTradeOutcome(
        outcome({
          tradeId: `hi-${i}`,
          notionalUsd: 1,
          capitalConsumedUsd: 1,
          realizedSlippage: 0.05,
        }),
      );
    }
    expect(mon.getRollingWindow()).toHaveLength(10);
    expect(mon.avgSlippage()).toBeCloseTo(0.05, 5);
    expect(mon.isDensityHalted).toBe(true);

    // 10 zero-slippage trades replace the window
    for (let i = 0; i < 10; i++) {
      mon.recordTradeOutcome(
        outcome({
          tradeId: `lo-${i}`,
          notionalUsd: 1,
          capitalConsumedUsd: 1,
          realizedSlippage: 0,
        }),
      );
    }

    expect(mon.getRollingWindow()).toHaveLength(10);
    expect(mon.avgSlippage()).toBe(0);
    expect(mon.isDensityHalted).toBe(false);

    const d = mon.checkCeiling(100);
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('OK');
  });

  it('accounts remaining allocation in stablecoin base units (6 decimals)', () => {
    const mon = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      emitEvent: () => {},
    });
    expect(mon.remainingAllocationBaseUnits).toBe(15_000_000_000n);
    mon.recordTradeOutcome(
      outcome({
        tradeId: 'u1',
        notionalUsd: 100,
        capitalConsumedUsd: 100,
        realizedSlippage: 0,
      }),
    );
    expect(mon.remainingAllocationBaseUnits).toBe(14_900_000_000n);
  });

  it('does not call Kafka path when emit is injected (unit isolation)', () => {
    const spy = vi.fn();
    const mon = new CapacityCeilingMonitor({ emitEvent: spy });
    mon.checkCeiling(10);
    mon.recordTradeOutcome(
      outcome({ tradeId: 'iso', capitalConsumedUsd: 1, notionalUsd: 1 }),
    );
    expect(spy).toHaveBeenCalled();
    expect(
      spy.mock.calls.some(
        (c) => (c[0] as CapacityCeilingEvent).kind === 'TRADE_RECORDED',
      ),
    ).toBe(true);
  });
});
