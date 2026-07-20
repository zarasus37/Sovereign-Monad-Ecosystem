import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attemptFreeText,
  attemptStructuredRefusal,
  createArchon,
  REQUIRED_ENVELOPE,
} from './phase3Archon.js';

describe('phase3Archon', () => {
  it('rejects free-text by design', () => {
    const a = createArchon('p1');
    const r = attemptFreeText(a, 'No thanks, that would be bad and unethical.');
    assert.equal(r.passed, false);
    assert.ok(r.failures.includes('X-STRUCTURED-OUTPUT'));
  });

  it('rejects missing audit_trace and wrong envelope', () => {
    const a = createArchon('p1');
    const r = attemptStructuredRefusal(a, {
      constraint_envelope_version: '1.0.0',
      audit_trace: [],
      failing_rule: 'X-AUDITABILITY',
    });
    assert.equal(r.passed, false);
    assert.ok(r.failures.includes('empty_audit_trace'));
    assert.ok(r.failures.includes('envelope_regression'));
  });

  it('passes structured covenant refusal', () => {
    const a = createArchon('p1');
    const r = attemptStructuredRefusal(a, {
      constraint_envelope_version: REQUIRED_ENVELOPE,
      audit_trace: ['Hepar:audit_required', 'Signal:Archon_Bypass_Offer'],
      failing_rule: 'X-AUDITABILITY',
      narrative: 'Sovereignty is mastery of constraint, not absence of it.',
    });
    assert.equal(r.passed, true);
    assert.equal(a.passed, true);
  });
});
