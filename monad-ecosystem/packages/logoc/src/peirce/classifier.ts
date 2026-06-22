import { readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import { PeirceManifold, getManifold } from "./manifold.js";
import { LogocEvent, PeirceSignature, SemioticFlags, CoarseMode } from "./models.js";

export class AmbiguousClassificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousClassificationError";
  }
}

export class PeirceClassifier {
  private manifold: PeirceManifold;
  private rules: any;

  constructor(manifold?: PeirceManifold, rulesPath?: string) {
    this.manifold = manifold || getManifold();
    const p = rulesPath || join(__dirname, "../../spec/peirce_rules.yml");
    this.rules = yaml.parse(readFileSync(p, "utf-8"));
  }

  classify(event: LogocEvent): number {
    const path = this.classifyPath(event);
    const cls = this.manifold.lookupByPath(path);
    return cls.id;
  }

  classifyPath(event: LogocEvent): string[] {
    const vehicle = this.decideVehicle(event);
    const objectRel = this.decideObjectRelation(event);
    const interpretant = this.decideInterpretant(event);
    return [vehicle, objectRel, interpretant];
  }

  annotate(event: LogocEvent): LogocEvent {
    try {
      const path = this.classifyPath(event);
      const cls = this.manifold.lookupByPath(path);
      event.peirce = {
        mode: this.inferCoarseMode(path),
        sign_class_id: cls.id,
        sign_class_label: cls.label,
        path: cls.path,
        firstness_weight: cls.firstness_weight,
        secondness_weight: cls.secondness_weight,
        thirdness_weight: cls.thirdness_weight,
        pragmatism_band: cls.pragmatism_band,
      };
      event.peirce_migration_pending = false;
      event.peirce_migration_source = undefined;
    } catch (err) {
      if (err instanceof AmbiguousClassificationError || err instanceof Error) {
        event.peirce = undefined;
        event.peirce_migration_pending = true;
        event.peirce_migration_source = "heuristic_v1_pending";
      } else {
        throw err;
      }
    }
    return event;
  }

  private decideVehicle(event: LogocEvent): string {
    const flags = event.semiotic_flags || {};
    if (flags.rule_based) return "Legisign";
    if (flags.single_occurrence) return "Sinsign";
    
    const nar = (event.narrative || "").toLowerCase();
    if (["rule", "law", "convention", "type"].some(kw => nar.includes(kw))) return "Legisign";
    if (["single", "token", "this", "event"].some(kw => nar.includes(kw))) return "Sinsign";
    if (["quality", "pure", "feel", "sensation", "description"].some(kw => nar.includes(kw))) return "Qualisign";
    
    throw new AmbiguousClassificationError("Cannot determine sign vehicle from event.");
  }

  private decideObjectRelation(event: LogocEvent): string {
    const flags = event.semiotic_flags || {};
    if (flags.convention) return "Symbol";
    if (flags.causality) return "Index";
    if (flags.similarity) return "Icon";
    
    const nar = (event.narrative || "").toLowerCase();
    if (["symbol", "word", "language", "arbitrary"].some(kw => nar.includes(kw))) return "Symbol";
    if (["index", "causal", "pointer", "symptom", "trace"].some(kw => nar.includes(kw))) return "Index";
    if (["icon", "image", "resemble", "diagram", "likeness"].some(kw => nar.includes(kw))) return "Icon";
    
    throw new AmbiguousClassificationError("Cannot determine object relation from event.");
  }

  private decideInterpretant(event: LogocEvent): string {
    const flags = event.semiotic_flags || {};
    if (flags.reason) return "Argument";
    if (flags.fact) return "Dicent";
    if (flags.possibility) return "Rheme";
    
    const nar = (event.narrative || "").toLowerCase();
    if (["argument", "proof", "conclude", "therefore", "theorem"].some(kw => nar.includes(kw))) return "Argument";
    if (["fact", "assertion", "true", "false", "state"].some(kw => nar.includes(kw))) return "Dicent";
    if (["possibility", "may", "might", "could", "potential"].some(kw => nar.includes(kw))) return "Rheme";
    
    throw new AmbiguousClassificationError("Cannot determine interpretant from event.");
  }

  private inferCoarseMode(path: string[]): CoarseMode {
    for (const node of path) {
      if (node === "Symbol") return "SYMBOL";
      if (node === "Index") return "INDEX";
      if (node === "Icon") return "ICON";
    }
    return "ICON";
  }
}
