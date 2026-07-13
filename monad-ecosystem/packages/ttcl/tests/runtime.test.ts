/**
 * @sovereign/ttcl runtime tests.
 *
 * These tests exercise the executable combinator surface: linear tokens,
 * the Triadic Minimal Gate on `compose`, auditable Free-Will `choose`, the
 * runtime `prove` gates, encode/decode round-trips, and the Llull/Trithemius
 * wheel + cipher primitives. They reuse LOGOC's real 66-class manifold rather
 * than stubbing the Peirce classes.
 */

import { describe, expect, it } from "vitest";
import {
  Token,
  TokenAlreadyConsumedError,
  Wheel,
  WheelBudgetExceededError,
  combineWheels,
  combineWheelsBudgeted,
  KeyCap,
  KeyCapAlreadyConsumedError,
  keyRotate,
  makeSign,
  compose,
  TriadicGateError,
  UnknownSignClassError,
  choose,
  fold,
  rotateWheel,
  serializeSign,
  deserializeSign,
  encodeSign,
  decodeSign,
  EncSignModalityError,
  prove,
  emitObservation,
  distill,
  getManifold,
} from "../src/runtime/index.js";
import type { CoarseMode, Domain, Sign, Modality, EncToken } from "../src/runtime/index.js";

const manifold = getManifold();

/** A FORMAL_THOUGHT class whose interpretant is an Argument. */
function formalArgumentClassId(): number {
  const cls = manifold
    .allClasses()
    .find(
      (c) =>
        c.pragmatism_band === "FORMAL_THOUGHT" && c.path[2] === "Argument",
    );
  if (!cls) throw new Error("spec missing a FORMAL_THOUGHT/Argument class");
  return cls.id;
}

/** An INSTINCT-band class (for gate-failure tests). */
function instinctClassId(): number {
  const cls = manifold
    .allClasses()
    .find((c) => c.pragmatism_band === "INSTINCT");
  if (!cls) throw new Error("spec missing an INSTINCT class");
  return cls.id;
}

/** Derive the coarse mode from a class's object-relation path element. */
function modeOf(classId: number): CoarseMode {
  const cls = manifold.get(classId);
  const mode = cls.path[1]?.toUpperCase();
  if (mode !== "ICON" && mode !== "INDEX" && mode !== "SYMBOL") {
    throw new Error(`unexpected path[1] for class ${classId}: ${cls.path[1]}`);
  }
  return mode;
}

/** Build a Sign in a given domain using a formal-thought/argument class. */
function formalSign(
  domain: Domain,
  modality: Modality,
  pps: number,
): Sign<Modality, Domain> {
  const id = formalArgumentClassId();
  return makeSign(id, modeOf(id), domain, modality, pps);
}

describe("Token (linear-use)", () => {
  it("consumes exactly once and throws on double-use", () => {
    const t = new Token(42);
    expect(t.consumed).toBe(false);
    expect(t.consume()).toBe(42);
    expect(t.consumed).toBe(true);
    expect(() => t.consume()).toThrow(TokenAlreadyConsumedError);
  });

  it("exposes the index without consuming", () => {
    const t = new Token("prov-1");
    expect(t.index).toBe("prov-1");
    expect(t.consumed).toBe(false);
  });
});

describe("compose (Triadic Minimal Gate)", () => {
  it("joins three domains into a HYBRID sign with min pps", () => {
    const theo = formalSign("THEOLOGY", "SYMBOL", 0.9);
    const tech = formalSign("TECHNOLOGY", "INDEX", 0.8);
    const cosmo = formalSign("COSMOLOGY", "ICON", 0.7);
    const joined = compose(theo, tech, cosmo);
    expect(joined.modality).toBe("HYBRID");
    expect(joined.pps).toBeCloseTo(0.7, 6);
    // Dominant peirce: FORMAL_THOUGHT (all three are formal here) → highest thirdness.
    expect(joined.peirce.pragmatism_band).toBe("FORMAL_THOUGHT");
    expect(joined.peirce.path[2]).toBe("Argument");
  });

  it("aborts with TriadicGateError when only two domains are present", () => {
    const a = formalSign("THEOLOGY", "SYMBOL", 0.9);
    const b = formalSign("TECHNOLOGY", "INDEX", 0.8);
    expect(() => compose(a, b)).toThrow(TriadicGateError);
    try {
      compose(a, b);
    } catch (e) {
      expect((e as TriadicGateError).present).toHaveLength(2);
    }
  });

  it("aborts with TriadicGateError on a single sign", () => {
    expect(() => compose(formalSign("THEOLOGY", "SYMBOL", 0.9))).toThrow(
      TriadicGateError,
    );
  });

  it("aborts on an empty compose", () => {
    expect(() => compose()).toThrow(TriadicGateError);
  });

  it("merges traces from the composed signs", () => {
    const t = (id: string, src: string) => ({ intentionId: id, source: src });
    const a = { ...formalSign("THEOLOGY", "SYMBOL", 0.9), trace: t("i-1", "srcA") };
    const b = { ...formalSign("TECHNOLOGY", "INDEX", 0.8), trace: t("i-2", "srcB") };
    const c = formalSign("COSMOLOGY", "ICON", 0.7);
    const joined = compose(a, b, c);
    expect(joined.trace).toBeDefined();
    // Lexicographically smallest intentionId becomes the root.
    expect(joined.trace!.intentionId).toBe("i-1");
    expect(joined.trace!.source).toBe("srcA+srcB");
  });
});

describe("choose (auditable Free Will)", () => {
  it("materializes both branches, selects per predicate, records the branch", () => {
    const sign = formalSign("THEOLOGY", "SYMBOL", 0.9);
    let aCalls = 0;
    let bCalls = 0;
    const { result, audit } = choose(
      sign,
      (s) => {
        aCalls++;
        return `A:${s.domain}`;
      },
      (s) => {
        bCalls++;
        return `B:${s.domain}`;
      },
      () => "A",
    );
    // Both branches MUST materialize (genuine choice, not lazy evaluation).
    expect(aCalls).toBe(1);
    expect(bCalls).toBe(1);
    expect(result).toBe("A:THEOLOGY");
    expect(audit.branchTaken).toBe("A");
    expect(audit.sign).toBe(sign);
    expect(typeof audit.at).toBe("string");
    expect(() => new Date(audit.at).getTime()).not.toThrow();
  });

  it("selects branch B when the predicate returns B", () => {
    const sign = formalSign("TECHNOLOGY", "INDEX", 0.8);
    const { result, audit } = choose(
      sign,
      () => "A",
      () => "B",
      () => "B",
    );
    expect(result).toBe("B");
    expect(audit.branchTaken).toBe("B");
  });
});

describe("prove / emitObservation / distill (runtime gates)", () => {
  it("prove passes for a FORMAL_THOUGHT / Argument sign", () => {
    const sign = formalSign("THEOLOGY", "SYMBOL", 0.9);
    const result = prove(sign);
    expect(result.pass).toBe(true);
    expect(result.gates.formalThought.held).toBe(true);
    expect(result.gates.argument.held).toBe(true);
    expect(result.reasoning).toHaveLength(0);
  });

  it("prove fails when the band is INSTINCT", () => {
    const id = instinctClassId();
    const sign = makeSign(id, modeOf(id), "THEOLOGY", "ICON", 0.9);
    const result = prove(sign);
    expect(result.pass).toBe(false);
    expect(result.gates.formalThought.held).toBe(false);
    expect(result.gates.argument.required).toBe(true);
    expect(result.reasoning.join(";")).toMatch(/formal-thought/);
  });

  it("prove fails when the interpretant is not an Argument", () => {
    // Find a FORMAL_THOUGHT class whose interpretant is NOT Argument.
    const cls = manifold
      .allClasses()
      .find(
        (c) =>
          c.pragmatism_band === "FORMAL_THOUGHT" && c.path[2] !== "Argument",
      );
    if (!cls) return; // spec has no such class; skip gracefully
    const sign = makeSign(
      cls.id,
      modeOf(cls.id),
      "THEOLOGY",
      "SYMBOL",
      0.9,
    );
    const result = prove(sign);
    expect(result.pass).toBe(false);
    expect(result.gates.argument.held).toBe(false);
  });

  it("emitObservation requires strong secondness", () => {
    // A class whose path[1] === "Index" satisfies strong secondness.
    const cls = manifold.allClasses().find((c) => c.path[1] === "Index");
    if (!cls) return;
    const sign = makeSign(cls.id, modeOf(cls.id), "TECHNOLOGY", "INDEX", 0.8);
    const result = emitObservation(sign);
    expect(result.gates.strongSecondness.required).toBe(true);
    expect(result.gates.strongSecondness.held).toBe(true);
    expect(result.pass).toBe(true);
  });

  it("prove throws UnknownSignClassError on an unknown class id", () => {
    const sign = makeSign(formalArgumentClassId(), "SYMBOL", "THEOLOGY", "SYMBOL", 0.9) as Sign<any, any>;
    // Tamper with the class id to simulate corruption.
    (sign.peirce as any).sign_class_id = 999_999;
    expect(() => prove(sign)).toThrow(UnknownSignClassError);
  });

  it("distill flags non-formal signs without rejecting them", () => {
    const id = instinctClassId();
    const sign = makeSign(id, modeOf(id), "COSMOLOGY", "ICON", 0.7);
    const result = distill(sign);
    expect(result.pass).toBe(false);
    expect(result.reasoning.join(";")).toMatch(/non-formal/);
  });
});

describe("serializeSign / deserializeSign (numeric round-trip)", () => {
  const cases: Array<{ modality: Modality; domain: Domain; pps: number }> = [
    { modality: "ICON", domain: "THEOLOGY", pps: 0.3 },
    { modality: "INDEX", domain: "TECHNOLOGY", pps: 0.65 },
    { modality: "SYMBOL", domain: "COSMOLOGY", pps: 1.0 },
    { modality: "HYBRID", domain: "COSMOLOGY", pps: 0.72 },
  ];

  for (const c of cases) {
    it(`round-trips a ${c.modality}/${c.domain} sign (modulo trace)`, () => {
      const id = formalArgumentClassId();
      const original = makeSign(
        id,
        modeOf(id),
        c.domain,
        c.modality,
        c.pps,
        // trace is intentionally lossy in the encoded payload.
        { intentionId: "i-1", source: "srcA" },
      );
      const decoded = deserializeSign(serializeSign(original));
      expect(decoded.modality).toBe(c.modality);
      expect(decoded.domain).toBe(c.domain);
      expect(decoded.pps).toBeCloseTo(c.pps, 6);
      expect(decoded.peirce.sign_class_id).toBe(original.peirce.sign_class_id);
      expect(decoded.peirce.sign_class_label).toBe(
        original.peirce.sign_class_label,
      );
      expect(decoded.peirce.path).toEqual(original.peirce.path);
      expect(decoded.peirce.mode).toBe(original.peirce.mode);
      expect(decoded.peirce.pragmatism_band).toBe(
        original.peirce.pragmatism_band,
      );
      // trace is NOT recoverable from the encoded payload.
      expect(decoded.trace).toBeUndefined();
    });
  }

  it("round-trips a HYBRID sign produced by compose", () => {
    const joined = compose(
      formalSign("THEOLOGY", "SYMBOL", 0.9),
      formalSign("TECHNOLOGY", "INDEX", 0.8),
      formalSign("COSMOLOGY", "ICON", 0.7),
    );
    const decoded = deserializeSign(serializeSign(joined));
    expect(decoded.modality).toBe("HYBRID");
    expect(decoded.peirce.sign_class_id).toBe(joined.peirce.sign_class_id);
  });

  it("deserializeSign throws on an unknown class id", () => {
    const sign = makeSign(
      formalArgumentClassId(),
      "SYMBOL",
      "THEOLOGY",
      "SYMBOL",
      0.5,
    ) as Sign<any, any>;
    (sign.peirce as any).sign_class_id = 999_999;
    expect(() => deserializeSign(serializeSign(sign))).toThrow(
      UnknownSignClassError,
    );
  });
});

describe("encodeSign / decodeSign (Trithemius cipher, L1)", () => {
  /** A fresh byte-alphabet (256) KeyCap over a wheel of the given size. */
  function freshKey(size: number) {
    return new KeyCap(new Wheel(size), 256);
  }

  it("round-trips a SYMBOL sign through an EncToken (modulo trace)", () => {
    const original = formalSign("THEOLOGY", "SYMBOL", 0.84);
    const encKey = freshKey(256);
    const token = encodeSign(original, encKey.wheel, encKey);
    expect(encKey.consumed).toBe(true);
    // EncToken cipher is byte-range (opaque, not the plaintext payload).
    expect(token.cipher.some((n) => n >= 256)).toBe(false);

    const decKey = freshKey(256);
    const decoded = decodeSign(token, decKey.wheel, decKey);
    expect(decKey.consumed).toBe(true);
    expect(decoded.modality).toBe("SYMBOL");
    expect(decoded.domain).toBe("THEOLOGY");
    expect(decoded.pps).toBeCloseTo(0.84, 6);
    expect(decoded.peirce.sign_class_id).toBe(original.peirce.sign_class_id);
    expect(decoded.peirce.path).toEqual(original.peirce.path);
    expect(decoded.trace).toBeUndefined();
  });

  it("encodeSign rejects a non-SYMBOL sign", () => {
    const icon = formalSign("TECHNOLOGY", "ICON", 0.5);
    const key = freshKey(256);
    expect(() => encodeSign(icon, key.wheel, key)).toThrow(EncSignModalityError);
  });

  it("encodeSign consumes the KeyCap (single-use capability)", () => {
    const sym = formalSign("COSMOLOGY", "SYMBOL", 0.6);
    const key = freshKey(256);
    encodeSign(sym, key.wheel, key);
    expect(key.consumed).toBe(true);
    expect(() => encodeSign(sym, key.wheel, key)).toThrow(
      KeyCapAlreadyConsumedError,
    );
  });

  it("decodeSign consumes the KeyCap (single-use capability)", () => {
    const sym = formalSign("COSMOLOGY", "SYMBOL", 0.6);
    const encKey = freshKey(256);
    const token = encodeSign(sym, encKey.wheel, encKey);
    const decKey = freshKey(256);
    decodeSign(token, decKey.wheel, decKey);
    expect(decKey.consumed).toBe(true);
    expect(() => decodeSign(token, decKey.wheel, decKey)).toThrow(
      KeyCapAlreadyConsumedError,
    );
  });

  it("decodeSign with a mismatched key fails to recover the sign", () => {
    const original = formalSign("THEOLOGY", "SYMBOL", 0.7);
    const encKey = freshKey(256);
    const token = encodeSign(original, encKey.wheel, encKey);
    // A key over a different wheel size yields a different shift sequence, so
    // the decrypted bytes do not parse back to a valid sign payload.
    const wrongKey = new KeyCap(new Wheel(7), 256);
    expect(() => decodeSign(token, wrongKey.wheel, wrongKey)).toThrow();
  });
});

describe("Wheel / KeyCap (Llull / Trithemius primitives)", () => {
  it("Wheel rotates forward and backward modulo size", () => {
    const w = new Wheel(5);
    expect(w.position).toBe(0);
    w.rotate(7);
    expect(w.position).toBe(2); // 7 % 5
    w.rotate(-1);
    expect(w.position).toBe(1);
    const w2 = new Wheel(5);
    w2.rotate(-1);
    expect(w2.position).toBe(4); // negative wrap
  });

  it("combineWheels returns the product of sizes; budgeted throws on overflow", () => {
    expect(combineWheels(new Wheel(3), new Wheel(4))).toBe(12);
    expect(combineWheelsBudgeted(100, new Wheel(3), new Wheel(4))).toBe(12);
    expect(() =>
      combineWheelsBudgeted(10, new Wheel(3), new Wheel(4)),
    ).toThrow(WheelBudgetExceededError);
  });

  it("KeyCap encrypt/decrypt round-trips when keyed from the same offset", () => {
    const wheel = new Wheel(5);
    const key = new KeyCap(wheel, 5);
    const plain = [0, 1, 2, 3, 4, 0, 1, 2];
    const { cipher, keyOffset } = key.encrypt(plain);
    expect(cipher).not.toEqual(plain); // actually shifted
    const recovered = key.decrypt(cipher, keyOffset);
    expect(recovered).toEqual(plain);
  });

  it("keyRotate advances the wheel", () => {
    const wheel = new Wheel(5);
    const key = new KeyCap(wheel, 5);
    keyRotate(key, 2);
    expect(wheel.position).toBe(2);
    rotateWheel(wheel, 1);
    expect(wheel.position).toBe(3);
  });

  it("KeyCap rejects out-of-range symbols", () => {
    const key = new KeyCap(new Wheel(5), 5);
    expect(() => key.encrypt([5])).toThrow(RangeError);
    expect(() => key.encrypt([-1])).toThrow(RangeError);
  });
});

describe("LOGOC manifold reuse", () => {
  it("loads the 66-class manifold through the workspace dependency", () => {
    expect(getManifold().allClasses()).toHaveLength(66);
  });

  it("fold dispatches HYBRID vs non-HYBRID", () => {
    const plain = formalSign("THEOLOGY", "SYMBOL", 0.9);
    expect(
      fold(
        plain,
        () => "pure",
        () => "hybrid",
      ),
    ).toBe("pure");
    const joined = compose(
      formalSign("THEOLOGY", "SYMBOL", 0.9),
      formalSign("TECHNOLOGY", "INDEX", 0.8),
      formalSign("COSMOLOGY", "ICON", 0.7),
    );
    expect(
      fold(
        joined,
        () => "pure",
        () => "hybrid",
      ),
    ).toBe("hybrid");
  });
});