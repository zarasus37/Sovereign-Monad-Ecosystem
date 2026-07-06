import { describe, it, expect } from 'vitest';
import {
  HCD_THRESHOLDS,
  ratioStatus,
  inverseRatioStatus,
} from '../src/config/thresholds.js';

describe('HCD thresholds', () => {
  it('exports bounded yellow/red bands', () => {
    expect(HCD_THRESHOLDS.hcd1.red).toBeGreaterThan(0);
    expect(HCD_THRESHOLDS.hcd1.yellow).toBeLessThan(HCD_THRESHOLDS.hcd1.red);
    expect(HCD_THRESHOLDS.hcd2.red).toBeGreaterThan(0);
    expect(HCD_THRESHOLDS.hcd2.yellow).toBeGreaterThan(HCD_THRESHOLDS.hcd2.red);
    expect(HCD_THRESHOLDS.hcd4.red).toBeGreaterThan(0);
    expect(HCD_THRESHOLDS.hcd4.yellow).toBeGreaterThan(HCD_THRESHOLDS.hcd4.red);
  });

  it('exports bounded latency bands', () => {
    expect(HCD_THRESHOLDS.hcd5.redHours).toBeGreaterThan(
      HCD_THRESHOLDS.hcd5.yellowHours
    );
  });

  it('classifies ratio values using the bands', () => {
    const bands = { yellow: 0.8, red: 0.6 };
    expect(ratioStatus(0.95, bands)).toBe('green');
    expect(ratioStatus(0.7, bands)).toBe('yellow');
    expect(ratioStatus(0.5, bands)).toBe('red');
  });

  it('matches current metric expectations', () => {
    expect(inverseRatioStatus(0.08, HCD_THRESHOLDS.hcd1)).toBe('green');
    expect(ratioStatus(0.29, HCD_THRESHOLDS.hcd2)).toBe('red');
    expect(ratioStatus(0, HCD_THRESHOLDS.hcd4)).toBe('red');
  });
});
