/**
 * Lightweight mock Hepar forensic API for local/staging (Vector 4.4).
 *
 *   pnpm --filter @sovereign/host mock-hepar
 *
 * Point Cardia at it:
 *   HEPAR_API_URL=http://localhost:3002/api/v1/hepar
 *   HEPAR_AUDIT_MODE=http
 *
 * Rules:
 *   - address containing "dead" or "beef" → FAIL_MALICIOUS_CONTRACT
 *   - address on body.forceFail or HEPAR_AUDIT_FAIL_ADDRESSES → FAIL_SANCTIONED
 *   - otherwise PASS
 */

import express, { type Request, type Response } from 'express';
import type { HeparAuditResponse, HeparAuditVerdict } from '@sovereign/types';

const PORT = Number(process.env.HEPAR_MOCK_PORT) || 3002;

function failSet(): Set<string> {
  return new Set(
    (process.env.HEPAR_AUDIT_FAIL_ADDRESSES || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function audit(targetAddress: string): HeparAuditResponse {
  const addr = (targetAddress || '').toLowerCase();
  const auditId = `mock-${Date.now().toString(36)}`;

  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return {
      verdict: 'FAIL_HIGH_RISK',
      riskScore: 1,
      flags: ['invalid_evm_address', 'mock_hepar'],
      auditId,
      reason: 'invalid_evm_address',
    };
  }

  if (failSet().has(addr)) {
    return {
      verdict: 'FAIL_SANCTIONED',
      riskScore: 0.95,
      flags: ['address_on_fail_list', 'mock_hepar'],
      auditId,
      reason: 'address_on_fail_list',
    };
  }

  if (addr.includes('dead') || addr.includes('beef')) {
    return {
      verdict: 'FAIL_MALICIOUS_CONTRACT',
      riskScore: 0.95,
      flags: ['mock_malicious_signature', 'mock_hepar'],
      auditId,
      reason: 'mock_malicious_signature',
    };
  }

  return {
    verdict: 'PASS' satisfies HeparAuditVerdict,
    riskScore: 0.05,
    flags: ['mock_hepar'],
    auditId,
    reason: 'mock_pass_clean_target',
  };
}

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ALIVE', service: 'mock-hepar', port: PORT });
});

app.post('/api/v1/hepar/audit-address', (req: Request, res: Response) => {
  // Optional bearer gate for local realism
  const required = process.env.HEPAR_API_KEY;
  if (required) {
    const auth = req.header('authorization') || '';
    if (auth !== `Bearer ${required}`) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
  }

  const targetAddress =
    typeof req.body?.targetAddress === 'string' ? req.body.targetAddress : '';
  const result = audit(targetAddress);
  console.log(
    `[Mock Hepar] ${targetAddress} → ${result.verdict} (${result.auditId})`,
  );
  res.json(result);
});

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('mock-hepar-server.ts') ||
    process.argv[1].endsWith('mock-hepar-server.js'));

if (isMain) {
  app.listen(PORT, () => {
    console.log(`[Mock Hepar] Listening on ${PORT}`);
    console.log(`  POST /api/v1/hepar/audit-address`);
    console.log(`  GET  /health`);
  });
}

export { app as mockHeparApp, audit as mockHeparAudit };
