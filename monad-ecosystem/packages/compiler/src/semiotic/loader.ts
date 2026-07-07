/**
 * L3 SemioticDialect — the loader.
 *
 * `loadProgram` takes raw JSON, validates it against the canonical program
 * schema (`shared/ttcl-specs/semiotic-program-schema.json`) with ajv at
 * runtime, and builds an in-memory SSA `SignGraph`. The wheel-binding pass
 * (`binding.ts`) then resolves every op reference + checks acyclicity. This is
 * the prose's "loads wheels, signs, constitutions — resolves all asset
 * references" L3 responsibility.
 *
 * Schema resolution: the schema is the single source of truth in
 * `shared/ttcl-specs/`. It is read at module load via `fs` from a path resolved
 * relative to `import.meta.url` — the same `Path(__file__).parents[N]` pattern
 * the Python readers use for `shared/peirce-spec/` (only on the TS side). This
 * avoids importing a JSON file that lives outside the package's `rootDir`
 * (which would break `tsc` declaration emit) and keeps one canonical copy.
 *
 * ajv is a *runtime* dependency of @sovereign/compiler (the package is not a
 * zero-dep leaf like @sovereign/types — it depends on types + ttcl — so a
 * runtime ajv dep does not violate the types-only `ajv-as-devDep` rule). The
 * named-import `{ Ajv }` is required under NodeNext (default import of the CJS
 * build is a non-constructable namespace — see the ajv-nodenext memory).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type AnySchema, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { CoarseMode, EventTrace } from "@sovereign/types";
import type { Domain, Modality } from "@sovereign/ttcl";

import type { NodeId, SignGraph, SsaNode, WheelDecl, SignDecl, OpDecl, CombinatorOp } from "./graph.js";
import { ProgramSchemaError } from "../errors.js";
import { bindGraph } from "./binding.js";

// Resolve the canonical schema from the repo root. From this file (src or
// dist, both at monad-ecosystem/packages/compiler/{src,dist}/semiotic/), five
// `..` reach the repo root; `shared/ttcl-specs/semiotic-program-schema.json` is
// the single source of truth.
const SCHEMA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "shared",
  "ttcl-specs",
  "semiotic-program-schema.json",
);
const schemaJson: unknown = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

// One ajv instance; the program schema is compiled once at module load.
// `ajv-formats` supplies the `date-time` format used by the optional
// `trace.createdAt` field.
const ajv = new Ajv({ allErrors: true, strict: true });
// ajv-formats exposes its plugin only as a default export; under NodeNext the
// default import is the non-callable namespace, so cast at this single call
// site (matches sovereign-types/src/generated/sign-event-validators.ts:34).
(addFormats as unknown as (a: Ajv) => void)(ajv);
const validate: ValidateFunction = ajv.compile(schemaJson as AnySchema);

/** Shape of a validated program (post-ajv). `unknown` until validated. */
interface ProgramJson {
  program: string;
  wheels: { id: NodeId; size: number; initial?: number }[];
  signs: {
    id: NodeId;
    class_id: number;
    mode: CoarseMode;
    domain: Domain;
    modality: Modality;
    pps: number;
    domains?: Domain[];
    noRlhf?: boolean;
    trace?: EventTrace;
  }[];
  ops: { id: NodeId; op: CombinatorOp; inputs: NodeId[] }[];
  constitution?: { threshold?: number };
  budget: number;
  output: NodeId;
}

/**
 * Load + validate a semiotic program and build the SSA `SignGraph`.
 *
 * Throws `ProgramSchemaError` on schema mismatch, `UnresolvedReferenceError`
 * on a dangling op reference, `CyclicSsaError` on a cyclic graph, and
 * `InvalidOutputError` if the declared `output` is missing or a wheel.
 */
export function loadProgram(json: unknown): SignGraph {
  if (!validate(json)) {
    throw new ProgramSchemaError(
      (validate.errors ?? []).map((e) => ({
        instancePath: e.instancePath,
        schemaPath: e.schemaPath,
        message: e.message,
      })),
    );
  }
  const program = json as ProgramJson;

  const nodes = new Map<NodeId, SsaNode>();
  const order: NodeId[] = [];

  for (const w of program.wheels) {
    const decl: WheelDecl = {
      kind: "wheel",
      id: w.id,
      size: w.size,
      initial: w.initial ?? 0,
    };
    assertUniqueId(nodes, w.id);
    nodes.set(w.id, decl);
    order.push(w.id);
  }

  for (const s of program.signs) {
    const decl: SignDecl = {
      kind: "sign",
      id: s.id,
      classId: s.class_id,
      mode: s.mode,
      domain: s.domain,
      modality: s.modality,
      pps: s.pps,
      trace: s.trace,
      domains: s.domains,
      noRlhf: s.noRlhf,
    };
    assertUniqueId(nodes, s.id);
    nodes.set(s.id, decl);
    order.push(s.id);
  }

  for (const o of program.ops) {
    const decl: OpDecl = {
      kind: "op",
      id: o.id,
      op: o.op,
      inputs: o.inputs,
    };
    assertUniqueId(nodes, o.id);
    nodes.set(o.id, decl);
    order.push(o.id);
  }

  const graph: SignGraph = {
    nodes,
    order,
    outputId: program.output,
    budget: program.budget,
    constitutionThreshold: program.constitution?.threshold,
    program: program.program,
  };

  // L3 wheel-binding pass: resolve references + enforce acyclicity + validate
  // the output node. Throws CompilerError subtypes on failure.
  bindGraph(graph);

  return graph;
}

function assertUniqueId(nodes: ReadonlyMap<NodeId, SsaNode>, id: NodeId): void {
  if (nodes.has(id)) {
    throw new ProgramSchemaError([
      { instancePath: "", schemaPath: "#", message: `duplicate node id '${id}'` },
    ]);
  }
}