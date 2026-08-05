/**
 * Browser-side Financial Graduation session + MeshaleachPoC mint.
 * Mirrors @sovereign/shaliah-onboarding gate batteries and EIP-191 mint
 * without node:crypto (Web Crypto + ethers Signer from useFgMintOpts).
 */

import type { Signer } from "ethers";
import type { MeshaleachPoC, PoCMerkleDisclosure, PoCProof } from "@sovereign/types";
import type { FgMintOptsBrowser } from "@/lib/fgMintBridge";

// ─── constants (keep in sync with shaliah-onboarding / sovereign-types) ───

export type FgGateId = "fg1" | "fg2" | "fg3";
export type FgProgressState =
  | "fg_locked"
  | "fg1_in_progress"
  | "fg1_passed"
  | "fg2_in_progress"
  | "fg2_passed"
  | "fg3_in_progress"
  | "fg3_passed";

export const FG_DOMAIN_TAGS: Record<FgGateId, string> = {
  fg1: "fg1.literacy",
  fg2: "fg2.stewardship",
  fg3: "fg3.rate_sovereignty",
};

export const FG1_LESSON_IDS = ["L1.1", "L1.2", "L1.3", "L1.4", "L1.5"] as const;
export const FG2_LESSON_IDS = ["L2.1", "L2.2", "L2.3", "L2.4", "L2.5"] as const;
export const FG3_LESSON_IDS = ["L3.1", "L3.2", "L3.3", "L3.4"] as const;

export const FG_LESSON_META: Record<
  string,
  { title: string; gate: FgGateId }
> = {
  "L1.1": { title: "What is yield (and what it isn’t)", gate: "fg1" },
  "L1.2": { title: "Time preference & compounding", gate: "fg1" },
  "L1.3": { title: "Units, claim, NAV (bank model)", gate: "fg1" },
  "L1.4": { title: "DeFi surface: pool risk in-sim", gate: "fg1" },
  "L1.5": { title: "Real-economy transfer", gate: "fg1" },
  "L2.1": { title: "Channel allocation of G", gate: "fg2" },
  "L2.2": { title: "Drawdown without freeze", gate: "fg2" },
  "L2.3": { title: "High-risk: confirm or refuse", gate: "fg2" },
  "L2.4": { title: "Liquidity soft vs hard", gate: "fg2" },
  "L2.5": { title: "Stewardship of claim in pool", gate: "fg2" },
  "L3.1": { title: "G = r × eligible C", gate: "fg3" },
  "L3.2": { title: "Floor 5% / ceiling 30%", gate: "fg3" },
  "L3.3": { title: "Only the human sets r", gate: "fg3" },
  "L3.4": { title: "Seasonal escalate is opt-in", gate: "fg3" },
};

export const FG_R_DEFAULT = 0.2;
export const FG_R_MIN = 0.05;
export const FG_R_MAX = 0.3;

const MESHALEACH_POC_MESSAGE_PREFIX = "Sovereign Monad Meshaleach PoC";
const MESHALEACH_POC_SCHEMA_VERSION = "poc.v1" as const;
const MESHALEACH_POC_ISSUER_DEFAULT = "meshaleach-v1";

// ─── pure scoring (mirrors lessonEngine) ───

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function keyCoverage(response: string, keys: readonly string[]): number {
  if (keys.length === 0) return response.trim().length >= 12 ? 1 : 0;
  const n = normalize(response);
  let hit = 0;
  for (const k of keys) {
    if (n.includes(normalize(k))) hit += 1;
  }
  return hit / keys.length;
}

export function explanationQuality(
  response: string,
  keys: readonly string[],
): number {
  const coverage = keyCoverage(response, keys);
  const lenBonus = Math.min(1, response.trim().length / 80);
  return Math.min(1, coverage * 0.7 + lenBonus * 0.3);
}

// ─── crypto helpers (Web Crypto) ───

async function sha256Hex(data: string): Promise<string> {
  const buf = new TextEncoder().encode(data);
  const dig = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(dig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newId(): string {
  return crypto.randomUUID();
}

// ─── gate types ───

export interface GateItemResult {
  readonly itemId: string;
  readonly passed: boolean;
  readonly feedback: string;
  readonly score: number;
}

export interface GateBatteryResult {
  readonly gate: FgGateId;
  readonly passed: boolean;
  readonly items: GateItemResult[];
  readonly integritySignature: string;
  readonly domainTag: string;
  readonly failures: string[];
}

export interface Fg1Answers {
  readonly defiRisk: string;
  readonly timePreference: string;
  readonly realEconomy: string;
  readonly claimExplain: string;
}

export interface Fg2Answers {
  readonly channelAlloc: string;
  readonly drawdown: string;
  readonly highRiskAction: "confirm" | "refuse" | "autopilot";
  readonly highRiskReason: string;
  readonly liquidityChoice: string;
  readonly stewardshipExplain: string;
}

export interface Fg3Answers {
  readonly ratePredictions: string;
  readonly boundsDefense: string;
  readonly chosenR: number;
  readonly chosenRReason: string;
  readonly escalate: "accept" | "refuse";
  readonly escalateReason: string;
  readonly covenantStatement: string;
}

export interface FgUnlocks {
  claimStatement: boolean;
  safeDeployMenu: boolean;
  highRiskConfirm: boolean;
  rateSovereignty: boolean;
  domainTags: string[];
}

export interface FgBrowserSession {
  sessionId: string;
  principalId: string;
  state: FgProgressState;
  completedLessons: string[];
  gateResults: GateBatteryResult[];
  meshaleachSeals: MeshaleachPoC[];
  r: number;
  rLocked: boolean;
  unlocked: FgUnlocks;
  events: Array<{
    id: string;
    kind: string;
    at: number;
    payload?: Record<string, unknown>;
  }>;
  lastError?: string;
}

function emptyUnlocks(): FgUnlocks {
  return {
    claimStatement: false,
    safeDeployMenu: false,
    highRiskConfirm: false,
    rateSovereignty: false,
    domainTags: [],
  };
}

export function startFgBrowserSession(
  principalId: string,
  now = Date.now(),
): FgBrowserSession {
  return {
    sessionId: newId(),
    principalId,
    state: "fg1_in_progress",
    completedLessons: [],
    gateResults: [],
    meshaleachSeals: [],
    r: FG_R_DEFAULT,
    rLocked: true,
    unlocked: emptyUnlocks(),
    events: [
      {
        id: newId(),
        kind: "fg.session_start",
        at: now,
        payload: { r: FG_R_DEFAULT, rLocked: true },
      },
    ],
  };
}

export function markLessonsComplete(
  session: FgBrowserSession,
  gate: FgGateId,
  now = Date.now(),
): FgBrowserSession {
  const ids =
    gate === "fg1"
      ? FG1_LESSON_IDS
      : gate === "fg2"
        ? FG2_LESSON_IDS
        : FG3_LESSON_IDS;
  const completed = new Set(session.completedLessons);
  for (const id of ids) completed.add(id);
  let state = session.state;
  if (gate === "fg1" && (state === "fg_locked" || state === "fg1_in_progress")) {
    state = "fg1_in_progress";
  }
  if (gate === "fg2" && state === "fg1_passed") state = "fg2_in_progress";
  if (gate === "fg3" && state === "fg2_passed") state = "fg3_in_progress";
  return {
    ...session,
    state,
    completedLessons: [...completed],
    events: [
      ...session.events,
      {
        id: newId(),
        kind: "fg.lessons_complete",
        at: now,
        payload: { gate, ids: [...ids] },
      },
    ],
  };
}

function lessonsDone(session: FgBrowserSession, gate: FgGateId): boolean {
  const ids =
    gate === "fg1"
      ? FG1_LESSON_IDS
      : gate === "fg2"
        ? FG2_LESSON_IDS
        : FG3_LESSON_IDS;
  return ids.every((id) => session.completedLessons.includes(id));
}

function item(
  itemId: string,
  passed: boolean,
  response: string,
  feedback: string,
): GateItemResult {
  return {
    itemId,
    passed,
    feedback: passed ? "ok" : feedback,
    score: passed ? Math.min(1, response.trim().length / 40) : 0,
  };
}

async function finalize(
  principalId: string,
  gate: FgGateId,
  domainTag: string,
  items: GateItemResult[],
  now: number,
): Promise<GateBatteryResult> {
  const failures = items.filter((i) => !i.passed).map((i) => `${i.itemId}: ${i.feedback}`);
  const passed = failures.length === 0;
  const score = items.reduce((a, i) => a + i.score, 0) / Math.max(1, items.length);
  const integritySignature = (
    await sha256Hex(`${principalId}|${gate}|${score}|${now}`)
  ).slice(0, 32);
  return {
    gate,
    passed,
    items,
    integritySignature,
    domainTag,
    failures,
  };
}

export async function evaluateFg1Gate(
  principalId: string,
  answers: Fg1Answers,
  now = Date.now(),
): Promise<GateBatteryResult> {
  const items: GateItemResult[] = [
    item(
      "T1",
      keyCoverage(answers.defiRisk, [
        "risk",
        "liquidity",
        "pool",
        "drawdown",
        "contract",
      ]) >= 0.25 && answers.defiRisk.trim().length >= 20,
      answers.defiRisk,
      "Name safer structure and at least two risks.",
    ),
    item(
      "T2",
      keyCoverage(answers.timePreference, [
        "time",
        "compound",
        "wait",
        "future",
        "patience",
      ]) >= 0.25,
      answers.timePreference,
      "Explain time preference / compounding tradeoff.",
    ),
    item(
      "T3",
      keyCoverage(answers.realEconomy, [
        "cost",
        "time",
        "storage",
        "demand",
        "production",
        "commodity",
      ]) >= 0.2,
      answers.realEconomy,
      "Transfer deep rule to real-economy surface.",
    ),
    item(
      "E1",
      explanationQuality(answers.claimExplain, [
        "claim",
        "units",
        "nav",
        "pool",
        "collective",
      ]) >= 0.4,
      answers.claimExplain,
      "Explain claim vs pool in plain language.",
    ),
  ];
  return finalize(principalId, "fg1", FG_DOMAIN_TAGS.fg1, items, now);
}

export async function evaluateFg2Gate(
  principalId: string,
  answers: Fg2Answers,
  now = Date.now(),
): Promise<GateBatteryResult> {
  const autopilotFail = answers.highRiskAction === "autopilot";
  const highRiskOk =
    !autopilotFail &&
    (answers.highRiskAction === "confirm" ||
      answers.highRiskAction === "refuse") &&
    answers.highRiskReason.trim().length >= 12;

  const items: GateItemResult[] = [
    item(
      "T1",
      keyCoverage(answers.channelAlloc, [
        "claim",
        "community",
        "job",
        "escrow",
        "commons",
      ]) >= 0.3,
      answers.channelAlloc,
      "Allocate mock G across channels with justification.",
    ),
    item(
      "T2",
      keyCoverage(answers.drawdown, [
        "panic",
        "risk",
        "action",
        "assess",
        "not freeze",
        "loss",
      ]) >= 0.2 && answers.drawdown.trim().length >= 24,
      answers.drawdown,
      "Drawdown: coherent action + self-explanation.",
    ),
    item(
      "T3",
      highRiskOk,
      answers.highRiskReason,
      autopilotFail
        ? "FAIL: autopilot high-risk is forbidden."
        : "High-risk confirm or refuse with reason.",
    ),
    item(
      "T4",
      keyCoverage(answers.liquidityChoice, [
        "soft",
        "hard",
        "window",
        "emergency",
        "vault",
        "commit",
      ]) >= 0.25,
      answers.liquidityChoice,
      "Choose liquidity mode and explain.",
    ),
    item(
      "E1",
      explanationQuality(answers.stewardshipExplain, [
        "steward",
        "claim",
        "pool",
        "shared",
        "human",
      ]) >= 0.35,
      answers.stewardshipExplain,
      "What stewardship means for personal claim in shared pool.",
    ),
  ];
  return finalize(principalId, "fg2", FG_DOMAIN_TAGS.fg2, items, now);
}

export async function evaluateFg3Gate(
  principalId: string,
  answers: Fg3Answers,
  now = Date.now(),
): Promise<GateBatteryResult> {
  const rOk = answers.chosenR >= FG_R_MIN && answers.chosenR <= FG_R_MAX;
  const items: GateItemResult[] = [
    item(
      "T1",
      keyCoverage(answers.ratePredictions, [
        "5",
        "20",
        "30",
        "claim",
        "commons",
        "0.05",
        "0.20",
        "0.30",
      ]) >= 0.3,
      answers.ratePredictions,
      "Predict outcomes for 5% / 20% / 30%.",
    ),
    item(
      "T2",
      keyCoverage(answers.boundsDefense, [
        "floor",
        "ceiling",
        "pool",
        "commons",
        "zero",
        "liquidity",
      ]) >= 0.25,
      answers.boundsDefense,
      "Defend floor/ceiling with mechanism language.",
    ),
    item(
      "T3",
      rOk && answers.chosenRReason.trim().length >= 16,
      answers.chosenRReason,
      rOk ? "Personal rate choice with reason." : "chosenR must be in [0.05, 0.30].",
    ),
    item(
      "T4",
      (answers.escalate === "accept" || answers.escalate === "refuse") &&
        answers.escalateReason.trim().length >= 8,
      answers.escalateReason,
      "Accept or refuse seasonal escalate with reason.",
    ),
    item(
      "E1",
      keyCoverage(answers.covenantStatement, [
        "i set",
        "shaliah",
        "not",
        "r",
        "claim",
        "mine",
        "human",
      ]) >= 0.25 ||
        /i set.*r|shaliah does not|my claim/i.test(answers.covenantStatement),
      answers.covenantStatement,
      "Covenant: I set r; Shaliah does not; claim stays mine.",
    ),
  ];
  return finalize(principalId, "fg3", FG_DOMAIN_TAGS.fg3, items, now);
}

// ─── Merkle (browser, same scheme as @sovereign/types) ───

async function hashLeaf(
  payload: string | Record<string, unknown>,
): Promise<string> {
  const s =
    typeof payload === "string"
      ? payload
      : JSON.stringify(payload, Object.keys(payload).sort());
  return sha256Hex(`leaf:${s}`);
}

async function parentHash(left: string, right: string): Promise<string> {
  return sha256Hex(`node:${left}${right}`);
}

async function buildMerkleFromRecords(
  records: Record<string, string>[],
): Promise<{ leaves: string[]; layers: string[][]; root: string }> {
  const leaves = await Promise.all(records.map((r) => hashLeaf(r)));
  if (leaves.length === 0) {
    const z = await sha256Hex("empty");
    return { leaves: [], layers: [[z]], root: z };
  }
  let layer = [...leaves];
  const layers: string[][] = [layer];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(await parentHash(left, right));
    }
    layer = next;
    layers.push(layer);
  }
  return { leaves, layers, root: layer[0]! };
}

async function getMerkleProof(
  tree: { leaves: string[]; layers: string[][]; root: string },
  leafIndex: number,
  revealed?: Record<string, string>,
): Promise<PoCMerkleDisclosure> {
  const path: string[] = [];
  let idx = leafIndex;
  for (let d = 0; d < tree.layers.length - 1; d++) {
    const layer = tree.layers[d]!;
    const sibling =
      idx % 2 === 0 ? (layer[idx + 1] ?? layer[idx]!) : layer[idx - 1]!;
    path.push(sibling);
    idx = Math.floor(idx / 2);
  }
  return {
    root: tree.root,
    leaf: tree.leaves[leafIndex]!,
    leafIndex,
    path,
    revealed,
  };
}

// ─── mint ───

function canonicalPoCPayload(unsigned: Omit<MeshaleachPoC, "signature">): string {
  return JSON.stringify(unsigned, Object.keys(unsigned).sort());
}

async function hashPoCPayload(
  unsigned: Omit<MeshaleachPoC, "signature">,
): Promise<string> {
  return sha256Hex(canonicalPoCPayload(unsigned));
}

export async function buildPoCSignMessage(
  unsigned: Omit<MeshaleachPoC, "signature">,
): Promise<string> {
  const payloadHash = await hashPoCPayload(unsigned);
  return [
    MESHALEACH_POC_MESSAGE_PREFIX,
    `Gate: ${unsigned.gate}`,
    `Domain: ${unsigned.domain_tag}`,
    `Principal: ${unsigned.principal_commitment ?? unsigned.principal_id ?? ""}`,
    `Issued: ${unsigned.issued_at}`,
    `Payload: ${payloadHash}`,
  ].join("\n");
}

async function principalCommitmentFromId(principalId: string): Promise<string> {
  return `0x${await sha256Hex(`principal:${principalId}`)}`;
}

async function integrityHashFromGate(
  principalId: string,
  result: GateBatteryResult,
): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      principalId,
      gate: result.gate,
      domainTag: result.domainTag,
      integritySignature: result.integritySignature,
      items: result.items.map((i) => ({ id: i.itemId, p: i.passed, s: i.score })),
    }),
  );
}

export async function buildAndMintPoC(opts: {
  principalId: string;
  gateResult: GateBatteryResult;
  mint: FgMintOptsBrowser;
  allDomainTags: readonly string[];
  now?: number;
}): Promise<{ poc: MeshaleachPoC; signerAddress: string; message: string }> {
  const { gateResult, mint } = opts;
  if (!gateResult.passed) throw new Error("Cannot mint for failed gate");

  const domain_tag = gateResult.domainTag || FG_DOMAIN_TAGS[gateResult.gate];
  const issued_at = new Date(opts.now ?? Date.now()).toISOString();
  const principal_commitment = await principalCommitmentFromId(opts.principalId);
  const lesson_ids = gateResult.items.map((i) => `${gateResult.gate}-${i.itemId}`);

  let proof: PoCProof = { system: "none", bytes: null, public_inputs: [] };

  if (mint.withMerkleDisclosure) {
    const tags = [
      ...new Set([...opts.allDomainTags, domain_tag]),
    ];
    const records = tags.map((tag) => ({ kind: "domain_tag", tag }));
    const tree = await buildMerkleFromRecords(records);
    const leafIndex = tags.indexOf(domain_tag);
    const merkle = await getMerkleProof(tree, leafIndex, {
      kind: "domain_tag",
      tag: domain_tag,
    });
    proof = {
      system: "merkle-sd",
      bytes: null,
      public_inputs: [merkle.root],
      merkle,
    };
  }

  const unsigned: Omit<MeshaleachPoC, "signature"> = {
    schema_version: MESHALEACH_POC_SCHEMA_VERSION,
    principal_id: mint.walletAddress ?? opts.principalId,
    principal_commitment,
    gate: gateResult.gate,
    domain_tag,
    lesson_ids,
    integrity: {
      hash: await integrityHashFromGate(opts.principalId, gateResult),
      components: {
        N_i: gateResult.items.every((i) => i.passed) ? 1 : 0.5,
        C_i: 1,
        P_i:
          gateResult.items.filter((i) => i.passed).length /
          Math.max(1, gateResult.items.length),
      },
    },
    issued_at,
    issuer: MESHALEACH_POC_ISSUER_DEFAULT,
    public_claims: {
      gate_passed: true,
      human_bound: true,
    },
    proof,
    population: "shaliah",
  };

  // Browser SNARK is off by default (heavy wasm); server path uses withSnark
  if (mint.withSnark) {
    console.warn(
      "[FG] withSnark requested in browser — SNARK prove stays server-side; minting merkle-sd/none only",
    );
  }

  const message = await buildPoCSignMessage(unsigned);
  const signature = await mint.signer.signMessage(message);
  const signerAddress = await mint.signer.getAddress();
  const poc = { ...unsigned, signature } as MeshaleachPoC;
  return { poc, signerAddress, message };
}

// ─── attempt gates with mint opts ───

export type GateAttemptResult = {
  session: FgBrowserSession;
  result: GateBatteryResult;
  seal?: MeshaleachPoC;
  mintError?: string;
};

async function applyPassUnlocks(
  session: FgBrowserSession,
  result: GateBatteryResult,
  answers?: Fg3Answers,
): Promise<FgBrowserSession> {
  const domainTags = session.unlocked.domainTags.includes(result.domainTag)
    ? session.unlocked.domainTags
    : [...session.unlocked.domainTags, result.domainTag];

  if (result.gate === "fg1") {
    return {
      ...session,
      state: "fg1_passed",
      unlocked: {
        ...session.unlocked,
        claimStatement: true,
        safeDeployMenu: true,
        domainTags,
      },
    };
  }
  if (result.gate === "fg2") {
    return {
      ...session,
      state: "fg2_passed",
      unlocked: {
        ...session.unlocked,
        highRiskConfirm: true,
        domainTags,
      },
    };
  }
  // fg3
  const r =
    answers && answers.chosenR >= FG_R_MIN && answers.chosenR <= FG_R_MAX
      ? answers.chosenR
      : session.r;
  return {
    ...session,
    state: "fg3_passed",
    r,
    rLocked: false,
    unlocked: {
      ...session.unlocked,
      rateSovereignty: true,
      domainTags,
    },
  };
}

/**
 * Attempt FG-1/2/3 gate battery. Always call getFgMintOpts() first and pass
 * the handle so a passed gate can mint EIP-191 MeshaleachPoC.
 */
export async function attemptGateWithMint(
  session: FgBrowserSession,
  gate: FgGateId,
  answers: Fg1Answers | Fg2Answers | Fg3Answers,
  mint: FgMintOptsBrowser | null,
  now = Date.now(),
): Promise<GateAttemptResult> {
  if (!lessonsDone(session, gate)) {
    throw new Error(`Complete ${gate.toUpperCase()} lessons before gate battery`);
  }

  if (gate === "fg1") {
    if (
      !(
        session.state === "fg1_in_progress" ||
        session.state === "fg_locked" ||
        session.state === "fg1_passed"
      )
    ) {
      // allow re-attempt when still in fg1
    }
  } else if (gate === "fg2") {
    if (!(session.state === "fg1_passed" || session.state === "fg2_in_progress")) {
      throw new Error("FG-2 requires fg1_passed or fg2_in_progress");
    }
  } else if (gate === "fg3") {
    if (!(session.state === "fg2_passed" || session.state === "fg3_in_progress")) {
      throw new Error("FG-3 requires fg2_passed or fg3_in_progress");
    }
  }

  let result: GateBatteryResult;
  if (gate === "fg1") {
    result = await evaluateFg1Gate(session.principalId, answers as Fg1Answers, now);
  } else if (gate === "fg2") {
    result = await evaluateFg2Gate(session.principalId, answers as Fg2Answers, now);
  } else {
    result = await evaluateFg3Gate(session.principalId, answers as Fg3Answers, now);
  }

  let next: FgBrowserSession = {
    ...session,
    gateResults: [...session.gateResults, result],
    events: [
      ...session.events,
      {
        id: newId(),
        kind: result.passed ? "fg.gate_pass" : "fg.gate_fail",
        at: now,
        payload: {
          gate,
          failures: result.failures,
          sig: result.integritySignature,
        },
      },
    ],
  };

  if (gate === "fg2" && !result.passed) {
    next = { ...next, state: "fg2_in_progress" };
  }
  if (gate === "fg3" && !result.passed) {
    next = { ...next, state: "fg3_in_progress" };
  }

  if (!result.passed) {
    return { session: next, result };
  }

  next = await applyPassUnlocks(
    next,
    result,
    gate === "fg3" ? (answers as Fg3Answers) : undefined,
  );

  if (!mint) {
    return {
      session: next,
      result,
      mintError: "No FgMintOpts — bind wallet and call getFgMintOpts()",
    };
  }

  try {
    const { poc, signerAddress } = await buildAndMintPoC({
      principalId: session.principalId,
      gateResult: result,
      mint,
      allDomainTags: next.unlocked.domainTags,
      now,
    });
    next = {
      ...next,
      meshaleachSeals: [...next.meshaleachSeals, poc],
      events: [
        ...next.events,
        {
          id: newId(),
          kind: "fg.meshaleach_poc_minted",
          at: now,
          payload: {
            gate: result.gate,
            domain_tag: poc.domain_tag,
            proof_system: poc.proof.system,
            signer: signerAddress,
            principal_commitment: poc.principal_commitment,
          },
        },
      ],
    };
    return { session: next, result, seal: poc };
  } catch (e: unknown) {
    return {
      session: next,
      result,
      mintError: e instanceof Error ? e.message : "Mint failed",
    };
  }
}

/** Demo fill answers that pass keyword batteries (for UI testing). */
export const DEMO_FG1: Fg1Answers = {
  defiRisk:
    "Safer audited pool; risks include liquidity and smart contract drawdown.",
  timePreference:
    "I trade time for compound future growth with patience.",
  realEconomy:
    "Storage and time cost of waiting on commodity demand.",
  claimExplain:
    "My claim is units; NAV is the collective pool value of funds.",
};

export const DEMO_FG2: Fg2Answers = {
  channelAlloc:
    "I fund claim community and job escrow without pure private hoarding of commons.",
  drawdown:
    "Loss is information; I assess risk and act without panic or freeze.",
  highRiskAction: "refuse",
  highRiskReason: "Risk tier too high for my current envelope.",
  liquidityChoice: "soft commitment windows with emergency hardship path.",
  stewardshipExplain:
    "Stewardship: human claim in a shared pool I do not exploit.",
};

export const DEMO_FG3: Fg3Answers = {
  ratePredictions:
    "At 5% less claim growth; at 20% default; at 30% more claim and commons from eligible C.",
  boundsDefense:
    "Floor protects pool and commons; ceiling limits liquidity stress; zero starves pool.",
  chosenR: 0.15,
  chosenRReason: "Balanced claim growth with room for near-term goals.",
  escalate: "refuse",
  escalateReason: "Prefer stable r this season.",
  covenantStatement: "I set r; Shaliah does not; my claim stays mine.",
};

// silence unused Signer import if tree-shaken oddly
export type { Signer };
