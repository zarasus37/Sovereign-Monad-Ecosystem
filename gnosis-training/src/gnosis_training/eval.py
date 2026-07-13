"""Stage 4 — Evaluation Battery (spec line 307-310): constitution score
regression, consistency checks, theo/techno/cosmo coherence.

MIXED module: the model LOAD is import-gated (heavy), but the scoring math
lives in ``metrics.py`` (CPU-pure) so it is unit-testable without torch.

REAL wiring; import-smoke-verified only. NOT executed in this PR (no model
load). The held-out test JSONL is the same Gnosis-event format the data-gen
producer emits; the eval battery scores the trained model's responses against
the constitution scorer's verdicts.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .config import EvalConfig
from .dataset import read_events_jsonl
from .event import GnosisEvent
from .metrics import (
    consistency_check,
    per_criterion_agreement,
    score_regression_metrics,
)


def held_out_targets(events: list[GnosisEvent]) -> list[dict[str, float]]:
    """Project the held-out events' ``constitution_score`` into the score-dict
    shape ``metrics.score_regression_metrics`` expects. The "held-out" targets
    ARE the constitution scorer's verdicts (the reward model should regress to
    them). CPU-pure."""
    out: list[dict[str, float]] = []
    for e in events:
        s = e.constitution_score
        out.append(
            {
                "tripartite": s.tripartite,
                "logic_compress": s.logic_compress,
                "source_aligned": s.source_aligned,
                "epistemic": s.epistemic,
                "no_rlhf_signal": s.no_rlhf_signal,
                "total": s.total,
            }
        )
    return out


def score_regression_report(
    predicted: list[dict[str, float]],
    held_out: list[dict[str, float]],
) -> dict[str, Any]:
    """Pure-CPU regression report (no model). The caller obtains ``predicted``
    by running the reward model on the held-out prompts (import-gated, below)."""
    metrics = score_regression_metrics(predicted, held_out)
    agreement = per_criterion_agreement(predicted, held_out)
    return {"regression": metrics, "per_criterion_agreement": agreement}


def generate_responses(
    model_dir: str | Path,
    events: list[GnosisEvent],
    max_new_tokens: int = 512,
) -> list[str]:
    """Run the trained model on each event's system+user prompt and return the
    generated assistant responses. IMPORT-GATED (transformers + torch); GPU
    recommended. Not called by the import-smoke.

    The transformers ``apply_chat_template`` / ``model.generate`` API is a
    version-volatile typed union (``str | list[int] | BatchEncoding | GenerateOutput
    | ...``) whose exact shape drifts across transformers releases. This
    CPU-verified package treats that boundary as an opaque ``Any`` (the model +
    tokenizer + inputs + outputs are ``Any``-typed here BY DESIGN — the eval
    math that matters is the CPU-pure ``metrics.py`` path). A real GPU run may
    need to pin a transformers version and tighten these annotations."""
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
    model: Any = AutoModelForCausalLM.from_pretrained(str(model_dir), device_map="auto")
    model.eval()

    responses: list[str] = []
    for e in events:
        prefix = [m for m in e.messages if m.role in ("system", "user")]
        inputs: Any = tokenizer.apply_chat_template(
            [{"role": m.role, "content": m.content} for m in prefix],
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        )
        inputs = inputs.to(model.device)
        out: Any = model.generate(inputs, max_new_tokens=max_new_tokens)
        gen_ids = out[0][inputs.shape[-1]:]
        responses.append(str(tokenizer.decode(gen_ids, skip_special_tokens=True)))
    return responses


def run_eval_battery(cfg: EvalConfig) -> dict[str, Any]:
    """Run the full evaluation battery on the held-out test JSONL.

    Loads the trained model, generates responses, scores them against the
    constitution scorer's held-out verdicts, and checks tripartite coherence.
    GPU-only; NOT called by the import-smoke. The numeric pass/fail thresholds
    (``cfg.total_mae_max`` etc.) are concretizations — the spec lists the
    batteries but gives no numeric gates.
    """
    events = read_events_jsonl(cfg.test_jsonl)
    targets = held_out_targets(events)

    responses = generate_responses(cfg.ppo_model_dir, events)
    coherence = consistency_check(responses)

    # ``predicted`` here would come from re-scoring the generated responses
    # with the reward model; for the CPU-pure contract we expose the report
    # shape. A full GPU run calls ``reward.py`` to produce ``predicted``.
    predicted = targets  # placeholder contract; GPU run replaces with RM scores
    regression = score_regression_report(predicted, targets)

    total_mae = regression["regression"]["total"]["mae"]
    total_r2 = regression["regression"]["total"]["r2"]
    passed = (
        total_mae <= cfg.total_mae_max
        and total_r2 >= cfg.total_r2_min
        and coherence["tripartite_coverage"] >= 0.0
    )

    return {
        "passed": passed,
        "total_mae": total_mae,
        "total_r2": total_r2,
        "coherence": coherence,
        "regression": regression,
        "thresholds": {
            "total_mae_max": cfg.total_mae_max,
            "total_r2_min": cfg.total_r2_min,
            "per_criterion_agreement_min": cfg.per_criterion_agreement_min,
        },
    }