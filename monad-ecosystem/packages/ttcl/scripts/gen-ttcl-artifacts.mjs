#!/usr/bin/env node
/**
 * gen-ttcl-artifacts.mjs — Layer 3 code generator (Phase B: Sign→event bridge).
 *
 * Reads the canonical `shared/ttcl-specs/sign-events.json` and emits THREE
 * generated artifacts across TWO packages:
 *
 *   - monad-ecosystem/packages/sovereign-types/src/generated/ttcl-observation-event.json
 *       the Sign-event payload JSON Schema (extracted verbatim from the spec's
 *       `schema` block). Consumed by the validator file below + importable by any
 *       package that needs the canonical Sign payload shape.
 *   - monad-ecosystem/packages/ttcl/src/generated/sign-factories.ts
 *       thin `makeSign(...)` wrappers (makeTriadicObservation /
 *       makeRawTechnologyPacket). Lives in @sovereign/ttcl — the package that owns
 *       Sign/makeSign/getManifold — so factories stay with Sign construction and
 *       avoid the types↔logoc workspace cycle.
 *   - monad-ecosystem/packages/sovereign-types/src/generated/sign-event-validators.ts
 *       ajv-compiled validators (embed-and-compile-at-load). Five validators: the
 *       Sign-event payload + the 4 hand-written shared/schemas/*.json payloads.
 *       Build/test-only — never imported by runtime code (the bus keeps its
 *       hand-rolled validateIntentionTraceability; the zero-runtime-deps invariant
 *       is preserved). ajv + ajv-formats are devDependencies of @sovereign/types.
 *
 * The generator itself imports NO ajv — it only embeds schema JSON verbatim
 * (JSON.stringify), so codegen stays dep-free. The generated TS files import ajv
 * at module load (test time).
 *
 * Generated files carry a `@generated DO NOT EDIT` header + `@source` pointer.
 * Drift is caught by `scripts/check-ttcl-artifacts-drift.mjs`, which regenerates
 * all three artifacts in-memory and diffs against the committed copies. If a
 * hand-written shared/schemas/*.json changes, the generator re-embeds it → the
 * validator file changes → drift caught by string-diff.
 *
 * Usage:
 *   node monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs           # write
 *   node monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs --check    # diff only (CI)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..'); // scripts→ttcl→packages→monad-ecosystem→root
const specPath = resolve(repoRoot, 'shared/ttcl-specs/sign-events.json');
const SCHEMA_DIR = resolve(repoRoot, 'shared/schemas');

// The 4 hand-written payload schemas embedded into the validator file. Read at
// gen time so a change to any of them flows through to the generated validators
// (and is caught by the drift guard's string-diff).
const HAND_WRITTEN_SCHEMAS = [
  { file: 'signal-event.json', constName: 'SCHEMA_SIGNAL_EVENT', exportName: 'validateSignalEvent' },
  { file: 'gnosis-score.json', constName: 'SCHEMA_GNOSIS_SCORE', exportName: 'validateGnosisScore' },
  { file: 'dove-signal.json', constName: 'SCHEMA_DOVE_SIGNAL', exportName: 'validateDoveSignal' },
  { file: 'hepar-audit-result.json', constName: 'SCHEMA_HEPAR_AUDIT_RESULT', exportName: 'validateHeparAuditResult' },
];

// ── Targets ─────────────────────────────────────────────────────────────────
const TARGETS = [
  {
    relPath: 'monad-ecosystem/packages/sovereign-types/src/generated/ttcl-observation-event.json',
    docName: 'Sign-event payload schema (canonical JSON Schema, draft-07)',
    render: renderSchema,
  },
  {
    relPath: 'monad-ecosystem/packages/ttcl/src/generated/sign-factories.ts',
    docName: '@sovereign/ttcl runtime — Sign factory functions',
    render: renderFactories,
  },
  {
    relPath: 'monad-ecosystem/packages/sovereign-types/src/generated/sign-event-validators.ts',
    docName: '@sovereign/types — ajv validators (build/test-only)',
    render: renderValidators,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Load + parse the canonical spec. */
function loadSpec() {
  return JSON.parse(readFileSync(specPath, 'utf-8'));
}

/** Load + parse a hand-written schema from shared/schemas/. */
function readSchema(name) {
  return JSON.parse(readFileSync(resolve(SCHEMA_DIR, name), 'utf-8'));
}

/** The single event type this generator currently emits for. The drift guard's
 *  EXPECTED_EVENT_TYPES enforces that it exists in the spec. */
const TTCL_OBSERVATION_TYPE = 'ttcl.observation.emitted';

/** `@generated DO NOT EDIT` header for a TS target. */
function tsHeader(docName, source) {
  return [
    '/**',
    ` * @generated DO NOT EDIT — generated from ${source}`,
    ` * @source ${source}`,
    ' * by monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs.',
    ' *',
    ` * ${docName} (Layer 3 — codegen, Phase B).`,
    ' *',
    ' * This file is generated wholesale from the JSON source of truth on every',
    ' * gen-ttcl-artifacts.mjs run. Drift (a hand-edit, or the JSON changing without a',
    ' * re-run) is caught by `scripts/check-ttcl-artifacts-drift.mjs`, which regenerates',
    ' * this file into memory and diffs it against the committed copy.',
    ' *',
    ' * Edit shared/ttcl-specs/sign-events.json, then re-run:',
    ' *   node monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs',
    ' */',
  ].join('\n');
}

// ── Rendering ───────────────────────────────────────────────────────────────

/** Target 1: the Sign-event payload schema, verbatim from the spec. Pure JSON,
 *  no header (JSON has no comments); the `generated/` path + drift guard signal
 *  its provenance. Trailing newline for file hygiene. */
function renderSchema(spec) {
  const schema = spec.event_types[TTCL_OBSERVATION_TYPE].schema;
  return JSON.stringify(schema, null, 2) + '\n';
}

/** PascalCase return type for a factory's Sign, based on modality. A HYBRID
 *  spans all domains → `Sign<"HYBRID", Domain>`; any other modality is
 *  domain-specific → `Sign<"<MODALITY>", "<DOMAIN>">`. */
function factoryReturnType(entry) {
  if (entry.modality === 'HYBRID') return 'Sign<"HYBRID", Domain>';
  return `Sign<${JSON.stringify(entry.modality)}, ${JSON.stringify(entry.domain)}>`;
}

/** One factory function. A thin wrapper over makeSign(classId, mode, domain,
 *  modality, pps, trace, domains, noRlhf) — the manifold stays the sole source
 *  of truth for the peirce block (makeSign → getManifold().get(classId)). */
function renderFactory(key, entry) {
  const fnName = 'make' + key[0].toUpperCase() + key.slice(1);
  const retType = factoryReturnType(entry);
  const domainsArr = '[' + entry.domains.map((d) => JSON.stringify(d)).join(', ') + ']';
  return [
    '/**',
    ` * ${entry.description}`,
    ` * Source: ${entry.source_doc}`,
    ' */',
    `export function ${fnName}(trace?: EventTrace): ${retType} {`,
    '  return makeSign(',
    `    ${entry.sign_class_id}, // sign_class_id`,
    `    ${JSON.stringify(entry.mode)}, // mode`,
    `    ${JSON.stringify(entry.domain)}, // domain`,
    `    ${JSON.stringify(entry.modality)}, // modality`,
    `    ${JSON.stringify(entry.pps)}, // pps`,
    '    trace,',
    `    ${domainsArr}, // domains`,
    `    ${entry.noRlhf}, // noRlhf`,
    `  ) as ${retType};`,
    '}',
  ].join('\n');
}

/** Target 2: Sign factory functions, one per factory entry in the spec. */
function renderFactories(spec) {
  const fns = [];
  for (const [etName, et] of Object.entries(spec.event_types)) {
    if (!et.factories) continue;
    for (const [key, entry] of Object.entries(et.factories)) {
      fns.push(renderFactory(key, entry));
    }
  }
  return [
    tsHeader(
      '@sovereign/ttcl runtime — Sign factory functions',
      'shared/ttcl-specs/sign-events.json',
    ),
    '',
    '// Sign factories are thin wrappers over makeSign (../runtime/sign.js). The',
    '// Peirce manifold (now in @sovereign/types, relocated from @sovereign/logoc)',
    '// stays the sole source of truth for the peirce block — factories never',
    '// hand-assemble a PeirceSignature. Drift is caught by',
    '// scripts/check-ttcl-artifacts-drift.mjs.',
    '',
    'import { makeSign } from "../runtime/sign.js";',
    'import type { Sign, Domain } from "../types.js";',
    'import type { EventTrace } from "@sovereign/types";',
    '',
    fns.join('\n\n'),
    '',
  ].join('\n');
}

/** Target 3: ajv validators. Embeds the Sign-event schema (from the spec) + the
 *  4 hand-written payload schemas (read from shared/schemas/), compiles each at
 *  module load. Build/test-only. */
function renderValidators(spec) {
  const ttclSchema = spec.event_types[TTCL_OBSERVATION_TYPE].schema;
  const embedded = [
    { constName: 'SCHEMA_TTCL_OBSERVATION', exportName: 'validateTtclObservation', schema: ttclSchema },
    ...HAND_WRITTEN_SCHEMAS.map((s) => ({ constName: s.constName, exportName: s.exportName, schema: readSchema(s.file) })),
  ];
  const sourceLine =
    'shared/ttcl-specs/sign-events.json + shared/schemas/{signal-event,gnosis-score,dove-signal,hepar-audit-result}.json';
  const lines = [
    tsHeader('@sovereign/types — ajv validators (build/test-only)', sourceLine),
    '',
    '// ajv-compiled validators for the Sign-event payload + the 4 hand-written',
    '// payload schemas. Build/test-only — NOT imported by runtime code. The bus',
    '// keeps its hand-rolled validateIntentionTraceability (EventBus.ts:163) as the',
    '// only runtime check; the zero-external-runtime-deps invariant is preserved.',
    '// ajv + ajv-formats are devDependencies of @sovereign/types.',
    '',
    'import { Ajv, type AnySchemaObject, type ValidateFunction } from "ajv";',
    'import addFormats from "ajv-formats";',
    '',
    '// ajv v8 is CJS at runtime (module.exports = Ajv, with exports.Ajv + exports.default',
    '// both set). Under this package\'s strict NodeNext config a CJS *default* import is',
    '// typed as the module namespace — not constructable — so Ajv is taken as a NAMED',
    '// import (exports.Ajv, declared `export declare class Ajv`). ajv-formats exposes its',
    '// plugin only as `export default` (no named binding), so its default import is',
    '// likewise the non-callable namespace; cast at this single call site. At runtime',
    '// (vitest) the real callable plugin loads in both cases.',
    'const ajv = new Ajv({ allErrors: true });',
    '(addFormats as unknown as (a: Ajv) => void)(ajv);',
    '',
  ];
  for (const e of embedded) {
    lines.push(`const ${e.constName}: AnySchemaObject = ${JSON.stringify(e.schema, null, 2)};`);
    lines.push('');
  }
  for (const e of embedded) {
    lines.push(`export const ${e.exportName}: ValidateFunction = ajv.compile(${e.constName});`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderTarget(spec, target) {
  return target.render(spec);
}

// ── Exports (for scripts/check-ttcl-artifacts-drift.mjs) ────────────────────

export { repoRoot, specPath, TARGETS, renderTarget, loadSpec };

/**
 * Regenerate every target from the spec (+ shared/schemas/) and compare against
 * the committed files. Returns true if everything is in sync (no drift), false
 * otherwise. Logs each mismatch. No filesystem writes.
 */
export function check() {
  const spec = loadSpec();
  let clean = true;
  for (const target of TARGETS) {
    const absPath = resolve(repoRoot, target.relPath);
    const generated = renderTarget(spec, target);
    const committed = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : null;
    if (committed !== generated) {
      clean = false;
      console.error(`✗ DRIFT: ${target.relPath} does not match the spec + shared schemas.`);
      console.error('  Re-run: node monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs');
    } else {
      console.log(`✓ ${target.relPath} matches spec + shared schemas.`);
    }
  }
  return clean;
}

/** Regenerate + write every target. */
export function writeAll() {
  const spec = loadSpec();
  for (const target of TARGETS) {
    const absPath = resolve(repoRoot, target.relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, renderTarget(spec, target), 'utf-8');
    console.log(`✓ wrote ${target.relPath}`);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    if (!check()) process.exit(1);
  } else {
    writeAll();
  }
}