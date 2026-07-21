// ─── Hepar Service: Express API Wrapper ──────────────────────────────────────
//
// Exposes POST /api/v1/hepar — the same interface the mock used.
// Sovereign-host's HEPAR_API_URL points here; we drop in without any changes
// to the Cardia funding engine.
//
// Decision mapping:
//   BLOCK       → verdict: FAIL_MALICIOUS_CONTRACT  (score ≈ 0.95)
//   WARN        → verdict: FAIL_ADVERSE_SELECTION    (score ≈ 0.60)
//   INVESTIGATE → verdict: WARN_INVESTIGATE          (score ≈ 0.30)
//   ALLOW       → verdict: PASS                      (score ≈ 0.05)

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createDefaultHeparOrchestrator } from './core/HeparOrchestrator.js';
import type {
  HeparAuditRequest,
  HeparAuditResponse,
  ActionBand,
  Severity,
} from './core/types/hepar.types.js';

const PORT = Number(process.env.PORT ?? 3003);
const orchestrator = createDefaultHeparOrchestrator();

const app = express();
app.use(cors());
app.use(express.json());

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ALIVE', service: '@sovereign/hepar-service', timestamp: new Date().toISOString() });
});

// ── Audit endpoint ────────────────────────────────────────────────────────────
app.post('/api/v1/hepar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as HeparAuditRequest;
    if (!body?.walletAddress) {
      res.status(400).json({ error: 'walletAddress required' });
      return;
    }

    const auditId     = `hepar-${crypto.randomBytes(6).toString('hex')}`;
    const protocolId  = body.protocolId ?? `wallet-audit-${body.walletAddress.slice(0, 10)}`;
    const addresses   = [body.walletAddress, ...(body.contractAddresses ?? [])];

    console.log(`[Hepar] Audit ${auditId} — ${body.walletAddress}`);
    const result = await orchestrator.executeFullPipeline(protocolId, addresses);

    const decision   = result.stageD!.decision;
    const confidence = result.stageD!.confidence;

    const verdictMap: Record<ActionBand, HeparAuditResponse['verdict']> = {
      BLOCK:       'FAIL_MALICIOUS_CONTRACT',
      WARN:        'FAIL_ADVERSE_SELECTION',
      INVESTIGATE: 'WARN_INVESTIGATE',
      ALLOW:       'PASS',
    };

    const scoreMap: Record<ActionBand, number> = {
      BLOCK:       0.95,
      WARN:        0.60,
      INVESTIGATE: 0.30,
      ALLOW:       0.05,
    };

    const topSev: Severity | null = (() => {
      const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      return order.find(s => result.stageA!.findings.some(f => f.severity === s)) ?? null;
    })();

    const response: HeparAuditResponse = {
      auditId,
      walletAddress: body.walletAddress,
      verdict:   verdictMap[decision],
      score:     scoreMap[decision],
      decision,
      confidence,
      attestation: result.stageD!.attestation,
      stageResults: {
        stageA: { findings: result.stageA!.findings.length, topSeverity: topSev },
        stageB: { violations: result.stageB!.violations.filter(v => v.proved).length },
        stageC: { campaigns: result.stageC!.campaigns.length, aggregatedFindings: result.stageC!.aggregatedFindings.length },
      },
      executionStatus: 'STUB',
      durationMs: result.totalDurationMs,
    };

    console.log(
      `[Hepar] ${auditId} → ${response.verdict} (${decision}, confidence=${confidence.toFixed(3)}, ${result.totalDurationMs}ms)`,
    );
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Hepar] Internal error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`[Hepar] Service listening on port ${PORT}`);
  console.log(`[Hepar] Pipeline: StageA(static) → StageB(symbolic) → StageC(monte-carlo×5) → StageD(consensus)`);
  console.log(`[Hepar] Mode: STUB (deterministic seeded forensics)`);
});

export default app;
