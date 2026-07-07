/**
 * @generated DO NOT EDIT — generated from shared/ttcl-specs/sign-events.json + shared/schemas/{signal-event,gnosis-score,dove-signal,hepar-audit-result}.json
 * @source shared/ttcl-specs/sign-events.json + shared/schemas/{signal-event,gnosis-score,dove-signal,hepar-audit-result}.json
 * by monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs.
 *
 * @sovereign/types — ajv validators (build/test-only) (Layer 3 — codegen, Phase B).
 *
 * This file is generated wholesale from the JSON source of truth on every
 * gen-ttcl-artifacts.mjs run. Drift (a hand-edit, or the JSON changing without a
 * re-run) is caught by `scripts/check-ttcl-artifacts-drift.mjs`, which regenerates
 * this file into memory and diffs it against the committed copy.
 *
 * Edit shared/ttcl-specs/sign-events.json, then re-run:
 *   node monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs
 */

// ajv-compiled validators for the Sign-event payload + the 4 hand-written
// payload schemas. Build/test-only — NOT imported by runtime code. The bus
// keeps its hand-rolled validateIntentionTraceability (EventBus.ts:163) as the
// only runtime check; the zero-external-runtime-deps invariant is preserved.
// ajv + ajv-formats are devDependencies of @sovereign/types.

import { Ajv, type AnySchemaObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

// ajv v8 is CJS at runtime (module.exports = Ajv, with exports.Ajv + exports.default
// both set). Under this package's strict NodeNext config a CJS *default* import is
// typed as the module namespace — not constructable — so Ajv is taken as a NAMED
// import (exports.Ajv, declared `export declare class Ajv`). ajv-formats exposes its
// plugin only as `export default` (no named binding), so its default import is
// likewise the non-callable namespace; cast at this single call site. At runtime
// (vitest) the real callable plugin loads in both cases.
const ajv = new Ajv({ allErrors: true });
(addFormats as unknown as (a: Ajv) => void)(ajv);

const SCHEMA_TTCL_OBSERVATION: AnySchemaObject = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://the-sovereign/schemas/ttcl-observation-event.json",
  "title": "TTCLObservationEvent payload",
  "description": "Payload of a ttcl.observation.emitted SignalEvent — a TTCL Sign observation. Matches Sign<M,T> at monad-ecosystem/packages/ttcl/src/types.ts:48 and PeirceSignature at monad-ecosystem/packages/logoc/src/peirce/models.ts:15.",
  "type": "object",
  "properties": {
    "modality": {
      "type": "string",
      "enum": [
        "PURE",
        "ICON",
        "INDEX",
        "SYMBOL",
        "HYBRID"
      ],
      "description": "Position on the modal lattice: HYBRID ⊤ → ICON / INDEX / SYMBOL → PURE ⊥."
    },
    "domain": {
      "type": "string",
      "enum": [
        "THEOLOGY",
        "TECHNOLOGY",
        "COSMOLOGY"
      ],
      "description": "The TTCL domain this sign carries."
    },
    "pps": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Primary Parameter Schema sync score — a per-emission runtime position on the manifold ring."
    },
    "peirce": {
      "type": "object",
      "description": "LOGOC PeirceSignature — the 66-class manifold classification. The manifold (monad-ecosystem/packages/logoc/spec/peirce_sign_classes.json) is the sole source of truth for label/path/weights; sign_class_id must be a valid manifold id in [0, 65].",
      "additionalProperties": false,
      "required": [
        "mode",
        "sign_class_id",
        "sign_class_label",
        "path",
        "firstness_weight",
        "secondness_weight",
        "thirdness_weight",
        "pragmatism_band"
      ],
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "ICON",
            "INDEX",
            "SYMBOL"
          ],
          "description": "Coarse mode derived from the sign class path."
        },
        "sign_class_id": {
          "type": "integer",
          "minimum": 0,
          "maximum": 65,
          "description": "Manifold class id. Unknown ids throw UnknownSignClassError at runtime."
        },
        "sign_class_label": {
          "type": "string",
          "minLength": 1,
          "description": "Human-readable class label from the manifold."
        },
        "path": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1,
          "description": "Peirce semiotic path [vehicle, object, interpretant]."
        },
        "firstness_weight": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "secondness_weight": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "thirdness_weight": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "pragmatism_band": {
          "type": "string",
          "enum": [
            "INSTINCT",
            "EXPERIENCE",
            "FORMAL_THOUGHT"
          ]
        }
      }
    },
    "trace": {
      "type": "object",
      "description": "Intention traceability metadata. Required by the bus for governance-relevant, action-bearing, or economically meaningful event types. See docs/CHARTER.md §4.",
      "required": [
        "intentionId",
        "source"
      ],
      "properties": {
        "intentionId": {
          "type": "string",
          "minLength": 1,
          "description": "Unique identifier for the intention chain that produced this event."
        },
        "source": {
          "type": "string",
          "minLength": 1,
          "description": "Agent, service, or contributor that originated the intention."
        },
        "parentEventId": {
          "type": "string",
          "minLength": 1,
          "description": "Parent event in the intention chain, if any."
        },
        "constraintEnvelopeId": {
          "type": "string",
          "minLength": 1,
          "description": "Constraint envelope governing the action that produced this event."
        },
        "narrativePurposeId": {
          "type": "string",
          "minLength": 1,
          "description": "Narrative purpose tag linking the event to a declared objective."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 timestamp when the trace record was created."
        }
      },
      "additionalProperties": false
    },
    "domains": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "THEOLOGY",
          "TECHNOLOGY",
          "COSMOLOGY"
        ]
      },
      "minItems": 1,
      "description": "Triadic ancestry — domains this sign represents. A raw single-domain sign carries [domain]; a HYBRID from compose(theo, tech, cosmo) carries all three. Consumed by the constitution scorer C1."
    },
    "noRlhf": {
      "type": "boolean",
      "description": "Caller-set flag (default true) that no RLHF signal is present. Consumed by the constitution scorer C5."
    }
  },
  "required": [
    "modality",
    "domain",
    "pps",
    "peirce"
  ]
};

const SCHEMA_SIGNAL_EVENT: AnySchemaObject = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SignalEvent",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "correlationId": {
      "type": "string"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "layer": {
      "type": "string",
      "enum": [
        "funnel",
        "engine",
        "treasury",
        "dao",
        "intelligence",
        "oracle",
        "signal-layer",
        "platform",
        "keys",
        "narrative",
        "dove",
        "gnosis",
        "revenue-router",
        "data-rail",
        "emergence",
        "system",
        "ttcl"
      ]
    },
    "source": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "price.updated",
        "spread.detected",
        "opportunity.constructed",
        "trade.approved",
        "trade.executed",
        "trade.rejected",
        "revenue.routed",
        "revenue.sink.received",
        "hepar.audit.started",
        "hepar.audit.completed",
        "hepar.audit.finding",
        "gnosis.score.computed",
        "gnosis.blink.triggered",
        "gnosis.quarantine.triggered",
        "dove.signal.tier1",
        "dove.signal.tier2",
        "dove.signal.tier3",
        "oracle.regime.classified",
        "oracle.posture.updated",
        "data-rail.event.captured",
        "data-rail.activated",
        "data-rail.bundle.ready",
        "emergence.window.opened",
        "emergence.pattern.candidate",
        "emergence.claim.submitted",
        "agent.action.taken",
        "agent.profile.registered",
        "agent.claim.mined",
        "system.health",
        "system.error",
        "system.startup",
        "system.shutdown",
        "ttcl.observation.emitted"
      ]
    },
    "payload": {
      "type": "object"
    },
    "hash": {
      "type": "string"
    },
    "severity": {
      "type": "string",
      "enum": [
        "info",
        "warning",
        "critical",
        "fatal"
      ]
    },
    "trace": {
      "type": "object",
      "description": "Intention traceability metadata. Required by the bus for governance-relevant, action-bearing, or economically meaningful event types. See docs/CHARTER.md §4.",
      "required": [
        "intentionId",
        "source"
      ],
      "properties": {
        "intentionId": {
          "type": "string",
          "minLength": 1,
          "description": "Unique identifier for the intention chain that produced this event."
        },
        "source": {
          "type": "string",
          "minLength": 1,
          "description": "Agent, service, or contributor that originated the intention."
        },
        "parentEventId": {
          "type": "string",
          "minLength": 1,
          "description": "Parent event in the intention chain, if any."
        },
        "constraintEnvelopeId": {
          "type": "string",
          "minLength": 1,
          "description": "Constraint envelope governing the action that produced this event."
        },
        "narrativePurposeId": {
          "type": "string",
          "minLength": 1,
          "description": "Narrative purpose tag linking the event to a declared objective."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 timestamp when the trace record was created."
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "id",
    "correlationId",
    "timestamp",
    "layer",
    "source",
    "type",
    "payload"
  ]
};

const SCHEMA_GNOSIS_SCORE: AnySchemaObject = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GnosisScore",
  "type": "object",
  "properties": {
    "agentId": {
      "type": "string"
    },
    "windowStart": {
      "type": "string",
      "format": "date-time"
    },
    "windowEnd": {
      "type": "string",
      "format": "date-time"
    },
    "coherence": {
      "type": "object",
      "properties": {
        "depth": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "truth": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "width": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "required": [
        "depth",
        "truth",
        "width"
      ]
    },
    "overallScore": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "parallax": {
      "type": "object",
      "properties": {
        "tiltMagnitude": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "tiltThreshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "blinkTriggered": {
          "type": "boolean"
        }
      },
      "required": [
        "tiltMagnitude",
        "tiltThreshold",
        "blinkTriggered"
      ]
    },
    "doctrineState": {
      "type": "string",
      "enum": [
        "SELF_NAVIGATING",
        "ADJACENT_CONVERGENT",
        "PATTERN_FOLLOWING"
      ]
    },
    "lane": {
      "type": "string",
      "enum": [
        "LANE_A",
        "LANE_B",
        "LANE_C",
        "UNCLASSIFIED"
      ]
    },
    "quarantineTriggered": {
      "type": "boolean"
    },
    "observationCount": {
      "type": "integer",
      "minimum": 0
    },
    "sequenceNumber": {
      "type": "integer",
      "minimum": 0
    },
    "trace": {
      "type": "object",
      "description": "Intention traceability metadata. Required by the bus for governance-relevant, action-bearing, or economically meaningful event types (e.g. gnosis.quarantine.triggered, gnosis.blink.triggered). See docs/CHARTER.md §4.",
      "required": [
        "intentionId",
        "source"
      ],
      "properties": {
        "intentionId": {
          "type": "string",
          "minLength": 1,
          "description": "Unique identifier for the intention chain that produced this event."
        },
        "source": {
          "type": "string",
          "minLength": 1,
          "description": "Agent, service, or contributor that originated the intention."
        },
        "parentEventId": {
          "type": "string",
          "minLength": 1,
          "description": "Parent event in the intention chain, if any."
        },
        "constraintEnvelopeId": {
          "type": "string",
          "minLength": 1,
          "description": "Constraint envelope governing the action that produced this event."
        },
        "narrativePurposeId": {
          "type": "string",
          "minLength": 1,
          "description": "Narrative purpose tag linking the event to a declared objective."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 timestamp when the trace record was created."
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "agentId",
    "windowStart",
    "windowEnd",
    "coherence",
    "overallScore",
    "parallax",
    "doctrineState",
    "lane",
    "quarantineTriggered",
    "observationCount",
    "sequenceNumber"
  ]
};

const SCHEMA_DOVE_SIGNAL: AnySchemaObject = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DoveSignal",
  "type": "object",
  "properties": {
    "signalId": {
      "type": "string"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "tier": {
      "type": "integer",
      "enum": [
        1,
        2,
        3
      ]
    },
    "layer": {
      "type": "string",
      "enum": [
        "funnel",
        "engine",
        "treasury",
        "dao",
        "intelligence",
        "oracle",
        "signal-layer",
        "platform",
        "keys",
        "narrative",
        "dove",
        "gnosis",
        "revenue-router",
        "data-rail",
        "emergence",
        "system"
      ]
    },
    "driftCategory": {
      "type": "string",
      "enum": [
        "experiential.drift",
        "founder.centering",
        "ego.capture",
        "layer.self.optimization",
        "capital.concentration",
        "extraction.pattern",
        "monoculture.formation",
        "dogma.detection",
        "participation.diversity.low",
        "macro.micro.divergence",
        "agent.hollow.convergence",
        "knowledge.weaponized",
        "licensing.misalignment",
        "data.revenue.misrouted",
        "key.consolidation",
        "archonic.construct",
        "access.exclusion",
        "founder.draw.excessive",
        "axiom.contradiction",
        "boundary.stress.detected"
      ]
    },
    "observedValue": {
      "type": "string"
    },
    "threshold": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "governanceProposalGenerated": {
      "type": "boolean"
    },
    "governanceProposalId": {
      "type": "string"
    },
    "resolved": {
      "type": "boolean"
    },
    "resolvedAt": {
      "type": "string",
      "format": "date-time"
    },
    "trace": {
      "type": "object",
      "description": "Intention traceability metadata. Required by the bus for all Dove signals (dove.signal.tier1..3 are trace-required). See docs/CHARTER.md §4.",
      "required": [
        "intentionId",
        "source"
      ],
      "properties": {
        "intentionId": {
          "type": "string",
          "minLength": 1,
          "description": "Unique identifier for the intention chain that produced this event."
        },
        "source": {
          "type": "string",
          "minLength": 1,
          "description": "Agent, service, or contributor that originated the intention."
        },
        "parentEventId": {
          "type": "string",
          "minLength": 1,
          "description": "Parent event in the intention chain, if any."
        },
        "constraintEnvelopeId": {
          "type": "string",
          "minLength": 1,
          "description": "Constraint envelope governing the action that produced this event."
        },
        "narrativePurposeId": {
          "type": "string",
          "minLength": 1,
          "description": "Narrative purpose tag linking the event to a declared objective."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 timestamp when the trace record was created."
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "signalId",
    "timestamp",
    "tier",
    "layer",
    "driftCategory",
    "observedValue",
    "threshold",
    "description",
    "governanceProposalGenerated",
    "resolved"
  ]
};

const SCHEMA_HEPAR_AUDIT_RESULT: AnySchemaObject = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HeparAuditResult",
  "type": "object",
  "properties": {
    "auditId": {
      "type": "string"
    },
    "startedAt": {
      "type": "string",
      "format": "date-time"
    },
    "completedAt": {
      "type": "string",
      "format": "date-time"
    },
    "target": {
      "type": "string"
    },
    "protocolName": {
      "type": "string"
    },
    "chain": {
      "type": "string"
    },
    "stages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "stage": {
            "type": "string",
            "enum": [
              "A",
              "B",
              "C",
              "D"
            ]
          },
          "completed": {
            "type": "boolean"
          },
          "elapsedMs": {
            "type": "integer"
          },
          "findingCounts": {
            "type": "object",
            "properties": {
              "info": {
                "type": "integer"
              },
              "low": {
                "type": "integer"
              },
              "medium": {
                "type": "integer"
              },
              "high": {
                "type": "integer"
              },
              "critical": {
                "type": "integer"
              }
            },
            "required": [
              "info",
              "low",
              "medium",
              "high",
              "critical"
            ]
          },
          "findings": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "findingId": {
                  "type": "string"
                },
                "stage": {
                  "type": "string",
                  "enum": [
                    "A",
                    "B",
                    "C",
                    "D"
                  ]
                },
                "severity": {
                  "type": "string",
                  "enum": [
                    "info",
                    "low",
                    "medium",
                    "high",
                    "critical"
                  ]
                },
                "category": {
                  "type": "string",
                  "enum": [
                    "privilege",
                    "access-control",
                    "arithmetic",
                    "overflow",
                    "reentrancy",
                    "call-chain",
                    "economic",
                    "incentive",
                    "governance",
                    "state-consistency",
                    "oracle-dependency",
                    "liquidity-risk",
                    "informational"
                  ]
                },
                "title": {
                  "type": "string"
                },
                "description": {
                  "type": "string"
                },
                "contractAddress": {
                  "type": "string"
                },
                "functionName": {
                  "type": "string"
                },
                "recommendation": {
                  "type": "string"
                },
                "evidence": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "findingId",
                "stage",
                "severity",
                "category",
                "title",
                "description",
                "recommendation",
                "evidence"
              ]
            }
          }
        },
        "required": [
          "stage",
          "completed",
          "elapsedMs",
          "findingCounts",
          "findings"
        ]
      }
    },
    "allFindings": {
      "type": "array",
      "items": {
        "$ref": "#/properties/stages/items/properties/findings/items"
      }
    },
    "score": {
      "type": "object",
      "properties": {
        "overall": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        },
        "stageScores": {
          "type": "object",
          "properties": {
            "A": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100
            },
            "B": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100
            },
            "C": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100
            },
            "D": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100
            }
          },
          "required": [
            "A",
            "B",
            "C",
            "D"
          ]
        },
        "tvlTier": {
          "type": "string",
          "enum": [
            "micro",
            "small",
            "mid",
            "large",
            "institutional"
          ]
        },
        "governanceScore": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        },
        "heuristicConfidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "required": [
        "overall",
        "stageScores",
        "tvlTier",
        "governanceScore",
        "heuristicConfidence"
      ]
    },
    "allocationRecommendation": {
      "type": "string",
      "enum": [
        "advisable",
        "caution",
        "do-not-allocate"
      ]
    },
    "suggestedAllocationCapUsd": {
      "type": [
        "number",
        "null"
      ]
    },
    "lightVerifyCertification": {
      "type": "string",
      "enum": [
        "pending",
        "certified",
        "failed"
      ]
    },
    "forensicReportGenerated": {
      "type": "boolean"
    },
    "forensicReportUri": {
      "type": "string"
    },
    "trace": {
      "type": "object",
      "description": "Intention traceability metadata. Required by the bus for hepar.audit.completed / hepar.audit.finding events. See docs/CHARTER.md §4.",
      "required": [
        "intentionId",
        "source"
      ],
      "properties": {
        "intentionId": {
          "type": "string",
          "minLength": 1,
          "description": "Unique identifier for the intention chain that produced this event."
        },
        "source": {
          "type": "string",
          "minLength": 1,
          "description": "Agent, service, or contributor that originated the intention."
        },
        "parentEventId": {
          "type": "string",
          "minLength": 1,
          "description": "Parent event in the intention chain, if any."
        },
        "constraintEnvelopeId": {
          "type": "string",
          "minLength": 1,
          "description": "Constraint envelope governing the action that produced this event."
        },
        "narrativePurposeId": {
          "type": "string",
          "minLength": 1,
          "description": "Narrative purpose tag linking the event to a declared objective."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 timestamp when the trace record was created."
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "auditId",
    "startedAt",
    "completedAt",
    "target",
    "chain",
    "stages",
    "allFindings",
    "score",
    "allocationRecommendation",
    "suggestedAllocationCapUsd",
    "lightVerifyCertification",
    "forensicReportGenerated"
  ]
};

export const validateTtclObservation: ValidateFunction = ajv.compile(SCHEMA_TTCL_OBSERVATION);
export const validateSignalEvent: ValidateFunction = ajv.compile(SCHEMA_SIGNAL_EVENT);
export const validateGnosisScore: ValidateFunction = ajv.compile(SCHEMA_GNOSIS_SCORE);
export const validateDoveSignal: ValidateFunction = ajv.compile(SCHEMA_DOVE_SIGNAL);
export const validateHeparAuditResult: ValidateFunction = ajv.compile(SCHEMA_HEPAR_AUDIT_RESULT);
