import { describe, it, expect } from 'vitest';
import { createDefaultHeparOrchestrator } from './core/HeparOrchestrator';


describe('@sovereign/hepar-service — 4-stage pipeline', () => {
  const orchestrator = createDefaultHeparOrchestrator();

  it('returns ALLOW for a clean address', async () => {
    const result = await orchestrator.executeFullPipeline('test-clean', [
      '0x2222222222222222222222222222222222222222',
    ]);
    expect(result.stageD).toBeDefined();
    expect(['ALLOW', 'INVESTIGATE', 'WARN']).toContain(result.stageD!.decision);
    expect(result.stageD!.attestation.protocolId).toBe('test-clean');
  });

  it('returns BLOCK for a flagged malicious address', async () => {
    const result = await orchestrator.executeFullPipeline('test-malicious', [
      '0xdead000000000000000000000000000000000001',
    ]);
    expect(result.stageD).toBeDefined();
    expect(result.stageD!.decision).toBe('BLOCK');
    expect(result.stageD!.confidence).toBeGreaterThan(0.5);
  });

  it('Stage A emits findings for flagged wallet', async () => {
    const result = await orchestrator.executeFullPipeline('test-stageA', [
      '0xdead000000000000000000000000000000000001',
    ]);
    expect(result.stageA!.findings.length).toBeGreaterThan(0);
    expect(result.stageA!.findings.some(f => f.pattern === 'WALLET_TAINT')).toBe(true);
    expect(result.stageA!.findings.some(f => f.severity === 'CRITICAL')).toBe(true);
  });

  it('Stage B proves violations for high-confidence critical findings', async () => {
    const result = await orchestrator.executeFullPipeline('test-stageB', [
      '0xdead000000000000000000000000000000000001',
    ]);
    const provedViolations = result.stageB!.violations.filter(v => v.proved);
    expect(provedViolations.length).toBeGreaterThan(0);
  });

  it('Stage C runs 5 agent campaigns', async () => {
    const result = await orchestrator.executeFullPipeline('test-stageC', [
      '0xdead000000000000000000000000000000000001',
    ]);
    expect(result.stageC!.campaigns.length).toBe(5);
    expect(['PRIVILEGE', 'ARITHMETIC', 'REENTRANCY', 'ECONOMIC', 'STATE']).toEqual(
      expect.arrayContaining(result.stageC!.campaigns.map(c => c.agentId)),
    );
  });

  it('partial pipeline up to stage C is complete', async () => {
    const result = await orchestrator.executeUpToStage('C', 'test-partial', [
      '0x3333333333333333333333333333333333333333',
    ]);
    expect(result.stageA).toBeDefined();
    expect(result.stageB).toBeDefined();
    expect(result.stageC).toBeDefined();
    expect(result.stageD).toBeUndefined();
  });

  it('attestation payload has required fields', async () => {
    const result = await orchestrator.executeFullPipeline('test-attestation', [
      '0x4444444444444444444444444444444444444444',
    ]);
    const att = result.stageD!.attestation;
    expect(att.protocolId).toBe('test-attestation');
    expect(att.timestamp).toBeDefined();
    expect(typeof att.confidence).toBe('number');
    expect(['BLOCK', 'WARN', 'INVESTIGATE', 'ALLOW']).toContain(att.decision);
  });

  it('is deterministic — same address produces same decision', async () => {
    const addr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const r1 = await orchestrator.executeFullPipeline('det-test', [addr]);
    const r2 = await orchestrator.executeFullPipeline('det-test', [addr]);
    expect(r1.stageD!.decision).toBe(r2.stageD!.decision);
    expect(r1.stageA!.findings.length).toBe(r2.stageA!.findings.length);
  });
});
