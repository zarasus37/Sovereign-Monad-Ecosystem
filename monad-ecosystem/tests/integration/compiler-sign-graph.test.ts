/**
 * @sovereign/compiler — L3 SemioticDialect loader + L2 SignGraphDialect passes
 * + L1 ProvenanceDialect + L0 lowering.
 *
 * The full four-level compiler stack (L3 load → L2 inference/rewrite/
 * constitution/budget → L1 provenance → L0 the @sovereign/ttcl runtime). The
 * keystone guarantee under test (`theo-techno-cosmo/plex/Review/The Four
 * Fundamentals TTCL Is Built.txt:85`): a constitution-failing program raises a
 * `CompilerError` at L2 and never reaches L0 — the 0.72 threshold is a compile
 * gate, not an after-the-fact filter.
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

import {
  compileProgram,
  loadProgram,
  inferTypes,
  rewriteGraph,
  eliminatedNodes,
} from '@sovereign/compiler';
import {
  CompilerError,
  ProgramSchemaError,
  UnresolvedReferenceError,
  CyclicSsaError,
  InvalidOutputError,
  LatticeAbortError,
  ConstitutionCompileError,
  ProvenanceCompileError,
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

  it('rejects attachModality without a modality field (schema if/then)', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oBad", op: "attachModality", inputs: ["sTech"] },
      ],
      output: "oCompose",
    });
    expect(() => loadProgram(prog)).toThrow(ProgramSchemaError);
  });

  it('rejects attachModality with more than one input (schema if/then)', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oBad", op: "attachModality", inputs: ["sTech", "sCosmo"], modality: "SYMBOL" },
      ],
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

  it("map / fold / choose over a single input carry their carrier's type (branch-join of one = passthrough)", () => {
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
    // A single-input branch-join is the carrier's type (HYBRID + triadic here).
    for (const id of ['oMap', 'oFold', 'oChoose']) {
      expect(types.get(id)!.modality).toBe('HYBRID');
      expect(types.get(id)!.domains).toEqual(['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY']);
    }
  });

  it('fold / choose infer the lattice JOIN of all branches (full branch-join semantics)', () => {
    // sTheo SYMBOL/THEO, sTech INDEX/TECH, sCosmo SYMBOL/COSMO, sPure PURE/COSMO.
    const prog = triadicProgram({
      signs: [
        { id: "sTheo", class_id: 8, mode: "INDEX", domain: "THEOLOGY", modality: "SYMBOL", pps: 0.30, noRlhf: true },
        { id: "sTech", class_id: 2, mode: "INDEX", domain: "TECHNOLOGY", modality: "INDEX", pps: 0.50, noRlhf: true },
        { id: "sCosmo", class_id: 42, mode: "SYMBOL", domain: "COSMOLOGY", modality: "SYMBOL", pps: 0.40, noRlhf: true },
        { id: "sPure", class_id: 42, mode: "SYMBOL", domain: "COSMOLOGY", modality: "PURE", pps: 0.40, noRlhf: true },
      ],
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        // distinct non-PURE modalities (SYMBOL ⊔ INDEX) → HYBRID; domains union.
        { id: "oChooseMix", op: "choose", inputs: ["sTheo", "sTech"] },
        // two same-modality SYMBOL branches → SYMBOL; domains union.
        { id: "oFoldSym", op: "fold", inputs: ["sTheo", "sCosmo"] },
        // a PURE branch is the join identity → SYMBOL survives; domains union.
        { id: "oChoosePure", op: "choose", inputs: ["sPure", "sTheo"] },
        // all-PURE branches → PURE.
        { id: "oFoldPure", op: "fold", inputs: ["sPure", "sPure"] },
      ],
      output: "oCompose",
    });
    const graph = loadProgram(prog);
    const types = inferTypes(graph);
    expect(types.get('oChooseMix')!.modality).toBe('HYBRID');
    expect(types.get('oChooseMix')!.domains).toEqual(['THEOLOGY', 'TECHNOLOGY']);
    expect(types.get('oFoldSym')!.modality).toBe('SYMBOL');
    expect(types.get('oFoldSym')!.domains).toEqual(['THEOLOGY', 'COSMOLOGY']);
    expect(types.get('oChoosePure')!.modality).toBe('SYMBOL');
    expect(types.get('oChoosePure')!.domains).toEqual(['THEOLOGY', 'COSMOLOGY']);
    expect(types.get('oFoldPure')!.modality).toBe('PURE');
  });

  it('attachModality overrides the carrier modality in inference (domains inherited)', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oSym", op: "attachModality", inputs: ["sTech"], modality: "SYMBOL" },
        { id: "oPure", op: "attachModality", inputs: ["sCosmo"], modality: "PURE" },
      ],
      output: "oCompose",
    });
    const graph = loadProgram(prog);
    const types = inferTypes(graph);
    expect(types.get('oSym')!.modality).toBe('SYMBOL');
    expect(types.get('oSym')!.domains).toEqual(['TECHNOLOGY']);
    expect(types.get('oPure')!.modality).toBe('PURE');
    expect(types.get('oPure')!.domains).toEqual(['COSMOLOGY']);
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

describe('L2 — rewrite (fusion / simplification — map identity-elimination)', () => {
  it('eliminates a map passthrough: resolve map points at the carrier', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oMap", op: "map", inputs: ["oCompose"] },
      ],
      output: "oMap",
    });
    const graph = loadProgram(prog);
    const resolve = rewriteGraph(graph);
    expect(resolve.get('oMap')).toBe('oCompose');
    // Non-map nodes resolve to themselves.
    expect(resolve.get('oCompose')).toBe('oCompose');
    expect(resolve.get('sTheo')).toBe('sTheo');
    expect(eliminatedNodes(resolve)).toEqual(['oMap']);
  });

  it('collapses a map∘map chain transitively to the carrier (the fusion rule)', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oMap1", op: "map", inputs: ["oCompose"] },
        { id: "oMap2", op: "map", inputs: ["oMap1"] },
      ],
      output: "oMap2",
    });
    const graph = loadProgram(prog);
    const resolve = rewriteGraph(graph);
    // Both maps resolve directly to the carrier (transitive, one hop).
    expect(resolve.get('oMap1')).toBe('oCompose');
    expect(resolve.get('oMap2')).toBe('oCompose');
    expect(eliminatedNodes(resolve)).toEqual(['oMap1', 'oMap2']);
  });

  it('eliminates a map over a leaf sign too', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oMapLeaf", op: "map", inputs: ["sCosmo"] },
      ],
      output: "oCompose",
    });
    const graph = loadProgram(prog);
    const resolve = rewriteGraph(graph);
    expect(resolve.get('oMapLeaf')).toBe('sCosmo');
  });

  it('does NOT eliminate attachModality (it changes modality, not a passthrough)', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oSym", op: "attachModality", inputs: ["sTech"], modality: "SYMBOL" },
      ],
      output: "oCompose",
    });
    const graph = loadProgram(prog);
    const resolve = rewriteGraph(graph);
    expect(resolve.get('oSym')).toBe('oSym');
    expect(eliminatedNodes(resolve)).toEqual([]);
  });

  it('compiles a program whose output is an eliminated map (fuses to the carrier)', () => {
    const prog = triadicProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oMap", op: "map", inputs: ["oCompose"] },
      ],
      output: "oMap",
    });
    const result = compileProgram(prog);
    // The map is eliminated → the output sign is oCompose's HYBRID triadic Sign.
    expect(result.resolve.get('oMap')).toBe('oCompose');
    expect(result.output.sign.modality).toBe('HYBRID');
    expect(Array.from(result.output.sign.domains ?? [])).toEqual([
      'THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY',
    ]);
    expect(result.constitution.pass).toBe(true);
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

// A minimal valid triadic program carrying a provenance section. The keycaps
// reuse the main-graph wheel `wTheo` (size 9) with a 256-alphabet — the wheel
// budget stays at 9 (within 1000), and the shared-wheel round-trip works because
// `decodeSign` resets the wheel to the EncToken's `keyOffset` before decrypt.
function provenanceProgram(overrides: Record<string, unknown> = {}): unknown {
  return {
    program: "test-provenance",
    wheels: [{ id: "wTheo", size: 9, initial: 0 }],
    signs: [
      { id: "sTheo", class_id: 8, mode: "INDEX", domain: "THEOLOGY", modality: "SYMBOL", pps: 0.30, noRlhf: true },
      { id: "sTech", class_id: 2, mode: "INDEX", domain: "TECHNOLOGY", modality: "INDEX", pps: 0.50, noRlhf: true },
      { id: "sCosmo", class_id: 42, mode: "SYMBOL", domain: "COSMOLOGY", modality: "SYMBOL", pps: 0.40, noRlhf: true },
    ],
    ops: [{ id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] }],
    constitution: { threshold: 0.72 },
    budget: 1000,
    output: "oCompose",
    provenance: {
      keyCaps: [
        { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
        { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
      ],
      tokens: [
        { id: "t1", op: "emitToken", index: 0 },
        { id: "t2", op: "emitToken", index: 1 },
        { id: "tRoot", op: "mergeProvenance", inputs: ["t1", "t2"] },
      ],
      ops: [
        { id: "enc1", op: "encodeSign", sign: "sCosmo", wheel: "wTheo", keyCap: "kEnc" },
        { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
      ],
    },
    ...overrides,
  };
}

/** Distinguish an EncToken (has `cipher`) from a Sign (has `modality`). */
function isEncToken(v: unknown): boolean {
  return typeof v === "object" && v !== null && "cipher" in v && !("modality" in v);
}

describe('L1 ProvenanceDialect — linear threading + capability + lowering', () => {
  it('compiles a provenance program: output stays a Sign; L0 lowers EncToken + recovered Sign', async () => {
    const result = compileProgram(await loadFixture('semiotic-provenance.json'));
    // The semantic output is unchanged — still the HYBRID triadic Sign.
    expect(result.output.sign.modality).toBe('HYBRID');
    expect(result.constitution.pass).toBe(true);
    // L1 verdict passes; one terminal token (the provenance root).
    expect(result.provenance.verdict.pass).toBe(true);
    expect(result.provenance.verdict.rootToken).toBe('tRoot');

    // L0 lowering: enc1 → an opaque EncToken; dec1 → the recovered Sign.
    const enc1 = result.provenance.values.get('enc1');
    const dec1 = result.provenance.values.get('dec1');
    expect(isEncToken(enc1)).toBe(true);
    expect(isEncToken(dec1)).toBe(false);

    const enc = enc1 as { cipher: number[]; keyOffset: number };
    // The cipher is byte-range (the Trithemius ciphertext), not the plaintext.
    expect(enc.cipher.length).toBeGreaterThan(0);
    expect(enc.cipher.some((n) => n >= 256)).toBe(false);
    expect(typeof enc.keyOffset).toBe('number');

    // The recovered Sign matches sCosmo modulo trace (lossy, like the codec).
    const recovered = dec1 as { modality: string; domain: string; pps: number; peirce: { sign_class_id: number }; trace?: unknown };
    expect(recovered.modality).toBe('SYMBOL');
    expect(recovered.domain).toBe('COSMOLOGY');
    expect(recovered.pps).toBeCloseTo(0.40, 6);
    expect(recovered.peirce.sign_class_id).toBe(42);
    expect(recovered.trace).toBeUndefined();
  });

  it('encode/decode round-trips the sign through the L0-lowered EncToken', async () => {
    const result = compileProgram(await loadFixture('semiotic-provenance.json'));
    const dec1 = result.provenance.values.get('dec1') as { modality: string; domain: string; pps: number; peirce: { sign_class_id: number; path: readonly string[] } };
    // The decoded sign's semantically-significant fields match the encoded
    // sCosmo (class_id 42, SYMBOL, COSMOLOGY, pps 0.40) — the round-trip holds.
    expect(dec1.peirce.sign_class_id).toBe(42);
    expect(dec1.modality).toBe('SYMBOL');
    expect(dec1.domain).toBe('COSMOLOGY');
  });

  it('rejects a double-consumed KeyCap with ProvenanceCompileError (L1, before L0)', () => {
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [{ id: "kShared", wheel: "wTheo", alphabetSize: 256 }],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sCosmo", wheel: "wTheo", keyCap: "kShared" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kShared" },
        ],
      },
    });
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/kShared.*2/);
    expect(() => compileProgram(prog)).toThrow(CompilerError);
  });

  it('rejects an unconsumed KeyCap with ProvenanceCompileError (every capability must be spent)', () => {
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
          { id: "kUnused", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sCosmo", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/kUnused.*never consumed/);
  });

  it('rejects an ambiguous provenance root (>1 unconsumed token)', () => {
    // Two emitTokens, no merge → two unconsumed terminals → ambiguous root.
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [
          { id: "t1", op: "emitToken", index: 0 },
          { id: "t2", op: "emitToken", index: 1 },
        ],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sCosmo", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/ambiguous provenance root/);
  });

  it('a multi-level mergeProvenance chain compiles with the final merge as root', () => {
    // t1, t2 (emit) → m1 = merge(t1) → m2 = merge(t2, m1) → m3 = merge(m2).
    // t1, t2, m1, m2 are each consumed exactly once; m3 is the single root.
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [
          { id: "t1", op: "emitToken", index: 0 },
          { id: "t2", op: "emitToken", index: 1 },
          { id: "m1", op: "mergeProvenance", inputs: ["t1"] },
          { id: "m2", op: "mergeProvenance", inputs: ["t2", "m1"] },
          { id: "m3", op: "mergeProvenance", inputs: ["m2"] },
        ],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sCosmo", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    const result = compileProgram(prog);
    expect(result.provenance.verdict.pass).toBe(true);
    expect(result.provenance.verdict.rootToken).toBe('m3');
  });

  it('rejects a double-consumed token (linear single-use)', () => {
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [
          { id: "t1", op: "emitToken", index: 0 },
          { id: "t2", op: "emitToken", index: 1 },
          { id: "m1", op: "mergeProvenance", inputs: ["t1"] },
          { id: "m2", op: "mergeProvenance", inputs: ["t1", "t2"] },
        ],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sCosmo", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    // t1 consumed by both m1 and m2 → double-consume. m1 and m2 unconsumed →
    // ambiguous root too; the double-consume reasoning is surfaced.
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/t1.*consumed 2/);
  });

  it('rejects an encodeSign over a non-SYMBOL sign (compile-time modality gate)', () => {
    // sTech is INDEX-modality — encodeSign requires SYMBOL.
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sTech", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/SYMBOL-modality sign, got INDEX/);
  });

  it('rejects a dangling provenance ref with UnresolvedReferenceError (L3)', () => {
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [{ id: "kEnc", wheel: "wTheo", alphabetSize: 256 }],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sGhost", wheel: "wTheo", keyCap: "kEnc" },
        ],
      },
    });
    expect(() => loadProgram(prog)).toThrow(UnresolvedReferenceError);
    expect(() => loadProgram(prog)).toThrow(/sGhost/);
  });

  it('a program with no provenance section compiles unchanged (L1 is a no-op)', () => {
    const result = compileProgram(provenanceProgram({ provenance: undefined }));
    expect(result.provenance.verdict.pass).toBe(true);
    expect(result.provenance.values.size).toBe(0);
    expect(result.output.sign.modality).toBe('HYBRID');
  });

  it('encodeSign/decodeSign in the L2 `ops` array is still a schema error (not provenance)', () => {
    // The L2 `ops` enum is unchanged — encodeSign belongs in provenance.ops.
    const prog = provenanceProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oBad", op: "encodeSign", inputs: ["sCosmo"] },
      ],
      output: "oCompose",
    });
    expect(() => loadProgram(prog)).toThrow(ProgramSchemaError);
  });
});

describe('L2 attachModality → L1 encodeSign (promote a non-SYMBOL sign to encodable)', () => {
  it('compiles the attach-modality fixture: enc1 encodes the promoted op output', async () => {
    // sTech is declared INDEX; oSym = attachModality(sTech, SYMBOL) promotes it.
    // encodeSign over oSym passes the L1 SYMBOL check and lowers to an EncToken.
    const result = compileProgram(await loadFixture('semiotic-attach-modality.json'));
    expect(result.constitution.pass).toBe(true);
    expect(result.provenance.verdict.pass).toBe(true);

    // Inference gave the attached op the SYMBOL modality (the L1 check reads it).
    expect(result.types.get('oSym')!.modality).toBe('SYMBOL');

    // L0: enc1 → an opaque EncToken; dec1 → the recovered SYMBOL Sign.
    const enc1 = result.provenance.values.get('enc1');
    const dec1 = result.provenance.values.get('dec1');
    expect(isEncToken(enc1)).toBe(true);
    expect(isEncToken(dec1)).toBe(false);
    const recovered = dec1 as { modality: string; domain: string; pps: number; peirce: { sign_class_id: number } };
    // The decoded sign matches the encoded oSym (= sTech with SYMBOL attached).
    expect(recovered.modality).toBe('SYMBOL');
    expect(recovered.domain).toBe('TECHNOLOGY');
    expect(recovered.peirce.sign_class_id).toBe(2);
  });

  it('encodeSign over a bare non-SYMBOL sign still fails L1 (no attachModality)', () => {
    // sTech is INDEX — without an attachModality promotion, encodeSign fails.
    const prog = provenanceProgram({
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "sTech", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/SYMBOL-modality sign, got INDEX/);
  });

  it('attachModality to a non-SYMBOL modality does NOT rescue encodeSign (L1 still fails)', () => {
    // attachModality(sTech, INDEX) — still INDEX → encodeSign over it fails.
    const prog = provenanceProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oIdx", op: "attachModality", inputs: ["sTech"], modality: "INDEX" },
      ],
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "oIdx", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    expect(() => compileProgram(prog)).toThrow(ProvenanceCompileError);
    expect(() => compileProgram(prog)).toThrow(/SYMBOL-modality sign, got INDEX/);
  });

  it('attachModality to SYMBOL rescues encodeSign over an op output (the use case)', () => {
    // The same shape as the bare-failure case above, but oSym promotes to SYMBOL.
    const prog = provenanceProgram({
      ops: [
        { id: "oCompose", op: "compose", inputs: ["sTheo", "sTech", "sCosmo"] },
        { id: "oSym", op: "attachModality", inputs: ["sTech"], modality: "SYMBOL" },
      ],
      provenance: {
        keyCaps: [
          { id: "kEnc", wheel: "wTheo", alphabetSize: 256 },
          { id: "kDec", wheel: "wTheo", alphabetSize: 256 },
        ],
        tokens: [{ id: "t1", op: "emitToken", index: 0 }],
        ops: [
          { id: "enc1", op: "encodeSign", sign: "oSym", wheel: "wTheo", keyCap: "kEnc" },
          { id: "dec1", op: "decodeSign", token: "enc1", wheel: "wTheo", keyCap: "kDec" },
        ],
      },
    });
    const result = compileProgram(prog);
    expect(result.provenance.verdict.pass).toBe(true);
    expect(isEncToken(result.provenance.values.get('enc1'))).toBe(true);
  });
});