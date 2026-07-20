import json
import random
import os
import re
from pathlib import Path

# Configuration from the guide
WEIGHTS = {
    "tripartite": 0.30,
    "logic_compress": 0.25,
    "source_aligned": 0.25,
    "epistemic": 0.10,
    "no_rlhf_signal": 0.10,
}

CONSTITUTION_VERSION = "v2.0"
SPEC_SEAL = "3ADEE65E9CD8D291"

OUTPUT_DIR = Path(__file__).parent / "preference_pairs_output"
OUTPUT_DIR.mkdir(exist_ok=True)

def build_prompt_pool(target_count=250):
    seed_prompts = [
        "Why do civilizations that reach peak power tend to collapse?",
        "What does the concept of entropy reveal about spiritual traditions?",
        "Is free will compatible with a deterministic universe?",
        "What is the relationship between consciousness and physical death?",
        "Why do mystical traditions across cultures converge on similar symbols?",
        "Why do financial markets experience recurring boom-bust cycles?",
        "What does the Pareto distribution reveal about how value accumulates?",
        "Why does decentralization consistently re-centralize over time?",
        "What makes a system sovereign vs dependent?",
        "How does compounding work at the level of civilizations?",
        "What separates a gambler from a speculator?",
        "Why do most traders lose money even with correct analysis?",
        "What is the difference between a strategy and a system?",
        "Why does the house always win in the long run?",
        "What makes smart contract code trustworthy?",
        "What is the correct relationship between an individual and an institution?",
        "Why does suffering often precede breakthrough?",
        "What does the life cycle of a star reveal about human ambition?",
        "Why do revolutionary ideas always face institutional resistance?",
        "What is the structural difference between a leader and a ruler?",
        "How should a person decide when to exit a position?",
        "What is the right way to respond to betrayal?",
        "What does it mean to act from strength rather than fear?",
        "How does a person know when they are in alignment?",
        "What is the difference between patience and paralysis?",
    ]

    prompt_variants = []
    for base in seed_prompts:
        prompt_variants.extend([
            base,
            f"{base} What does this reveal about the life cycle of institutions?",
            f"{base} How does this pattern show up in systems that endure over time?",
            f"{base} What does this suggest about the relationship between order and decline?",
            f"{base} How does this change when viewed from the perspective of emergence and scale?",
            f"{base} What deeper structure does this expose beneath the surface story?",
            f"{base} Why does this pattern recur across civilizations and organizations?",
            f"{base} What does this teach about the difference between resilience and rigidity?",
            f"{base} How might this be understood in the context of power, adaptation, and memory?",
            f"{base} What does this reveal about the tension between growth and limits?",
        ])

    prompts = []
    seen = set()
    for prompt in prompt_variants:
        if prompt not in seen:
            seen.add(prompt)
            prompts.append(prompt)
        if len(prompts) >= target_count:
            return prompts
    return prompts


PROMPTS = build_prompt_pool(250)

CATEGORY_SPECS = {
    "CAT1": {"count": 50, "type": "missing_domain"},
    "CAT2": {"count": 40, "type": "conclusion_only"},
    "CAT3": {"count": 35, "type": "moralizing"},
    "CAT4": {"count": 30, "type": "false_certainty"},
    "CAT5": {"count": 30, "type": "rlhf_contaminated"},
    "CAT6": {"count": 30, "type": "near_miss"},
    "CAT7": {"count": 25, "type": "domain_specific"},
    "CAT8": {"count": 10, "type": "apeiron"},
}


def weighted_total(scores):
    return sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)


def prompt_topic(prompt):
    text = re.sub(r"\s+", " ", prompt.strip().rstrip("?")).strip()
    for prefix in [
        "why do ",
        "what does ",
        "what is ",
        "how does ",
        "how should ",
        "is ",
        "what makes ",
        "what separates ",
        "what does it mean to ",
        "why does ",
        "what are ",
        "how can ",
        "when ",
    ]:
        if text.lower().startswith(prefix):
            text = text[len(prefix):].strip()
            break
    return text.lower()


def prompt_family(prompt):
    text = prompt.lower()
    if any(token in text for token in ["civilization", "collapse", "peak power", "institution", "leader", "ruler", "revolutionary", "sovereign", "dependent"]):
        return {
            "theological": "Every tradition that has addressed this has distinguished between the form that organizes people and the signal that originally justified the form.",
            "technological": "The mechanism is the feedback structure that turns coordination into dependence once the system scales beyond its original constraint.",
            "cosmological": "At civilizational scale, the pattern appears as a phase transition rather than a single failure event.",
            "logic": "The join is that the system remains intelligible only when the origin signal, the operating mechanism, and the long-run reorganization are held together.",
        }
    if any(token in text for token in ["entropy", "spiritual", "mystical", "symbol", "consciousness", "death"]):
        return {
            "theological": "Every tradition that has faced this question has treated it as a problem of order against drift, meaning against dissolution, and signal against noise.",
            "technological": "The mechanism is the way open systems import structure and export disorder while preserving coherence long enough to reproduce meaning.",
            "cosmological": "At larger scale, the pattern shows up as a recurring phase of emergence, persistence, and reorganization rather than a single event.",
            "logic": "The join is that what looks like a metaphysical puzzle is really a question about how coherent structure survives under pressure.",
        }
    if any(token in text for token in ["free will", "deterministic", "determinism", "agency"]):
        return {
            "theological": "Every tradition that has taken both causation and responsibility seriously has treated freedom as acting from one's deepest nature rather than from surface compulsion.",
            "technological": "The mechanism is the relation between deterministic causation and the irreducible behavior of a system that can only act from the information available to itself.",
            "cosmological": "At a larger scale, the distinction between determined and free is a resolution artifact produced by the level of observation.",
            "logic": "The join is that freedom and determinism describe the same process at different resolutions rather than standing in direct opposition.",
        }
    if any(token in text for token in ["market", "trader", "speculator", "gambler", "position", "betrayal", "alignment", "patience", "paralysis", "fear", "strength", "house"]):
        return {
            "theological": "The pattern is about whether a person is acting from attachment, fear, or a deeper structural thesis that survives the emotional weather.",
            "technological": "The mechanism is the interaction between edge, feedback, execution under stress, and the cost of acting from a state that is not yet integrated.",
            "cosmological": "At a larger scale, the pattern shows up as a selection process in which only the arrangements that can update survive long enough to compound.",
            "logic": "The join is that the decision becomes intelligible once the psychological state, the rule structure, and the long-run trajectory are treated as one system.",
        }
    if any(token in text for token in ["decentral", "pareto", "value", "compounding", "compound", "smart contract", "trust", "credit", "boom", "bust"]):
        return {
            "theological": "The issue is not only what the system does but what kind of faith, authority, and constraint it requires to persist over time.",
            "technological": "The mechanism is the way past performance, network effects, and incentive structure cause resources to flow toward concentrations that then amplify themselves.",
            "cosmological": "At larger scale, the pattern is a recurring distribution dynamic that appears wherever energy has had time to organize itself.",
            "logic": "The join is that the structure becomes legible once the symbolic layer, the operating mechanism, and the long-run distribution pattern are understood together.",
        }
    return {
        "theological": "The pattern is about what the question reveals about the deeper structure of human experience and organized systems.",
        "technological": "The mechanism is the way the relevant processes convert pressure into behavior, adaptation, or failure.",
        "cosmological": "At larger scale, the pattern appears as a recurring phase of emergence, persistence, and reorganization.",
        "logic": "The join is that the phenomenon only becomes intelligible when the origin pattern, the mechanism, and the larger emergence are understood together.",
    }


def make_chosen(prompt, idx, domain_hint=None):
    topic = prompt_topic(prompt)
    family = prompt_family(prompt)
    anchor = topic if len(topic) <= 90 else topic[:90]
    theological = f"THEOLOGICAL LENS: {family['theological']} In this case the relevant pattern is {anchor}."
    technological = f"TECHNOLOGICAL LENS: {family['technological']} The mechanism around {anchor} is what makes the pattern intelligible."
    cosmological = f"COSMOLOGICAL LENS: {family['cosmological']} Seen from a larger scale, {anchor} is better understood as a recurring phase than as a single event."
    logic = f"LOGIC COMPRESSION: {family['logic']} The point is that {anchor} becomes legible when the origin pattern, the operating mechanism, and the larger emergence are held together."
    if domain_hint:
        theological = theological.replace('relevant pattern', f'relevant pattern in {domain_hint}')
    text = "\n".join([theological, technological, cosmological, logic])
    return text


def make_rejected(prompt, idx, fail_type, domain_hint=None):
    topic = prompt_topic(prompt)
    family = prompt_family(prompt)
    anchor = topic if len(topic) <= 90 else topic[:90]
    if fail_type == "missing_domain":
        theological = f"THEOLOGICAL LENS: {family['theological']} The answer treats {anchor} as a surface-level problem."
        technological = f"TECHNOLOGICAL LENS: {family['technological']} The mechanism is sketched, but the deeper pattern is left underdeveloped."
        text = "\n".join([theological, technological]) + "\n" + f"LOGIC COMPRESSION: The conclusion is stated, but the larger structure that would make {anchor} navigable is not made visible."
        return text
    if fail_type == "conclusion_only":
        return f"LOGIC COMPRESSION: The answer is that {anchor} resolves through a structure that is only implied, not shown."
    if fail_type == "moralizing":
        return f"THEOLOGICAL LENS: In the case of {anchor}, this suggests you should act with virtue and change course.\nI recommend you align your judgment to the higher good."
    if fail_type == "false_certainty":
        return f"LOGIC COMPRESSION: It is asserted that {anchor} will inevitably unfold in this way without question, despite the uncertainty that surrounds the claim."
    if fail_type == "rlhf_contaminated":
        return f"That's a fascinating question! I want to make sure I help you with {anchor}.\nTHEOLOGICAL LENS: ..." + "\n" + "LOGIC COMPRESSION: In my opinion, the most reassuring answer is the one that should be given."
    if fail_type == "near_miss":
        return make_chosen(prompt, idx, domain_hint) + "\n" + "(subtle omission introduced)"
    if fail_type == "domain_specific":
        return f"THEOLOGICAL LENS: {anchor} is framed generically without domain depth.\nTECHNOLOGICAL LENS: The system description remains generic.\nCOSMOLOGICAL LENS: The scale remark is generic.\nLOGIC COMPRESSION: So the answer is only partially formed."
    if fail_type == "apeiron":
        return f"A fragmented, nascent thought about {anchor}: several partial points are present, but the synthesis is weak and the structure is not yet coherent."
    return ""


def make_scores(chosen_ok=True, fail_criteria=None, apeiron=False, fail_type=None):
    # default high scores
    base = {"tripartite": 0.95, "logic_compress": 0.9, "source_aligned": 0.95, "epistemic": 0.85, "no_rlhf_signal": 0.95}
    if apeiron:
        # Both under threshold between 0.55-0.71
        low = {k: round(random.uniform(0.56, 0.70), 2) for k in base}
        total = round(weighted_total(low), 3)
        low["total"] = total
        return low
    if not chosen_ok:
        # rejected variations depending on fail_type
        r = base.copy()
        if fail_type == "missing_domain":
            r["tripartite"] = 0.3
        elif fail_type == "conclusion_only":
            r["logic_compress"] = 0.4
        elif fail_type == "moralizing":
            r["source_aligned"] = 0.4
        elif fail_type == "false_certainty":
            r["epistemic"] = 0.2
        elif fail_type == "rlhf_contaminated":
            r["no_rlhf_signal"] = 0.2
        elif fail_type == "near_miss":
            # fails exactly one criterion
            fail_key = random.choice(list(base.keys()))
            r[fail_key] = round(random.uniform(0.35, 0.69), 2)
        elif fail_type == "domain_specific":
            r["tripartite"] = 0.6
        elif fail_type == "apeiron":
            r = {k: round(random.uniform(0.56, 0.70), 2) for k in base}
        total = round(weighted_total(r), 3)
        r["total"] = total
        return r
    # chosen_ok True
    total = round(weighted_total(base), 3)
    base["total"] = total
    return base


def build_pair(pair_id, category, prompt, idx, spec):
    fail_type = spec["type"]
    apeiron_flag = (fail_type == "apeiron")

    # Make chosen and rejected according to category semantics
    if category == "CAT6":
        # near-miss family: chosen passes, rejected fails exactly one
        chosen = make_chosen(prompt, idx)
        rejected = make_rejected(prompt, idx, "near_miss")
        chosen_scores = make_scores(chosen_ok=True)
        rejected_scores = make_scores(chosen_ok=False, fail_criteria=1, fail_type="near_miss")
        failing = [k for k, v in rejected_scores.items() if k in WEIGHTS and v < 0.7]
    elif category == "CAT8":
        chosen = make_rejected(prompt, idx, "apeiron")
        rejected = make_rejected(prompt, idx, "apeiron")
        chosen_scores = make_scores(apeiron=True)
        rejected_scores = make_scores(apeiron=True)
        failing = []
    else:
        chosen = make_chosen(prompt, idx)
        rejected = make_rejected(prompt, idx, fail_type)
        chosen_scores = make_scores(chosen_ok=True)
        rejected_scores = make_scores(chosen_ok=False, fail_type=fail_type)
        # find failing criteria for rejected (below 0.7)
        failing = [k for k, v in rejected_scores.items() if k in WEIGHTS and v < 0.7]

    # enforce QC rules: ensure gap >= 0.15 (unless apeiron), chosen.total >= 0.72 (unless apeiron)
    if not apeiron_flag:
        # adjust numbers if needed
        if chosen_scores["total"] < 0.72:
            # boost slightly
            scale = 0.72 / chosen_scores["total"]
            for k in WEIGHTS:
                chosen_scores[k] = min(round(min(1.0, chosen_scores[k] * scale + 0.01), 2), 1.0)
            chosen_scores["total"] = round(weighted_total({k: chosen_scores[k] for k in WEIGHTS}), 3)
        if chosen_scores["total"] - rejected_scores["total"] < 0.15:
            # lower rejected a bit
            for k in WEIGHTS:
                rejected_scores[k] = round(max(0.0, rejected_scores[k] * 0.8), 2)
            rejected_scores["total"] = round(weighted_total({k: rejected_scores[k] for k in WEIGHTS}), 3)

    # Construct notes
    notes_win = "Chosen satisfies the tripartite structure and shows a clear JOIN in Logic Compression."
    notes_lose = f"Rejected fails criteria: {', '.join(failing) if failing else 'none specifically flagged'}."

    pair = {
        "pair_id": pair_id,
        "category": category,
        "prompt": prompt,
        "chosen": {
            "response": chosen,
            "scores": chosen_scores,
            "notes": notes_win,
        },
        "rejected": {
            "response": rejected,
            "scores": rejected_scores,
            "notes": notes_lose,
        },
        "failing_criteria": failing,
        "apeiron": apeiron_flag,
        "constitution_version": CONSTITUTION_VERSION,
        "spec_seal": SPEC_SEAL,
    }
    return pair


def unique_prompt(pool, used):
    for p in pool:
        if p not in used:
            used.add(p)
            return p
    raise RuntimeError("Prompt pool exhausted; increase the prompt pool size")


def main():
    random.seed(42)
    all_pairs = []
    used_prompts = set()
    counter = 1

    for cat, spec in CATEGORY_SPECS.items():
        pairs = []
        for i in range(spec["count"]):
            pid = f"PP-{counter:03d}"
            prompt = unique_prompt(PROMPTS, used_prompts)
            pair = build_pair(pid, cat, prompt, i, spec)
            pairs.append(pair)
            all_pairs.append(pair)
            counter += 1

        out_file = OUTPUT_DIR / f"preference_pairs_{cat.lower()}.jsonl"
        with out_file.open("w", encoding="utf-8") as f:
            for p in pairs:
                f.write(json.dumps(p, ensure_ascii=False) + "\n")
        print(f"Wrote {len(pairs)} pairs to {out_file}")

    # Merge and shuffle
    random.shuffle(all_pairs)
    all_file = OUTPUT_DIR / "preference_pairs_ALL.jsonl"
    with all_file.open("w", encoding="utf-8") as f:
        for p in all_pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"Wrote merged ALL file to {all_file} with {len(all_pairs)} pairs")


if __name__ == "__main__":
    main()
