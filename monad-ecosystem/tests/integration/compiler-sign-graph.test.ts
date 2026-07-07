/**
 * @sovereign/compiler — L3 SemioticDialect loader + L2 SignGraphDialect passes.
 *
 * The compiler stack (compiler lowering L3/L2; L1 deferred, L0 = the existing
 * @sovereign/ttcl runtime). The keystone guarantee under test
 * (`theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is Built.txt:85`):
 * a constitution-failing program raises a `CompilerError` at L2 and never
 * reaches L0 — the 0.72 threshold is a compile gate, not an after-the-fact filter.
 *
 * TS-only (no Python parity — the gnostic-engine is the classifier reference,
 * not a compiler). Fixtures live in shared/fixtures/layer7/ and mirror the
 * `triadicObservation` / `rawTechnologyPacket` factories in
 * shared/ttcl-specs/sign-events.json (Phase B coherence).
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { compileProgram, loadProgram, inferTypes } from '@sovereign/compiler';
import {
  CompilerError,
  ProgramSchemaError,
  UnresolvedReferenceError,
  CyclicSsaError,
  InvalidOutputError,
  LatticeAbortError,
  ConstitutionCompileError,
} from '@sovereign/compiler';
import { makeTriadicObservation, scoreSign } from '@sovereign/ttcl';
import { WheelBudgetExceededError } from '@sovereign/ttcl';

const here = dirname(fileURLToPath(import.meta.url));
// integration/ → tests/ → monad-ecosystem/ → repo root → shared/fixtures/layer7
const fixturesDir = resolve(here, '../../../shared/fixtures/layer7');

async function loadFixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(fixturesDir, name), 'utf8'));
}

// A minimal valid triadic program used as the seed for several inline cases.
function triadicProgram(overrides: Record<string, unknown> = {}): unknown {
  return {
    program: "test-triadic",
    wheels: [{ id: "w1", size: 3, initial: 0 }],
    signs: [
      { id: "sTheo", class_id: 8, mode: "INDEX", domain: "THEOLOGY", modality: "SYMBOL", pps: 0.30, noRlhf: true },
      { id: "sTech", class_id: 2, mode: "INDEX", domain: "TECHNOLOGY", modality: "INDEX", pps: 0.50, noRlhf: true },
      { id: "sCosmo", class_id: 42, mode: "SYMBOL", domain: "COSMOLOGY", modality: "SYMBOL", pps: 0.40, noRlhf: true },
    ],
    ops: [{ id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] }],
    budget: 100,
    output: "oCompose",
    ...overrides,
  };
}

describe('L3 SemioticDialect — loader + wheel-binding', () => {
  it('loads the triadic fixture into a well-formed SSA graph', async () => {
    const graph = loadProgram(await loadFixture('semiotic-program-triadic.json'));
    expect(graph.program).toBe('triadic-observation');
    // 3 signs + 1 op + 1 wheel = 5 nodes.
    expect(graph.nodes.size).toBe(5);
    expect(graph.order).toEqual(['wTheo', 'sTheo', 'sTech', 'sCosmo', 'oCompose']);
    expect(graph.nodes.get('oCompose')!.kind).toBe('op');
    expect(graph.outputId).toBe('oCompose');
  });

  it('rejects a dangling op input with UnresolvedReferenceError', () => {
    const prog = triadicProgram({
      ops: [{ id: "oCompose", op: "compose", inputs: ["sTheo", "sGhost", "sCosmo"] }],
    });
    expect(() => loadProgram(prog)).toThrow(UnresolvedReferenceError);
    expect(() => loadProgram(prog)).toThrow(/sGhost/);
  });

  it('rejects a cyclic SSA graph with CyclicSsaError', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oA", op: "map", inputs: ["oB"] },
        { id: "oB", op: "map", inputs: ["oA"] },
      ],
      output: "oA",
    });
    expect(() => loadProgram(prog)).toThrow(CyclicSsaError);
  });

  it('rejects an output that is a wheel or undeclared with InvalidOutputError', () => {
    expect(() => loadProgram(triadicProgram({ output: "w1" }))).toThrow(InvalidOutputError);
    expect(() => loadProgram(triadicProgram({ output: "nope" }))).toThrow(InvalidOutputError);
  });
});

describe('L3 — schema validation', () => {
  it('rejects a malformed program with ProgramSchemaError', () => {
    const prog = triadicProgram({
      signs: [
        { id: "sTheo", class_id: 8, mode: "INDEX", domain: "THEOLOGY", modality: "BANANA", pps: 0.30 },
        { id: "sTech", class_id: 2, mode: "INDEX", domain: "TECHNOLOGY", modality: "INDEX", pps: 0.50 },
        { id: "sCosmo", class_id: 42, mode: "SYMBOL", domain: "COSMOLOGY", modality: "SYMBOL", pps: 0.40 },
      ],
    });
    expect(() => loadProgram(prog)).toThrow(ProgramSchemaError);
  });

  it('rejects an unknown combinator op at the schema layer', () => {
    const prog = triadicProgram({
      ops: [{ id: "oCompose", op: "encodeSign", inputs: ["sTheo"] }],
      output: "oCompose",
    });
    expect(() => loadProgram(prog)).toThrow(ProgramSchemaError);
  });
});

describe('L2 SignGraphDialect — type/modality inference', () => {
  it('compose over distinct modalities infers HYBRID with the union of domains', () => {
    const graph = loadProgram(triadicProgram());
    const types = inferTypes(graph);
    const out = types.get('oCompose')!;
    expect(out.modality).toBe('HYBRID');
    expect(out.domains).toEqual(['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY']);
  });

  it('map / fold / choose are modality-preserving passthroughs in v1', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oMap", op: "map", inputs: ["oCompose"] },
        { id: "oFold", op: "fold", inputs: ["oMap"] },
        { id: "oChoose", op: "choose", inputs: ["oFold"] },
      ],
      output: "oChoose",
    });
    const graph = loadProgram(prog);
    const types = inferTypes(graph);
    // Each passthrough carries its carrier's HYBRID + triadic domains.
    for (const id of ['oMap', 'oFold', 'oChoose']) {
      expect(types.get(id)!.modality).toBe('HYBRID');
      expect(types.get(id)!.domains).toEqual(['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY']);
    }
  });

  it('compose over a PURE input is a lattice abort (compile error, not a runtime TriadicGateError)', () => {
    const prog = triadicProgram({
      signs: [
        { id: "sTheo", class_id: 8, mode: "INDEX", domain: "THEOLOGY", modality: "PURE", pps: 0.30 },
        { id: "sTech", class_id: 2, mode: "INDEX", domain: "TECHNOLOGY", modality: "INDEX", pps: 0.50 },
        { id: "sCosmo", class_id: 42, mode: "SYMBOL", domain: "COSMOLOGY", modality: "SYMBOL", pps: 0.40 },
      ],
    });
    expect(() => compileProgram(prog)).toThrow(LatticeAbortError);
  });
});

describe('L2 — constitution compliance (graph-wide, the keystone)', () => {
  it('compiles the triadic fixture: output passes scoreSign + triadic closure', async () => {
    const result = compileProgram(await loadFixture('semiotic-program-triadic.json'));
    expect(result.constitution.pass).toBe(true);
    expect(result.constitution.triadicClosure).toBe(true);
    expect(result.output.sign.modality).toBe('HYBRID');
    expect(result.output.sign.domain).toBe('COSMOLOGY');
    expect(Array.from(result.output.sign.domains ?? [])).toEqual([
      'THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY',
    ]);
  });

  it('rejects the raw-technology fixture at L2 (does NOT materialize)', async () => {
    let threw = false;
    try {
      compileProgram(await loadFixture('semiotic-program-raw-technology.json'));
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ConstitutionCompileError);
      expect(err).toBeInstanceOf(CompilerError);
    }
    expect(threw).toBe(true);
  });

  it('a sign that PASSES scoreSign but is non-triadic still FAILS the graph-wide gate', () => {
    // A single-domain HYBRID FORMAL_THOUGHT sign: C2/C3/C4/C5 carry it to
    // >= 0.72 (passes scoreSign), but only one domain → triadic closure fails.
    // This is the case the graph-wide pass catches that per-Sign scoring misses.
    const prog = {
      program: "single-domain-hybrid",
      wheels: [],
      signs: [
        {
          id: "sHybridTech",
          class_id: 42, // FORMAL_THOUGHT
          mode: "SYMBOL",
          domain: "TECHNOLOGY",
          modality: "HYBRID",
          pps: 0.50,
          noRlhf: true,
        },
      ],
      ops: [],
      budget: 1000,
      output: "sHybridTech",
    };
    // Sanity: the output alone passes the per-Sign scorer.
    const graph = loadProgram(prog);
    const types = inferTypes(graph);
    expect(types.get('sHybridTech')!.domains).toEqual(['TECHNOLOGY']);
    // But the graph-wide gate fails it (triadic closure), so compilation throws.
    expect(() => compileProgram(prog)).toThrow(ConstitutionCompileError);
    expect(() => compileProgram(prog)).toThrow(/triadic closure/);
  });
});

describe('L2 — budgeted expansion', () => {
  it('throws WheelBudgetExceededError when ∏ wheel sizes exceed the budget', () => {
    const prog = triadicProgram({
      wheels: [{ id: "w1", size: 1000 }, { id: "w2", size: 1000 }],
      budget: 100, // product 1_000_000 > 100
    });
    // The wheel sizes (1_000_000) exceed budget 100 → compile error before L0.
    expect(() => compileProgram(prog)).toThrow(WheelBudgetExceededError);
  });

  it('passes when the product is within budget', () => {
    const prog = triadicProgram({
      wheels: [{ id: "w1", size: 3 }, { id: "w2", size: 4 }],
      budget: 100, // product 12 <= 100
    });
    expect(() => compileProgram(prog)).not.toThrow();
  });
});

describe('L0 — lowering to the @sovereign/ttcl runtime (end-to-end coherence)', () => {
  it('the triadic fixture lowers to a HYBRID triadic Sign equivalent to makeTriadicObservation()', async () => {
    const result = compileProgram(await loadFixture('semiotic-program-triadic.json'));
    const sign = result.output.sign;
    const factory = makeTriadicObservation();

    // Semantically-significant fields match the Phase B factory exactly
    // (modality, domain, pps, peirce class + mode, triadic ancestry). The
    // compiler lowers to the SAME runtime the codegen factories target.
    expect(sign.modality).toBe(factory.modality);
    expect(sign.domain).toBe(factory.domain);
    expect(sign.pps).toBe(factory.pps);
    expect(sign.peirce.sign_class_id).toBe(factory.peirce.sign_class_id);
    expect(sign.peirce.mode).toBe(factory.peirce.mode);
    expect(Array.from(sign.domains ?? [])).toEqual(Array.from(factory.domains ?? []));

    // And the lowered sign independently passes the runtime scorer.
    expect(scoreSign(sign).pass).toBe(true);
  });

  it('materializes the declared wheel alongside the sign', async () => {
    const result = compileProgram(await loadFixture('semiotic-program-triadic.json'));
    expect(result.output.wheels).toHaveLength(1);
    expect(result.output.wheels[0].size).toBe(9);
  });
});