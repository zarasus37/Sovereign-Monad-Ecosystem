import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEMO_VKEY_SHA256,
  assertVkeyPinMatches,
  currentVkeySha256,
  getVkeyPinStatus,
  resolveCeremonyMode,
} from './vkeyPin.js';
import { artifactsReady } from './paths.js';

describe('vkey pin', () => {
  it('has artifacts and demo pin matches disk', () => {
    assert.equal(artifactsReady(), true, 'artifacts must be committed');
    const sha = currentVkeySha256();
    assert.equal(sha.length, 64);
    assert.equal(sha, DEMO_VKEY_SHA256);
  });

  it('circuit_meta mode is demo (or pin matches demo)', () => {
    const status = getVkeyPinStatus();
    assert.equal(status.ready, true);
    assert.equal(status.pinMatch, true);
    assert.equal(status.isDemo, true);
    assert.ok(
      status.mode === 'demo' || status.currentSha256 === DEMO_VKEY_SHA256,
    );
  });

  it('assertVkeyPinMatches succeeds for committed demo', () => {
    const s = assertVkeyPinMatches();
    assert.equal(s.pinMatch, true);
  });

  it('resolveCeremonyMode returns demo for current meta', () => {
    const mode = resolveCeremonyMode();
    assert.ok(mode === 'demo' || mode === 'unknown');
  });
});
