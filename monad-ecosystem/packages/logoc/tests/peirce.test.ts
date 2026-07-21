import { describe, it, expect } from "vitest";
import { PeirceManifold, getManifold } from "@sovereign/types";
import { PeirceClassifier } from "../src/peirce/classifier";
import { LogocEvent, SemioticFlags } from "../src/peirce/models";
import { readFileSync } from "fs";
import { resolve, join } from "path";

describe("PeirceManifold (TS)", () => {
  const manifold = getManifold();

  it("loads all 66 classes", () => {
    const classes = manifold.allClasses();
    expect(classes.length).toBe(66);
  });

  it("has unique IDs 0..65", () => {
    const ids = new Set(manifold.allClasses().map((c) => c.id));
    expect(ids.size).toBe(66);
    for (let i = 0; i < 66; i++) {
      expect(ids.has(i)).toBe(true);
    }
  });

  it("has no duplicate labels", () => {
    const labels = manifold.allClasses().map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("class 42 is Legisign-Symbol-Argument", () => {
    const c = manifold.get(42);
    expect(c.path).toEqual(["Legisign", "Symbol", "Argument"]);
    expect(c.pragmatism_band).toBe("FORMAL_THOUGHT");
  });

  it("distance is symmetric", () => {
    const d1 = manifold.distance(0, 42);
    const d2 = manifold.distance(42, 0);
    expect(d1).toBe(d2);
  });

  it("self-distance is zero", () => {
    for (let i = 0; i < 66; i++) {
      expect(manifold.distance(i, i)).toBe(0);
    }
  });

  it("path resolves back to correct id", () => {
    for (const c of manifold.allClasses()) {
      const resolved = manifold.lookupByPath(c.path);
      expect(resolved.id).toBe(c.id);
    }
  });

  it("each band is non-empty", () => {
    for (const band of ["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"] as const) {
      expect(manifold.inBand(band).length).toBeGreaterThan(0);
    }
  });
});

describe("PeirceClassifier (TS)", () => {
  const classifier = new PeirceClassifier();

  it("classifies a golden event correctly", () => {
    const event: LogocEvent = {
      schema_version: "LOGOC-Event-v5.2",
      event_id: "golden_001",
      timestamp: "2026-06-19T00:00:00Z",
      narrative: "A pure quality of redness felt as immediate sensation.",
      semiotic_flags: { similarity: true, possibility: true },
    };
    const id = classifier.classify(event);
    expect(id).toBe(0); // Qualisign-Icon-Rheme
  });

  it("classifies a FORMAL_THOUGHT event", () => {
    const event: LogocEvent = {
      schema_version: "LOGOC-Event-v5.2",
      event_id: "formal_001",
      timestamp: "2026-06-19T00:00:00Z",
      narrative: "The activation rule concludes therefore a valid argument holds.",
      semiotic_flags: { rule_based: true, convention: true, reason: true },
    };
    const annotated = classifier.annotate(event);
    expect(annotated.peirce).toBeDefined();
    expect(annotated.peirce!.pragmatism_band).toBe("FORMAL_THOUGHT");
    expect(annotated.peirce!.sign_class_id).toBe(42);
    expect(annotated.peirce_migration_pending).toBe(false);
    expect(annotated.peirce_migration_source).toBeUndefined();
  });

  it("marks ambiguous events as migration_pending", () => {
    const event: LogocEvent = {
      schema_version: "LOGOC-Event-v5.2",
      event_id: "ambig_001",
      timestamp: "2026-06-19T00:00:00Z",
      narrative: "abstract unclassifiable content",
      semiotic_flags: {},
    };
    const annotated = classifier.annotate(event);
    expect(annotated.peirce_migration_pending).toBe(true);
    expect(annotated.peirce).toBeUndefined();
    expect(annotated.peirce_migration_source).toBe("heuristic_v1_pending");
  });

  it("classifyPath returns a triadic array", () => {
    const event: LogocEvent = {
      schema_version: "LOGOC-Event-v5.2",
      event_id: "triad_001",
      timestamp: "2026-06-19T00:00:00Z",
      narrative: "this single event is a causal fact",
      semiotic_flags: { single_occurrence: true, causality: true, fact: true },
    };
    const path = classifier.classifyPath(event);
    expect(path).toEqual(["Sinsign", "Index", "Dicent"]);
  });
});

describe("Golden file (TS)", () => {
  const goldenPath = join(__dirname, "golden", "peirce_events_v1.jsonl");
  const lines = readFileSync(goldenPath, "utf-8")
    .trim()
    .split("\n")
    .filter((l) => l.length > 0);

  it("has the expected number of golden entries", () => {
    expect(lines.length).toBe(5);
  });

  const classifier = new PeirceClassifier();

  for (const line of lines) {
    const entry = JSON.parse(line);
    it(`matches golden entry ${entry.event.event_id}`, () => {
      const event = entry.event as LogocEvent;
      const result = classifier.classify(event);
      expect(result).toBe(entry.expected_sign_class_id);
      const annotated = classifier.annotate(event);
      expect(annotated.peirce).toBeDefined();
      expect(annotated.peirce!.path).toEqual(entry.expected_path);
      expect(annotated.peirce!.pragmatism_band).toBe(entry.expected_band);
    });
  }
});
