import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  localHeparAudit,
  remoteHeparAudit,
  auditAddressForFunding,
} from './heparAuditClient.js';

const clean = '0x2222222222222222222222222222222222222222';
const dead = '0xdead000000000000000000000000000000000001';

describe('localHeparAudit', () => {
  it('PASSes clean EOAs', () => {
    const r = localHeparAudit({
      targetAddress: clean,
      context: 'TIER_1_FUNDING',
    });
    assert.equal(r.verdict, 'PASS');
    assert.ok(r.riskScore < 0.5);
    assert.ok(r.flags.includes('local_stub'));
  });

  it('FAIL_MALICIOUS_CONTRACT on dead/beef markers', () => {
    const r = localHeparAudit({
      targetAddress: dead,
      context: 'TIER_1_FUNDING',
    });
    assert.equal(r.verdict, 'FAIL_MALICIOUS_CONTRACT');
    assert.ok(r.riskScore >= 0.9);
  });

  it('FAIL_HIGH_RISK on invalid address', () => {
    const r = localHeparAudit({
      targetAddress: 'not-an-address',
      context: 'TIER_1_FUNDING',
    });
    assert.equal(r.verdict, 'FAIL_HIGH_RISK');
  });
});

describe('remoteHeparAudit fail-closed', () => {
  const prevUrl = process.env.HEPAR_API_URL;
  const prevTimeout = process.env.HEPAR_AUDIT_TIMEOUT_MS;

  before(() => {
    process.env.HEPAR_API_URL = 'http://127.0.0.1:9'; // closed port
    process.env.HEPAR_AUDIT_TIMEOUT_MS = '500';
  });

  after(() => {
    if (prevUrl === undefined) delete process.env.HEPAR_API_URL;
    else process.env.HEPAR_API_URL = prevUrl;
    if (prevTimeout === undefined) delete process.env.HEPAR_AUDIT_TIMEOUT_MS;
    else process.env.HEPAR_AUDIT_TIMEOUT_MS = prevTimeout;
  });

  it('returns ERROR_SERVICE_UNAVAILABLE when Hepar is unreachable', async () => {
    const r = await remoteHeparAudit({
      targetAddress: clean,
      context: 'TIER_1_FUNDING',
    });
    assert.equal(r.verdict, 'ERROR_SERVICE_UNAVAILABLE');
    assert.equal(r.riskScore, 1);
    assert.ok(r.flags.includes('fail_closed'));
    assert.equal(r.auditId, 'error-no-audit');
  });
});

describe('auditAddressForFunding mode switch', () => {
  const prevMode = process.env.HEPAR_AUDIT_MODE;
  const prevUrl = process.env.HEPAR_API_URL;

  after(() => {
    if (prevMode === undefined) delete process.env.HEPAR_AUDIT_MODE;
    else process.env.HEPAR_AUDIT_MODE = prevMode;
    if (prevUrl === undefined) delete process.env.HEPAR_API_URL;
    else process.env.HEPAR_API_URL = prevUrl;
  });

  it('local mode never hits network', async () => {
    process.env.HEPAR_AUDIT_MODE = 'local';
    delete process.env.HEPAR_API_URL;
    const r = await auditAddressForFunding({
      targetAddress: clean,
      context: 'TIER_1_FUNDING',
    });
    assert.equal(r.verdict, 'PASS');
    assert.ok(r.flags.includes('local_stub'));
  });
});
