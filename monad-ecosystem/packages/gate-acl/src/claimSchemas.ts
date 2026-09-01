/**
 * Runtime schemas for the two HTTP claim bodies.
 *
 * Before this existed, `promotePlHttp` and `bindWalletHttp` cast an untrusted
 * JSON body straight to its TypeScript interface (`body as PlPromoteClaim`).
 * A cast is a compile-time assertion and does nothing at runtime, so every
 * field arrived unchecked. Confirmed consequences at 49fcd9f:
 *
 *   isStable: "false"      -> truthy string, claim AWARDED 10 PL
 *   totalEnergy: "70"      -> TypeError from .toFixed(), surfaced as a 500
 *   weights '0','0','1'    -> string concat '001', passed the `sum < 1` check
 *   weights -100, 0, 200   -> sum 100, passed; only the sum was ever checked
 *
 * These schemas are the single validating boundary. Parse once on entry, then
 * let the business logic assume its own types are true.
 *
 * Deliberately strict: no coercion, no stripping-and-continuing on unknown
 * keys for the discriminated payloads. If a caller sends the wrong shape we
 * want a 400 they can act on, not a silent reinterpretation.
 */
import { z } from 'zod';

/** Bounded so an oversized string cannot be used as a memory/log amplifier. */
const PRINCIPAL_ID_MAX = 256;
const DOMAIN_MAX = 128;

const principalIdSchema = z
  .string()
  .trim()
  .min(1, 'principalId must not be empty')
  .max(PRINCIPAL_ID_MAX, `principalId must be <= ${PRINCIPAL_ID_MAX} characters`);

/**
 * `.finite()` rejects NaN AND Infinity. Plain `z.number()` lets Infinity
 * through in zod 3, which would survive arithmetic and reach `.toFixed()`.
 */
const finite = () => z.number().finite();

/** Profile weights are non-negative magnitudes. Negative values previously
 *  passed because only their SUM was validated. */
const weight = () => finite().min(0, 'profile weights must be non-negative');

const brokenGenesisPayload = z.object({
  kind: z.literal('broken-genesis'),
  isStable: z.boolean(),
  totalEnergy: finite(),
  theoWeight: weight(),
  technoWeight: weight(),
  cosmoWeight: weight(),
  currentPl: finite().min(0).optional(),
});

const quarantinePayload = z.object({
  kind: z.literal('quarantine'),
  correctHalts: z.number().int().finite().min(0),
  hcd1Burden: finite().optional(),
  hcd2Fidelity: finite().optional(),
  currentPl: finite().min(0).optional(),
});

const archonPayload = z.object({
  kind: z.literal('archon'),
  gatesPassed: z.number().int().finite().min(0),
  currentPl: finite().min(0).optional(),
});

const taskPayloadSchema = z.discriminatedUnion('kind', [
  brokenGenesisPayload,
  quarantinePayload,
  archonPayload,
]);

const taskIdSchema = z.enum([
  'broken-genesis-repair',
  'quarantine-refusal-literacy',
  'archon-comprehension-gate',
]);

/** taskId and payload.kind must agree, or the verifier reads the wrong branch. */
const TASK_ID_TO_KIND = {
  'broken-genesis-repair': 'broken-genesis',
  'quarantine-refusal-literacy': 'quarantine',
  'archon-comprehension-gate': 'archon',
} as const;

export const plPromoteClaimSchema = z
  .object({
    principalId: principalIdSchema,
    domain: z.string().trim().min(1).max(DOMAIN_MAX).optional(),
    taskId: taskIdSchema,
    taskPayload: taskPayloadSchema,
  })
  .superRefine((claim, ctx) => {
    const expected = TASK_ID_TO_KIND[claim.taskId];
    if (claim.taskPayload.kind !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskPayload', 'kind'],
        message: `taskId "${claim.taskId}" requires taskPayload.kind "${expected}"`,
      });
    }
  });

/** 0x-prefixed 20-byte hex. Case-insensitive; checksum is not enforced here. */
const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'walletAddress must be a 0x-prefixed 20-byte hex address');

export const walletBindRequestSchema = z.object({
  localPrincipalId: principalIdSchema,
  walletAddress: walletAddressSchema,
  signature: z
    .string()
    .trim()
    .min(1, 'signature must not be empty')
    .max(2048, 'signature is implausibly long'),
  message: z.string().min(1, 'message must not be empty').max(4096),
});

/**
 * Flatten zod issues into a caller-safe list.
 *
 * Only the field path and our own authored message are exposed. Zod messages
 * describe the schema, never the received value, so this cannot echo hostile
 * input back or leak an internal stack/path.
 */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.join('.');
    return path ? `${path}: ${i.message}` : i.message;
  });
}

export type ValidatedPlPromoteClaim = z.infer<typeof plPromoteClaimSchema>;
export type ValidatedWalletBindRequest = z.infer<typeof walletBindRequestSchema>;
