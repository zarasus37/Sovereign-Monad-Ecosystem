import { readFileSync } from "fs";
import { join } from "path";
import { PragmatismBand } from "./models.js";
// Manifold geometry weights + neighbor radius come from the canonical numerics
// (Layer 4a) — single source of truth shared with the Python mirror.
import {
  MANIFOLD_WEIGHT_RING,
  MANIFOLD_WEIGHT_ANGLE,
  MANIFOLD_WEIGHT_HAMMING,
  MANIFOLD_MAX_DISTANCE,
} from "@sovereign/types";

export interface PeirceSignClass {
  id: number;
  label: string;
  path: string[];
  firstness_weight: number;
  secondness_weight: number;
  thirdness_weight: number;
  pragmatism_band: PragmatismBand;
  ring_radius: number;
  ring_angle_deg: number;
}

export class PeirceManifold {
  // Distance-metric weights + neighbor radius are imported from the canonical
  // numerics module (@sovereign/types) — see shared/schemas/ttcl-numerics.json.

  private byId = new Map<number, PeirceSignClass>();
  private byLabel = new Map<string, number>();
  private byPath = new Map<string, number>();

  constructor(specPath?: string) {
    const p = specPath || join(__dirname, "../../spec/peirce_sign_classes.json");
    const raw = readFileSync(p, "utf-8");
    const classes = JSON.parse(raw) as PeirceSignClass[];

    for (const c of classes) {
      this.byId.set(c.id, c);
      this.byLabel.set(c.label, c.id);
      this.byPath.set(c.path.join("|"), c.id);
    }
  }

  get(classId: number): PeirceSignClass {
    const c = this.byId.get(classId);
    if (!c) throw new Error(`Unknown Peirce class ID: ${classId}`);
    return c;
  }

  lookupByPath(path: string[]): PeirceSignClass {
    const key = path.join("|");
    if (this.byPath.has(key)) {
      return this.get(this.byPath.get(key)!);
    }
    // Prefix match
    for (const [fullKey, cid] of this.byPath.entries()) {
      if (fullKey.startsWith(key)) {
        return this.get(cid);
      }
    }
    throw new Error(`No sign class found for path: ${path}`);
  }

  inBand(band: PragmatismBand): PeirceSignClass[] {
    return Array.from(this.byId.values()).filter(c => c.pragmatism_band === band);
  }

  distance(aId: number, bId: number): number {
    const a = this.get(aId);
    const b = this.get(bId);

    const ringDelta = Math.abs(a.ring_radius - b.ring_radius);

    const angleDiff = Math.abs(a.ring_angle_deg - b.ring_angle_deg);
    const angularDelta = Math.min(angleDiff, 360.0 - angleDiff) / 180.0;

    let hamming = 0;
    for (let i = 0; i < Math.max(a.path.length, b.path.length); i++) {
      if (a.path[i] !== b.path[i]) hamming++;
    }

    return (
      MANIFOLD_WEIGHT_RING * ringDelta +
      MANIFOLD_WEIGHT_ANGLE * angularDelta +
      MANIFOLD_WEIGHT_HAMMING * hamming
    );
  }

  neighbors(classId: number, maxDistance = MANIFOLD_MAX_DISTANCE): PeirceSignClass[] {
    return Array.from(this.byId.values()).filter(c => {
      return c.id !== classId && this.distance(classId, c.id) <= maxDistance;
    });
  }

  allClasses(): PeirceSignClass[] {
    return Array.from(this.byId.values());
  }
}

let _manifold: PeirceManifold | null = null;
export function getManifold(): PeirceManifold {
  if (!_manifold) {
    _manifold = new PeirceManifold();
  }
  return _manifold;
}
