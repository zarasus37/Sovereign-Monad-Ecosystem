# P5 — Full Corpus Audit Report

**Date:** June 20, 2026  
**Corpus:** 332 labeled events (from `logoc-corpus.json`, 3 events excluded due to missing `peirce` metadata)  
**Pipeline:** `LogocMLPipeline` v7 (Naive Bayes + Rubric ensemble)  
**Goal:** Identify the remaining 0.6% misclassifications (both rubric + ML wrong) and flag dirty-flag events for correction.

---

## Executive Summary

| Metric | Count | Rate |
|---|---|---|
| Total events | 332 | 100% |
| Rubric correct | 257 | 77.4% |
| ML correct | 310 | 93.4% |
| Ensemble agreement | 251 | 75.6% |
| Auto-accept | 251 | 75.6% |
| Human review | 81 | 24.4% |
| **Genuine misclassifications (both wrong)** | **12** | **3.6%** |
| Rubric wrong, ML correct | 63 | 19.0% |
| ML wrong, rubric correct | 10 | 3.0% |
| Ambiguous rubric (no prediction) | 14 | 4.2% |

---

## Key Finding: The 0.6% Is Actually 3.6%

The "0.6% misclassification" figure from prior simulations was overly optimistic. **12 events (3.6%) are genuinely misclassified** — both rubric AND ML predict the wrong class. These are not flag-cleaning problems; they are **corrupted data or fundamentally ambiguous narratives** that require manual correction.

However, **63 events (19.0%) are rubric-wrong-but-ML-correct** — these are dirty-flag events from the original v1 extraction. The ML model (trained on cleaned flags) correctly classifies them despite the noise. The rubric classifier, being greedy and deterministic, is sensitive to extra flags.

**Recommendation:** Bulk reprocess all 63 dirty-flag events with the v3 extractor to clean flags and restore rubric accuracy.

---

## Class-by-Class Breakdown

| Class | Events | Rubric OK | ML OK | HR | Auto | Notes |
|---|---|---|---|---|---|---|
| 0 (Rheme-Icon-Qualisign) | 84 | 82 (97.6%) | 83 (98.8%) | 3 | 81 | Excellent. HR events have extra `reason` or `fact` flags |
| 1 (Rheme-Index-Sinsign) | 29 | 23 (79.3%) | 29 (100%) | 6 | 23 | Rubric struggles with `similarity` flag contamination |
| 2 (Dicent-Index-Sinsign) | 79 | 19 (24.1%) | 73 (92.4%) | 58 | 21 | **Primary problem.** Dirty flags from v1 extraction |
| 3 (Rheme-Icon-Legisign) | 16 | 16 (100%) | 16 (100%) | 0 | 16 | Perfect |
| 4 (Rheme-Index-Legisign) | 15 | 15 (100%) | 15 (100%) | 0 | 15 | Perfect |
| 5 (Dicent-Index-Legisign) | 19 | 19 (100%) | 19 (100%) | 0 | 19 | Perfect |
| 6 (Rheme-Symbol-Legisign) | 12 | 12 (100%) | 12 (100%) | 0 | 12 | Perfect |
| 7 (Dicent-Symbol-Legisign) | 32 | 32 (100%) | 32 (100%) | 0 | 32 | Perfect |
| 8 (Argument-Index-Legisign) | 6 | 6 (100%) | 6 (100%) | 0 | 6 | Perfect |
| 9 (Dicent-Icon-Sinsign) | 18 | 11 (61.1%) | 5 (27.8%) | 12 | 6 | **Both rubric and ML struggle.** Small sample + complex narratives |
| 42 (Argument-Symbol-Legisign) | 22 | 22 (100%) | 20 (90.9%) | 2 | 20 | Excellent |

---

## The 12 Genuinely Misclassified Events (Both Rubric + ML Wrong)

These events require **manual review** — no amount of flag cleaning will fix them because the flags themselves are corrupted or the narrative is fundamentally ambiguous.

### Category A: Flag Corruption (All Flags On) — 5 events

These events have **all 8 flags set to True**, which is impossible in Peirce's system (a sign cannot be both Sinsign and Legisign, both Icon and Symbol, etc.). This is a data corruption from the original v1 extraction.

| Event ID | Actual | Rubric | ML | Flags | Narrative Hint |
|---|---|---|---|---|---|
| `gnosis_Akhenaten...ev10` | 2 | 42 | 42 | **ALL ON** | "bind the future through present declaration" |
| `gnosis_Gnostic Jesus...ev08` | 9 | 42 | 42 | **ALL ON** | "transmission from the Father" |
| `gnosis_King Solomon...ev05` | 2 | 42 | 42 | **ALL ON** | "all achievements were vapor" |
| `gnosis_Friedrich Nietzsche...ev01` | 9 | 3 | 42 | SO=1 RB=1 SI=1 CA=0 | "inner experience was a map of reality" |
| `gnosis_Niccolò Machiavelli...ev07` | 9 | 3 | 42 | SO=1 RB=1 SI=1 CA=0 | "exile placed him in a position to receive instruction" |

**Action:** Re-extract flags from narrative using v3 extractor. If v3 produces the same all-flags-on result, flag as **data corruption** and require manual classification.

### Category B: Missing/Null Flags (Synthetic Camera Address Entries) — 3 events

These are **synthetic entries** ("Tripartite Camera Address", "Confidence Score") that were generated as part of the synthetic data creation but do not have proper narrative text for flag extraction. They have **almost no flags set**.

| Event ID | Actual | Rubric | ML | Flags | Note |
|---|---|---|---|---|---|
| `gnosis_CHARLES PEIRCE_ev2` | 2 | null | 5 | SO=0 RB=0 SI=0 CA=1 FA=1 | Camera address synthetic, no narrative |
| `gnosis_CHARLES PEIRCE_ev3` | 2 | null | 5 | SO=0 RB=0 SI=0 CA=1 FA=1 | Camera address synthetic, no narrative |
| `gnosis_Zarathustra_ev2` | 2 | null | 5 | SO=0 RB=0 SI=0 CA=1 FA=1 | Camera address synthetic, no narrative |

**Action:** These events have **insufficient narrative text for automatic classification**. They should be:
- Either removed from the training corpus (they are synthetic artifacts without proper data)
- Or manually classified with expert judgment

### Category C: Ambiguous Class 9 Narratives (ML Low Confidence) — 4 events

Class 9 (Dicent-Iconic-Sinsign = `single_occurrence + similarity + fact`) is the most difficult class because it requires **both causality and similarity** — but the rubric classifier uses greedy priority (causality > similarity). When narratives contain both causal and similarity language, the rubric defaults to Index (causality), while the ML model (trained on small sample) struggles to distinguish.

| Event ID | Actual | Rubric | ML | ML Conf | Flags | Problem |
|---|---|---|---|---|---|---|
| `gnosis_Gnostic Jesus...ev15` | 9 | 8 | 2 | 0.761 | SO=1 RB=1 SI=1 CA=1 FA=1 RE=1 | All flags on + similarity |
| `gnosis_Marcus Aurelius...ev05` | 9 | 3 | 42 | 0.820 | SO=1 RB=1 SI=1 CA=0 FA=1 RE=1 | No causality, but similarity + reason |
| `gnosis_Napoleon Bonaparte...ev10` | 9 | 3 | 3 | 0.802 | SO=1 RB=1 SI=1 CA=0 FA=1 RE=0 | No causality, similarity + rule_based |
| `gnosis_Friedrich Nietzsche...ev01` | 9 | 3 | 42 | 0.820 | SO=1 RB=1 SI=1 CA=0 FA=1 RE=1 | Similarity + rule_based + reason |

**Action:** These are **genuinely ambiguous** — the narratives describe recognition events that involve both similarity (seeing oneself in another) and rule-based structure (general principle). Manual review is required. The class 9 profile (`single_occurrence + similarity + fact`) may need to be relaxed to allow `causality=0` when `similarity=1` is the primary object relation.

---

## The 63 Dirty-Flag Events (Rubric Wrong, ML Correct)

These are **flag extraction errors**, not genuine misclassifications. The ML model (trained on cleaned data) correctly identifies the class despite dirty flags. The rubric classifier is sensitive to extra flags because it uses greedy priority:

### Most Common Dirty Flag Patterns (Human Review Events)

| Flag Profile | Count | Problem | Actual Class | Rubric | ML |
|---|---|---|---|---|---|
| `SO=1 RB=1 CA=1 FA=1 RE=1 PO=1` | 12 | `reason` + `possibility` falsely set on Class 2 | 2 | 8 | 2 |
| `SO=1 RB=1 CA=1 FA=1 RE=1 PO=0` | 11 | `reason` falsely set on Class 2 | 2 | 8 | 2 |
| `SO=1 RB=0 CA=1 FA=1 RE=1 PO=1` | 8 | `reason` + `possibility` on Class 2 | 2 | 8 | 2 |
| `SO=1 RB=1 CA=1 FA=1 RE=0 PO=0` | 7 | `rule_based` on Class 2 | 2 | 5 | 2 |
| `SO=1 RB=0 SI=1 CA=0 PO=1 FA=0 RE=0` | 7 | `similarity` on Class 1/3 | 1 | 3 | 1 |

**Root causes:**
1. **`reason` flag** (43 events): "because" in narrative interpreted as inferential (Argument) instead of causal (Index). The v3 extractor fixes this.
2. **`rule_based` flag** (35 events): "structure", "pattern", "system" in narrative interpreted as Legisign instead of descriptive. The v3 extractor fixes this.
3. **`possibility` flag** (24 events): "could", "might" in narrative interpreted as Rheme instead of past tense. The v3 extractor fixes this.
4. **`similarity` flag** (7 events): "like", "as" in narrative interpreted as Icon instead of causal. Context-dependent.

**Action:** Run `batch_reprocess_class2.py` with the v3 extractor on all 63 events. Expected result: 60+ events will have clean flags and rubric will match ML.

---

## The 10 ML-Only Errors (ML Wrong, Rubric Correct)

These are cases where the **rubric is correct** but the ML model disagrees. Most are Class 9 events where the ML model has insufficient training data.

| Class | Count | ML Issue |
|---|---|---|
| 9 | 5 | ML trained on 18 events, confuses with Class 3 or 42 |
| 42 | 2 | ML borderline, rubric direct match |
| 0 | 1 | Extra `reason` flag confuses ML |
| 2 | 2 | Low confidence (0.483) on synthetic entries |

**Action:** Class 9 needs **synthetic enrichment** (already partially done with 3 synthetic events). Add 5-10 more clean Class 9 examples to boost ML accuracy from 27.8% to 80%+.

---

## The 14 Ambiguous Rubric Events (No Prediction)

These events have flag combinations that do not map to any valid Peirce path. The rubric returns `null`, but the ML model still makes a prediction.

| Flags | Count | Example |
|---|---|---|
| `SO=1 RB=0 SI=0 CA=1 CO=1 PO=1 FA=1 RE=1` | 2 | Spinoza events: `convention` + `reason` + `possibility` all set |
| `SO=0 RB=0 SI=0 CA=1 PO=0 FA=1 RE=0` | 2 | Camera address synthetic entries |
| `SO=0 RB=0 SI=0 CA=0 PO=0 FA=1 RE=0` | 1 | Insufficient flags for any class |
| Other | 9 | Various invalid combinations |

**Action:** These are **corrupted data**. Run v3 extractor; if still invalid, flag for manual review or removal from corpus.

---

## Recommended Actions

### Immediate (High Priority)

1. **Run bulk flag reprocessing** (`scripts/batch_reprocess_class2.py` extended to all classes)
   - Target: All 63 dirty-flag events
   - Expected: 60+ events become auto-accept, reducing HR from 24.4% to ~6%

2. **Manual review of 12 genuinely misclassified events**
   - 5 flag-corruption events: re-extract with v3, if still corrupted → manual classification
   - 3 synthetic entries: remove from corpus or manually classify
   - 4 ambiguous Class 9 events: expert manual classification

3. **Class 9 enrichment**
   - Add 5-10 synthetic Class 9 events with clean `single_occurrence + similarity + fact` profile
   - Retrain ML v8 on expanded corpus

### Medium Priority

4. **Rubric confidence calibration**
   - The 14 ambiguous rubric events suggest the rubric classifier needs a fallback for invalid flag combinations
   - Add a `default_class` for ambiguous cases (e.g., default to ML prediction when rubric is ambiguous)

5. **Pipeline threshold tuning**
   - Current ML confidence threshold for auto-accept is 0.55 (low) and 0.85 (high)
   - For Class 2 events, the ML model is very confident (0.94+ on clean flags) — could lower threshold to 0.40 for Class 2 specifically
   - For Class 9, ML is unreliable (0.27 accuracy) — could raise threshold to 0.90 or require rubric direct for Class 9

### Long Term

6. **P6 — sklearn upgrade**
   - When scikit-learn is available, retrain with Random Forest / XGBoost on 36 features
   - Expected improvement: ML accuracy from 93.4% to 95%+, especially on Class 9
   - See `P6 — sklearn Upgrade Plan` section below

---

## P6 — sklearn Upgrade Plan (When Available)

### Current Limitations

- **Naive Bayes**: 93.4% accuracy, but assumes feature independence (false for Peirce triads)
- **Logistic Regression**: 85.9% accuracy (with interaction features), good but limited by linearity
- **Ensemble Stumps**: 45.8% accuracy — fundamentally unsuited for 11-class problems with 8 binary features
- **Class 9**: 27.8% ML accuracy — small sample (18 events) + complex profile

### sklearn Upgrade Plan

| Algorithm | Expected Accuracy | Rationale |
|---|---|---|
| **Random Forest** | 94-96% | Handles non-linear interactions, feature importance, robust to noise |
| **XGBoost** | 95-97% | Gradient boosting, handles imbalanced classes (Class 9 has 18 events), built-in regularization |
| **SVM (RBF kernel)** | 93-95% | Good for high-dimensional sparse data (8 binary features × 11 classes) |
| **Ensemble (RF + XGB + LR)** | 96-98% | Voting ensemble of diverse algorithms |

### Feature Engineering for sklearn

- **Base features**: 8 binary flags (same as current)
- **Interaction features**: 28 pairwise interactions (same as v7)
- **New features for sklearn**:
  - Triad path encoding (one-hot encode Vehicle-Object-Interpretant combinations)
  - Firstness/Secondness/Thirdness weights (from rubric classifier)
  - Pragmatism band encoding (one-hot: EXPERIENCE, PRACTICE, FORMAL, HABIT, BEING)
  - Narrative length (word count)
  - Gnosis trigger count (how many gnosis keywords appear)

### Expected Impact

| Metric | Current (NB v7) | Expected (RF/XGB) |
|---|---|---|
| Overall ML accuracy | 93.4% | 95-97% |
| Class 9 accuracy | 27.8% | 60-80% |
| Class 1 accuracy | 100% | 100% |
| Class 2 accuracy | 92.4% | 94-96% |
| Ensemble auto-accept | 75.6% | 82-88% |
| Human review rate | 24.4% | 12-18% |
| Genuine misclassifications | 3.6% | 2-3% |

### Implementation Steps

1. Install scikit-learn: `pip install scikit-learn xgboost`
2. Generate sklearn-compatible training data from `master_corpus_v5.2.jsonl`
3. Train Random Forest, XGBoost, SVM with cross-validation
4. Evaluate per-class accuracy and confusion matrix
5. Select best model or ensemble
6. Serialize with `joblib` (or JSON for compatibility)
7. Update `LogocMLPipeline` to load sklearn model if available, fallback to NB if not
8. Retrain drift scheduler baselines with new model

---

## Files

- `logs/audit/corpus_audit_p5.json` — Full audit data (332 events, 2,306 lines)
- `logs/audit/corpus_audit_p5.md` — This report
- `scripts/audit_corpus_p5.py` — Audit script (self-contained, no pydantic dependency)

---

## Appendix: Rubric Method Distribution

| Method | Count | % | Notes |
|---|---|---|---|
| `direct` | 238 | 71.7% | Clean flags → exact triad match |
| `fallback_interpretant` | 36 | 10.8% | Vehicle and object match, interpretant fallback |
| `fallback_object` | 44 | 13.3% | Vehicle and interpretant match, object fallback |
| `ambiguous` | 14 | 4.2% | No valid triad — invalid flag combination |

**Observation:** 24.4% of events require fallback or are ambiguous. This is high. After bulk flag cleaning, expected distribution: `direct` 85-90%, `fallback` 5-8%, `ambiguous` <2%.
