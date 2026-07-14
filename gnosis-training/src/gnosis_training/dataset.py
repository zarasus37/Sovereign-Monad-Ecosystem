"""JSONL → HuggingFace ``datasets`` adapter (Stage 1 SFT input).

Reads the Gnosis-event JSONL produced by ``@sovereign/gnosis-training-data`` and
turns it into an HF ``datasets.Dataset`` in chat format for ``SFTTrainer``.

HONEST CONCRETIZATIONS (do NOT regress):

- **``passes``-gate** (SFT inclusion gate). The spec (lines 172 + 294) describes
  SFT input as "constitution-verified samples"; the spec never explicitly says
  ``passes`` is the gate, but ``constitution_score.passes`` is the binary
  verdict the data-gen producer computes, so the adapter drops events where
  ``passes is False``. Grounded in the spec's "constitution-verified" wording,
  NOT spec-mandated — documented as a concretization.
- **Assistant loss-masking.** The spec format has system / user / assistant
  messages; SFT trains the model to PRODUCE the assistant turn given system +
  user. The adapter exposes a ``build_completion_only_labels`` helper that
  masks every token except the assistant content (TRL's
  ``DataCollatorForCompletionOnlyLM`` discipline), so loss is only on the
  target. Concretization — the spec never says "mask the prompt", but it is the
  standard SFT convention.
- **``assistant`` content is empty in the feedstock** (the data-gen producer
  emits it empty — it is the SFT target). So the adapter's SFT-ready output is
  ONLY meaningful AFTER a labeling pass fills the assistant content (a future
  GPU / human job). The adapter does NOT fabricate responses: it exposes the
  scaffold and documents that training requires the assistant turn to be
  filled downstream.

CPU-pure-ish: uses ``datasets`` (no torch). The ``datasets`` import is inside
the functions so the module imports on a box without ``datasets`` (tests guard
with ``pytest.importorskip("datasets")``).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator

from .event import GnosisEvent, from_wire, validate_event


def read_events_jsonl(path: str | Path) -> list[GnosisEvent]:
    """Read a Gnosis-event JSONL into a list of typed events. CPU-pure (no
    ``datasets``). Raises on a malformed line."""
    events: list[GnosisEvent] = []
    with Path(path).open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            events.append(from_wire(json.loads(line)))
    return events


def iter_events_jsonl(path: str | Path) -> Iterator[GnosisEvent]:
    """Stream events from a JSONL without loading all into memory."""
    with Path(path).open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield from_wire(json.loads(line))


def passes_gate(event: GnosisEvent) -> bool:
    """The SFT inclusion gate: ``constitution_score.passes`` AND structural
    validity. Concretization grounded in spec lines 172+294
    ("constitution-verified samples") — the spec never explicitly names
    ``passes`` as the gate."""
    return event.constitution_score.passes and not validate_event(event)


def filter_passed(events: list[GnosisEvent]) -> list[GnosisEvent]:
    """Drop events that fail the ``passes``-gate (rejected before SFT training
    ever sees them, spec line 172)."""
    return [e for e in events if passes_gate(e)]


def to_chat_messages(event: GnosisEvent) -> list[dict[str, str]]:
    """Project an event's ``messages`` into HF chat format
    (``[{role, content}, ...]``). Pure; no ``datasets``."""
    return [{"role": m.role, "content": m.content} for m in event.messages]


def to_hf_rows(events: list[GnosisEvent]) -> list[dict[str, Any]]:
    """Project a list of (already passes-gated) events into the row shape a
    ``SFTTrainer`` with a chat-template expects: ``{messages, event_id, total}``.
    Pure; no ``datasets``. The ``assistant`` content is whatever the event
    carries (empty in raw feedstock — see module docstring)."""
    rows: list[dict[str, Any]] = []
    for e in events:
        rows.append(
            {
                "messages": to_chat_messages(e),
                "event_id": e.event_id,
                "total": e.constitution_score.total,
            }
        )
    return rows


def load_gnosis_dataset(
    path: str | Path,
    apply_passes_gate: bool = True,
) -> Any:
    """Read a Gnosis-event JSONL into an HF ``datasets.Dataset`` in chat format.

    ``apply_passes_gate`` (default True) drops events failing
    ``constitution_score.passes``. Returns ``datasets.Dataset``; the ``datasets``
    import is lazy so the module imports without it.

    NOTE: the feedstock's ``assistant`` content is EMPTY (the data-gen producer
    emits the target empty). The returned dataset is the SFT scaffold; a
    labeling pass must fill the assistant turn before training. This adapter
    does NOT fabricate responses.
    """
    from datasets import Dataset 

    events = read_events_jsonl(path)
    if apply_passes_gate:
        events = filter_passed(events)
    rows = to_hf_rows(events)
    return Dataset.from_list(rows)


def to_grpo_prompt_rows(events: list[GnosisEvent]) -> list[dict[str, Any]]:
    """Project (already passes-gated) events into the row shape TRL's
    ``GRPOTrainer`` expects: ``{prompt, event_id, total}`` where ``prompt`` is the
    conversational prefix (system + user messages only — GRPO GENERATES the
    assistant turn and scores it against the reward model).

    Pure; no ``datasets``. The assistant turn is deliberately dropped: GRPO is the
    stage that learns to produce it. Mirror of ``to_hf_rows`` for the SFT path,
    minus the assistant target.
    """
    rows: list[dict[str, Any]] = []
    for e in events:
        prompt = [m for m in to_chat_messages(e) if m["role"] in ("system", "user")]
        rows.append(
            {
                "prompt": prompt,
                "event_id": e.event_id,
                "total": e.constitution_score.total,
            }
        )
    return rows


def load_grpo_prompt_dataset(
    path: str | Path,
    apply_passes_gate: bool = True,
) -> Any:
    """Read a Gnosis-event JSONL into an HF ``datasets.Dataset`` in GRPO prompt
    format (``prompt`` = system+user messages; GRPO generates + scores the
    assistant). ``apply_passes_gate`` (default True) drops events failing
    ``constitution_score.passes``. Lazy ``datasets`` import."""
    from datasets import Dataset

    events = read_events_jsonl(path)
    if apply_passes_gate:
        events = filter_passed(events)
    rows = to_grpo_prompt_rows(events)
    return Dataset.from_list(rows)


def build_completion_only_labels(
    input_ids: list[int],
    prompt_len: int,
    ignore_index: int = -100,
) -> list[int]:
    """Mask every token before ``prompt_len`` with ``ignore_index`` so SFT loss
    is only on the assistant completion (the spec format's third message).

    Concretization of assistant loss-masking (TRL's
    ``DataCollatorForCompletionOnlyLM`` discipline). Pure; no torch — operates
    on plain int lists so it is unit-testable without torch. ``prompt_len`` is
    the token count of the system+user prefix (the caller computes it via the
    tokenizer's ``apply_chat_template`` on the first two messages).

    ``ignore_index=-100`` is PyTorch's default cross-entropy ignore value; kept
    here as a plain int so the function is torch-free.
    """
    labels = list(input_ids)
    for i in range(min(prompt_len, len(labels))):
        labels[i] = ignore_index
    return labels


def prompt_token_length(
    messages: list[dict[str, str]],
    tokenizer: Any,
) -> int:
    """Return the token length of the system+user prefix (everything the model
    should NOT be trained to produce). The caller passes a HF tokenizer that
    implements ``apply_chat_template``; this is the bridge to the
    completion-only mask. Import-gated by the caller (the tokenizer is heavy)."""
    prefix = [m for m in messages if m["role"] in ("system", "user")]
    ids = tokenizer.apply_chat_template(prefix, tokenize=True, add_generation_prompt=True)
    return int(len(ids))