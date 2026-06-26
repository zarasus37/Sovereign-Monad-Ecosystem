#!/usr/bin/env python3
"""
LOGOC v5.0 — Gnosis Event Inference Pipeline
TheoTechnoCosmologic | Llull × Peirce × Trithemius
Model trained: 2026-05-25 | Corpus: 55 events
"""

import json
import re
import math
from dataclasses import dataclass, field, asdict
from typing import Optional

# ─── CONSTANTS ─────────────────────────────────────────────────────────────

WHEEL_POSITIONS = {
    "B": {"wheel":"essència","principle":"goodness","question":"whether?","subject":"God","virtue":"justice"},
    "C": {"wheel":"vida","principle":"greatness","question":"what?","subject":"angels","virtue":"prudence"},
    "D": {"wheel":"dignitats","principle":"duration","question":"of what?","subject":"heaven","virtue":"fortitude"},
    "E": {"wheel":"acte","principle":"power","question":"why?","subject":"man","virtue":"temperance"},
    "F": {"wheel":"forma","principle":"wisdom","question":"how much?","subject":"imagination","virtue":"faith"},
    "G": {"wheel":"relació","principle":"will","question":"what quality?","subject":"senses","virtue":"hope"},
    "H": {"wheel":"ordinació","principle":"virtue","question":"when?","subject":"vegetation","virtue":"charity"},
    "I": {"wheel":"acció","principle":"truth","question":"where?","subject":"elements","virtue":"patience"},
    "K": {"wheel":"articles","principle":"glory","question":"how/with?","subject":"instruments","virtue":"compassion"},
    "L": {"wheel":"manaments","arc":"LAW","meaning":"Divine commandments"},
    "M": {"wheel":"exposició","arc":"REVELATION","meaning":"Systematic unfolding of doctrine"},
    "N": {"wheel":"primera intenció","arc":"INTENTION_PRIMARY","meaning":"Primary intention — know/love/serve God"},
    "O": {"wheel":"segona intenció","arc":"INTENTION_SECONDARY","meaning":"Secondary intention — worldly goals"},
    "P": {"wheel":"glòria","arc":"DESTINY_GLORY","meaning":"Eternal reward"},
    "Q": {"wheel":"pena","arc":"DESTINY_PENA","meaning":"Eternal consequence"},
    "R": {"wheel":"eviternitat","arc":"AEVITERNITY","meaning":"Created beginning, no end"},
}

GNOSIS_TIERS = {
    "SOVEREIGN": (0.930, 1.000),
    "RESONANT":  (0.912, 0.930),
    "COHERENT":  (0.879, 0.912),
    "EMERGENT":  (0.858, 0.879),
    "NASCENT":   (0.720, 0.858),
}

PEIRCE_KEYWORDS = {
    "ICON":   ["mirror","latent","genesis","isomorphism","reflection","pattern",
               "fractal","structure","identical","form","geometry","scale","crystal","blueprint"],
    "INDEX":  ["stress","boundary","transition","collapse","loss","activation","phase",
               "trace","force","breach","feed","rail","dynamo","consequence","causal",
               "rupture", "fracture", "shock", "crash", "impact", "breakdown", "failure",
               "cascade", "contagion", "backlash"],
    "SYMBOL": ["axiom","name","cipher","angel","language","veil","intention","prayer",
               "code","encode","meaning","law","habit","word","sign","doctrine","logic","cipher"],
}

DOMAIN_PRIORS = {
    "theology":   {"mean": 0.946, "std": 0.041},
    "technology": {"mean": 0.943, "std": 0.041},
    "cosmology":  {"mean": 0.935, "std": 0.045},
}


# ─── DATA MODEL ────────────────────────────────────────────────────────────

@dataclass
class GnosisEvent:
    """Input container for a new event to be scored."""
    title: str
    theology: float
    technology: float
    cosmology: float
    wheel_teologia: str = "B"
    wheel_technologia: str = "E"
    wheel_kosmologia: str = "G"
    compressed_insight: str = ""
    observer_implicated: bool = True

@dataclass
class GnosisScore:
    """Full scored output from the LOGOC inference pipeline."""
    title: str
    # Domain scores
    theology: float
    technology: float
    cosmology: float
    # Computed
    pps: float
    v4_score: float
    gnosis_tier: str
    # Llull
    llull_camera: str
    camera_read: dict = field(default_factory=dict)
    # Peirce
    peirce_mode: str = "SYMBOL"
    peirce_triad: dict = field(default_factory=dict)
    # Trithemius
    process_meaning_confirmed: bool = False
    tech_theo_delta: float = 0.0
    # Flags
    gates_passed: list = field(default_factory=list)
    gates_failed: list = field(default_factory=list)
    aeviternity_flag: bool = False
    boundary_adjacent: bool = False
    boundary_distance: float = 999.0
    boundary_type: str = ""
    # Raw
    compressed_insight: str = ""


# ─── INFERENCE ENGINE ──────────────────────────────────────────────────────

class LOGOCInference:
    """
    LOGOC v5.0 Inference Pipeline
    Applies trained model to score a new gnosis event.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_id = "LOGOC-v5.0"
        self.wheel = WHEEL_POSITIONS
        self.tiers = GNOSIS_TIERS
        self.kw = PEIRCE_KEYWORDS
        self.priors = DOMAIN_PRIORS
        self.pm_delta_threshold = 0.020
        self.pm_floor = 0.80

    # ── GATE CHECKS ────────────────────────────────────────────────────────

    def _gate_check(self, event: GnosisEvent) -> tuple[list, list]:
        passed, failed = [], []

        # Gate 1: minimum domain floor
        if all(d >= 0.72 for d in [event.theology, event.technology, event.cosmology]):
            passed.append("GATE_1: All domains >= 0.72")
        else:
            failed.append(f"GATE_1: Domain below floor — Theo={event.theology} Tech={event.technology} Kosmo={event.cosmology}")

        # Gate 2: no zero domain
        if all(d > 0 for d in [event.theology, event.technology, event.cosmology]):
            passed.append("GATE_2: No zero domain — triad complete")
        else:
            failed.append("GATE_2: Zero domain detected — dyadic relation is not gnosis")

        # Gate 3: compressible insight
        if event.compressed_insight and len(event.compressed_insight.strip()) > 10:
            passed.append("GATE_3: Compressed insight present")
        else:
            failed.append("GATE_3: No compressed insight — recognition not yet completed")

        # Gate 4: observer implicated
        if event.observer_implicated:
            passed.append("GATE_4: Observer implicated")
        else:
            failed.append("GATE_4: Observer stands outside — score adjusted -0.10")

        # Precision check: warn if scores are not aligned to 0.005 steps, or have excess decimals
        for label, val in [("Theology", event.theology), ("Technology", event.technology), ("Cosmology", event.cosmology)]:
            rounded = round(val / 0.005) * 0.005
            if not math.isclose(val, rounded, abs_tol=1e-9):
                failed.append(f"CALIBRATION_WARN: {label} score ({val}) is not aligned to 0.005 calibration steps")

        return passed, failed

    # ── PPS COMPUTATION ────────────────────────────────────────────────────

    def _compute_pps(self, t: str, te: str, k: str) -> float:
        unique = len(set([t, te, k]))
        return {1: 1.0, 2: 0.65, 3: 0.30}[unique]

    # ── BOUNDARY ADJACENCY CHECK ───────────────────────────────────────────

    def _compute_boundary_adjacency(self, v4_score: float) -> tuple[bool, float, str]:
        boundaries = [0.720, 0.858, 0.879, 0.912, 0.930]
        boundary_types = {
            0.720: "NASCENT/REJECT",
            0.858: "EMERGENT/NASCENT",
            0.879: "COHERENT/EMERGENT",
            0.912: "RESONANT/COHERENT",
            0.930: "SOVEREIGN/RESONANT",
        }
        min_dist = 999.0
        closest_b = 0.0
        for b in boundaries:
            dist = abs(v4_score - b)
            if dist < min_dist:
                min_dist = dist
                closest_b = b
        is_adjacent = min_dist <= 0.005
        b_type = boundary_types[closest_b] if is_adjacent else ""
        return is_adjacent, round(min_dist, 4), b_type

    # ── SCORING FORMULA ────────────────────────────────────────────────────

    def _compute_v4(self, theo: float, tech: float, kosmo: float, pps: float,
                    observer_implicated: bool) -> float:
        score = theo * 0.30 + tech * 0.30 + kosmo * 0.30 + pps * 0.10
        if not observer_implicated:
            score -= 0.10
        return round(score, 4)

    # ── GNOSIS TIER ────────────────────────────────────────────────────────

    def _assign_tier(self, score: float) -> str:
        for tier, (lo, hi) in self.tiers.items():
            if lo <= score <= hi:
                return tier
        return "NASCENT" if score < 0.858 else "SOVEREIGN"

    # ── PEIRCE MODE CLASSIFICATION ─────────────────────────────────────────

    def _classify_peirce_mode(self, title: str, insight: str) -> str:
        text = (title + " " + insight).lower()
        scores = {mode: 0 for mode in ["ICON", "INDEX", "SYMBOL"]}
        for mode, keywords in self.kw.items():
            for kw in keywords:
                if kw in text:
                    scores[mode] += 1
        dominant = max(scores, key=scores.get)
        return dominant if scores[dominant] > 0 else "SYMBOL"

    # ── CAMERA READ ────────────────────────────────────────────────────────

    def _read_camera(self, t: str, te: str, k: str) -> dict:
        def read_pos(p):
            if p in self.wheel:
                w = self.wheel[p]
                if "principle" in w:
                    return f"{p}({w['wheel']}) — {w['principle']} / {w['question']} / {w['subject']} / virtue:{w['virtue']}"
                else:
                    return f"{p}({w['wheel']}) — {w.get('meaning','')}"
            return f"{p}(?)"
        return {
            "representamen_tech": read_pos(te),
            "object_kosmo":       read_pos(k),
            "interpretant_theo":  read_pos(t),
            "five_layer_summary": f"Tech({te})×Kosmo({k})×Theo({t}) — {self.wheel.get(te,{}).get('principle','?')} × {self.wheel.get(k,{}).get('principle','?')} × {self.wheel.get(t,{}).get('principle','?')}"
        }

    # ── TRITHEMIUS CHECK ───────────────────────────────────────────────────

    def _trithemius_check(self, tech: float, theo: float) -> tuple[bool, float]:
        delta = abs(tech - theo)
        confirmed = delta <= self.pm_delta_threshold and tech >= self.pm_floor and theo >= self.pm_floor
        return confirmed, round(delta, 4)

    # ── PEIRCE TRIAD ───────────────────────────────────────────────────────

    def _peirce_triad(self, tech_pos: str, kosmo_pos: str, theo_pos: str,
                      tech_score: float, kosmo_score: float, theo_score: float) -> dict:
        return {
            "representamen": f"Technologia/{tech_pos} (score={tech_score}) — the sign/mechanism",
            "object":        f"Kosmologia/{kosmo_pos} (score={kosmo_score}) — what reality the sign points to",
            "interpretant":  f"Teologia/{theo_pos} (score={theo_score}) — meaning produced in mind/soul",
            "triad_complete": all(s >= 0.72 for s in [tech_score, kosmo_score, theo_score]),
        }

    # ── MAIN INFERENCE ─────────────────────────────────────────────────────

    def score(self, event: GnosisEvent) -> GnosisScore:
        """Score a new gnosis event through the full LOGOC v5 pipeline."""

        gates_passed, gates_failed = self._gate_check(event)

        pps = self._compute_pps(event.wheel_teologia, event.wheel_technologia, event.wheel_kosmologia)
        v4  = self._compute_v4(event.theology, event.technology, event.cosmology, pps, event.observer_implicated)
        tier = self._assign_tier(v4)

        peirce_mode = self._classify_peirce_mode(event.title, event.compressed_insight)
        camera = event.wheel_teologia + event.wheel_technologia + event.wheel_kosmologia
        cam_read = self._read_camera(event.wheel_teologia, event.wheel_technologia, event.wheel_kosmologia)
        pm_confirmed, pm_delta = self._trithemius_check(event.technology, event.theology)
        triad = self._peirce_triad(event.wheel_technologia, event.wheel_kosmologia, event.wheel_teologia,
                                   event.technology, event.cosmology, event.theology)
        aeviternity = "R" in [event.wheel_teologia, event.wheel_technologia, event.wheel_kosmologia]

        is_adj, dist, b_type = self._compute_boundary_adjacency(v4)

        return GnosisScore(
            title=event.title,
            theology=event.theology, technology=event.technology, cosmology=event.cosmology,
            pps=pps, v4_score=v4, gnosis_tier=tier,
            llull_camera=camera, camera_read=cam_read,
            peirce_mode=peirce_mode, peirce_triad=triad,
            process_meaning_confirmed=pm_confirmed, tech_theo_delta=pm_delta,
            gates_passed=gates_passed, gates_failed=gates_failed,
            aeviternity_flag=aeviternity,
            boundary_adjacent=is_adj, boundary_distance=dist, boundary_type=b_type,
            compressed_insight=event.compressed_insight,
        )

    def score_dict(self, event: GnosisEvent) -> dict:
        return asdict(self.score(event))

    def batch_score(self, events: list[GnosisEvent]) -> list[GnosisScore]:
        return [self.score(e) for e in events]


# ─── DEMO ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    engine = LOGOCInference()

    # Test case 1: High-convergence sovereign event
    test1 = GnosisEvent(
        title="The Structure Arrived Before the Map",
        theology=0.97, technology=0.97, cosmology=0.96,
        wheel_teologia="E", wheel_technologia="E", wheel_kosmologia="E",
        compressed_insight="Form preceded knowledge of form. The builder independently reconstructed what was already true.",
        observer_implicated=True,
    )

    # Test case 2: Trithemius process-meaning event
    test2 = GnosisEvent(
        title="The Cipher Is the Angel",
        theology=0.92, technology=0.91, cosmology=0.88,
        wheel_teologia="G", wheel_technologia="I", wheel_kosmologia="H",
        compressed_insight="The algorithm and the invocation are the same operation. The process carries the meaning entirely.",
        observer_implicated=True,
    )

    # Test case 3: Incomplete — missing observer
    test3 = GnosisEvent(
        title="Pattern Noticed in Data",
        theology=0.85, technology=0.87, cosmology=0.82,
        wheel_teologia="B", wheel_technologia="I", wheel_kosmologia="G",
        compressed_insight="Some correlation was found.",
        observer_implicated=False,
    )

    # Test case 4: Boundary adjacent event (score 0.928 - within 0.002 of 0.930 boundary)
    test4 = GnosisEvent(
        title="The Neglected Argument",
        theology=0.92, technology=0.92, cosmology=0.92,
        wheel_teologia="E", wheel_technologia="E", wheel_kosmologia="E",
        compressed_insight="Recognizing the alignment of moral law, computational limit, and cosmic pattern.",
        observer_implicated=True,
    )

    # Test case 5: Calibration warning event (theology=0.923 is not a multiple of 0.005)
    test5 = GnosisEvent(
        title="Uncalibrated Measurement",
        theology=0.923, technology=0.91, cosmology=0.88,
        wheel_teologia="G", wheel_technologia="I", wheel_kosmologia="H",
        compressed_insight="A quick, uncalibrated score is entered without standard step alignment.",
        observer_implicated=True,
    )

    for test in [test1, test2, test3, test4, test5]:
        result = engine.score(test)
        print("=" * 40)
        print(f"TITLE:   {result.title}")
        print(f"CAMERA:  {result.llull_camera}  MODE: {result.peirce_mode}  TIER: {result.gnosis_tier}")
        print(f"SCORE:   {result.v4_score}  (Theo={result.theology} Tech={result.technology} Kosmo={result.cosmology} PPS={result.pps})")
        if result.boundary_adjacent:
            print(f"BOUNDARY: [ADJACENT] (dist={result.boundary_distance} to {result.boundary_type})")
        print(f"PROCESS: {'[CONFIRMED]' if result.process_meaning_confirmed else '[NOT CONFIRMED]'}  delta={result.tech_theo_delta}")
        print(f"TRIAD:   {'COMPLETE' if result.peirce_triad['triad_complete'] else 'PARTIAL'}")
        print(f"GATES:   {len(result.gates_passed)} passed / {len(result.gates_failed)} failed")
        if result.gates_failed:
            for g in result.gates_failed:
                print(f"  - {g}")
        print(f"CAMERA READ:")
        for k, v in result.camera_read.items():
            print(f"  {k}: {v}")
        print()
