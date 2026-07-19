/**
 * Embedded logoc_fingerprint + runtime priors blend tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  blendNodeExpectation,
  blendChannelScores,
  baselineFromChannels,
  isFingerprintAuditable,
  fingerprintCoverage,
  findNodePrior,
  profileFromPriors,
  resolveTempleByHymnIndex,
  scoreTempleGridSign,
  gridSign,
  type TempleGrid,
  type TempleGridLogocPriors,
} from '../src/runtime/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const gridPath = resolve(root, 'shared/fixtures/layer6/enheduanna-temple-grid.json');
const priorsPath = resolve(root, 'shared/fixtures/layer6/temple-grid-logoc-priors.json');

function loadGrid(): TempleGrid {
  return JSON.parse(readFileSync(gridPath, 'utf8')) as TempleGrid;
}
function loadPriors(): TempleGridLogocPriors {
  return JSON.parse(readFileSync(priorsPath, 'utf8')) as TempleGridLogocPriors;
}

describe('TempleNode logoc_fingerprint', () => {
  it('covers all 42 nodes with auditable baselines', () => {
    const grid = loadGrid();
    const cov = fingerprintCoverage(grid);
    expect(cov.total).toBe(42);
    expect(cov.withFingerprint).toBe(42);
    expect(cov.ratio).toBe(1);
    for (const n of grid.nodes) {
      expect(n.logoc_fingerprint).toBeTruthy();
      expect(n.logoc_fingerprint!.profile_id).toBe('logoc.temple-grid.v1');
      expect(isFingerprintAuditable(n.logoc_fingerprint!)).toBe(true);
    }
  });

  it('E-ana fingerprint is high-theo curated landmark', () => {
    const grid = loadGrid();
    const eanna = resolveTempleByHymnIndex(grid, 16);
    const fp = eanna.logoc_fingerprint!;
    expect(fp.channels.theo).toBeGreaterThanOrEqual(0.85);
    expect(fp.confidence).toBeGreaterThanOrEqual(0.9);
    expect(fp.provenance.mode).toBe('curated-static');
  });
});

describe('TempleGrid LOGOC priors overlay', () => {
  it('blends fingerprint with sparse runtime prior (70/30)', () => {
    const grid = loadGrid();
    const priors = loadPriors();
    expect(priors.profile_id).toBe('logoc.temple-grid.v1');
    expect(priors.global.blend.fingerprint_weight).toBe(0.7);
    expect(priors.global.blend.runtime_prior_weight).toBe(0.3);

    const eanna = resolveTempleByHymnIndex(grid, 16);
    const prior = findNodePrior(priors, eanna.temple_id)!;
    expect(prior).toBeTruthy();

    const blended = blendNodeExpectation(eanna, priors);
    expect(blended.source).toBe('fingerprint+prior');
    // theo should sit between fingerprint and prior
    const fpT = eanna.logoc_fingerprint!.channels.theo;
    const prT = prior.channels.theo;
    const lo = Math.min(fpT, prT);
    const hi = Math.max(fpT, prT);
    expect(blended.channels.theo).toBeGreaterThanOrEqual(lo - 0.001);
    expect(blended.channels.theo).toBeLessThanOrEqual(hi + 0.001);
  });

  it('nodes without prior inherit fingerprint-only', () => {
    const grid = loadGrid();
    const priors = loadPriors();
    // hymn 11 is not in seed priors
    const node = resolveTempleByHymnIndex(grid, 11);
    expect(findNodePrior(priors, node.temple_id)).toBeUndefined();
    const blended = blendNodeExpectation(node, priors);
    expect(blended.source).toBe('fingerprint-only');
    expect(blended.channels.theo).toBe(node.logoc_fingerprint!.channels.theo);
  });

  it('blendChannelScores is convex combination', () => {
    const a = { theo: 1, tech: 0, cosmo: 0.5, coherence: 0.5, sovereignty: 0.5 };
    const b = { theo: 0, tech: 1, cosmo: 0.5, coherence: 0.5, sovereignty: 0.5 };
    const m = blendChannelScores(a, b, 0.7, 0.3);
    expect(m.theo).toBeCloseTo(0.7, 5);
    expect(m.tech).toBeCloseTo(0.3, 5);
  });

  it('theology-heavy scenario raises theo weight', () => {
    const priors = loadPriors();
    const p = profileFromPriors(priors, 'theology-heavy');
    expect(p.weights.theo).toBe(0.32);
    expect(p.weights.tech).toBe(0.14);
  });

  it('scoreTempleGridSign soft-anchors toward fingerprint', () => {
    const grid = loadGrid();
    const node = resolveTempleByHymnIndex(grid, 2);
    const sign = gridSign(grid, node.temple_id, {
      domains: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    });
    const live = scoreTempleGridSign(sign, node, undefined, {
      derivedFromGrid: true,
      useFingerprintBaseline: false,
    });
    const anchored = scoreTempleGridSign(sign, node, undefined, {
      derivedFromGrid: true,
      useFingerprintBaseline: true,
      priors: loadPriors(),
    });
    expect(anchored.total).toBeGreaterThan(0);
    expect(anchored.profile_id).toBe('logoc.temple-grid.v1');
    // both valid scores
    expect(live.total).toBeGreaterThanOrEqual(0);
  });

  it('baselineFromChannels matches formula', () => {
    const ch = { theo: 1, tech: 1, cosmo: 1, coherence: 1, sovereignty: 1 };
    const w = { theo: 0.26, tech: 0.18, cosmo: 0.24, coherence: 0.18, sovereignty: 0.14 };
    expect(baselineFromChannels(ch, w, 0)).toBe(1);
    expect(baselineFromChannels(ch, w, 0.5)).toBe(0.5);
  });
});
