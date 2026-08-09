/**
 * Council Hold — full Court simultaneous hold under TTCL middle.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  openMiddleHold,
  perceiveSeat,
  perceiveFullCourt,
  focusSeats,
  refuseBecome,
  attemptInstallAsHolderReality,
  findCrossDomainLinks,
  middleHoldSign,
  holdToEventPayload,
  holdSnapshot,
  validateMemberSubstrate,
  validateCouncilIndex,
  BecomeForbiddenError,
  HOLD_POLICY,
  type CouncilSubstrateIndex,
  type MemberSubstrate,
} from '../src/runtime/index.js';

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);
const indexPath = join(
  root,
  'shared/fixtures/layer6/council-substrate-index.json',
);
const substrateDir = join(root, 'shared/fixtures/layer6/council-substrates');

function loadIndex(): CouncilSubstrateIndex {
  return JSON.parse(readFileSync(indexPath, 'utf8')) as CouncilSubstrateIndex;
}

function loadAllSubstrates(): MemberSubstrate[] {
  return readdirSync(substrateDir)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        JSON.parse(
          readFileSync(join(substrateDir, f), 'utf8'),
        ) as MemberSubstrate,
    );
}

describe('CouncilHold (middle / full Court)', () => {
  it('index and substrates validate', () => {
    const index = loadIndex();
    expect(validateCouncilIndex(index)).toEqual([]);
    expect(index.members.length).toBe(71);
    const subs = loadAllSubstrates();
    expect(subs.length).toBe(71);
    for (const s of subs) {
      expect(validateMemberSubstrate(s)).toEqual([]);
      expect(s.hold_policy).toBe(HOLD_POLICY);
    }
  });

  it('opens full-court hold with all 71 seats simultaneously', () => {
    const index = loadIndex();
    const hold = openMiddleHold(index, { substrates: loadAllSubstrates() });
    expect(hold.mode).toBe('hold-full-court');
    expect(hold.seat_count).toBe(71);
    expect(hold.middle.reality_locus).toBe('middle');
    expect(hold.middle.logical_state).toBe('ttcl-unified');
    expect(hold.hold_policy).toBe(HOLD_POLICY);
    expect(hold.seats.size).toBe(71);
    // Simultaneous: Turing and Enheduanna both present
    expect(hold.seats.has('alan-turing')).toBe(true);
    expect(hold.seats.has('enheduanna')).toBe(true);
    expect(hold.seats.has('cristobal-colon')).toBe(true);
  });

  it('perceives full extent as truth-for-seat, not holder reality', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    const turing = perceiveSeat(hold, 'alan-turing');
    expect(turing.epistemic.status).toBe('truth-for-seat');
    expect(turing.epistemic.is_holder_reality).toBe(false);
    expect(turing.epistemic.is_identity_merged).toBe(false);
    expect(turing.epistemic.fractal_complete).toBe(true);
    expect(turing.full_extent.contribution.length).toBeGreaterThan(20);
    expect(turing.full_extent.key_insight.length).toBeGreaterThan(10);
    // Middle unchanged
    expect(hold.middle.reality_locus).toBe('middle');
  });

  it('perceiveFullCourt returns all seats at once', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    const all = perceiveFullCourt(hold);
    expect(all).toHaveLength(71);
    expect(all.every((p) => p.epistemic.is_holder_reality === false)).toBe(
      true,
    );
  });

  it('focus does not drop full-court hold', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    const session = focusSeats(hold, [
      'charles-sanders-peirce',
      'victoria-lady-welby',
      'ramon-llull',
    ]);
    expect(session.focused_member_ids).toHaveLength(3);
    expect(session.perspectives).toHaveLength(3);
    expect(session.hold.seat_count).toBe(71);
    expect(session.hold.seats.has('alan-turing')).toBe(true);
  });

  it('refuses become / install as holder reality', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    expect(() => refuseBecome(hold, 'kurt-godel')).toThrow(BecomeForbiddenError);
    expect(() => attemptInstallAsHolderReality(hold, 'kurt-godel')).toThrow(
      BecomeForbiddenError,
    );
  });

  it('finds cross-domain links under simultaneous hold', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    const links = findCrossDomainLinks(hold, [
      'charles-sanders-peirce',
      'victoria-lady-welby',
      'ramon-llull',
      'johannes-trithemius',
      'alan-turing',
      'kurt-godel',
    ]);
    // Wheel cluster should link
    const wheelPair = links.find(
      (l) =>
        (l.a === 'charles-sanders-peirce' &&
          l.b === 'victoria-lady-welby') ||
        (l.b === 'charles-sanders-peirce' &&
          l.a === 'victoria-lady-welby'),
    );
    expect(wheelPair).toBeDefined();
    expect(wheelPair!.shared_specialty_kinds).toContain('wheel-registry');
  });

  it('middleHoldSign + holdToEventPayload emit from middle, not seat identity', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    const sign = middleHoldSign(hold, {
      memberIds: ['enheduanna', 'ramon-llull'],
    });
    expect(sign.modality).toBe('HYBRID');
    expect(sign.domains).toEqual([
      'THEOLOGY',
      'TECHNOLOGY',
      'COSMOLOGY',
    ]);
    const payload = holdToEventPayload(hold, [
      'enheduanna',
      'ramon-llull',
    ]);
    expect(payload.kind).toBe('council-middle-hold');
    expect(payload.reality_locus).toBe('middle');
    expect(
      (payload.epistemic as { seats_are_holder_reality: boolean })
        .seats_are_holder_reality,
    ).toBe(false);
    expect(
      (payload.epistemic as { identity_merged: boolean }).identity_merged,
    ).toBe(false);
    expect(payload.included).toEqual(['enheduanna', 'ramon-llull']);
  });

  it('holdSnapshot lists court', () => {
    const hold = openMiddleHold(loadIndex(), {
      substrates: loadAllSubstrates(),
    });
    const snap = holdSnapshot(hold);
    expect(snap.seat_count).toBe(71);
    expect(snap.member_ids).toContain('cristobal-colon');
    expect(snap.hold_policy).toBe(HOLD_POLICY);
  });
});
