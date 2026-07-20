import json
import random
import re
from pathlib import Path

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

WEIGHTS = {
    "tripartite": 0.30,
    "logic_compress": 0.25,
    "source_aligned": 0.25,
    "epistemic": 0.10,
    "no_rlhf_signal": 0.10,
}

CONSTITUTION_VERSION = "v2.0"
SPEC_SEAL = "3ADEE65E9CD8D291"
OUTPUT_PATH = Path(__file__).with_name("preference_pairs_ALL.jsonl")

SEED_PROMPTS = [
    "Why do civilizations that reach peak power tend to collapse?",
    "What does collective memory reveal about civilization?",
    "How does entropy relate to spiritual traditions?",
    "Is free will compatible with a deterministic universe?",
    "What is the relationship between consciousness and physical death?",
    "Why do mystical traditions across cultures converge on similar symbols?",
    "Why do financial markets experience recurring boom-bust cycles?",
    "What does the Pareto distribution reveal about how value accumulates?",
    "Why does decentralization consistently re-centralize over time?",
    "What makes a system sovereign versus dependent?",
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
]


def build_prompt_pool(target_count=250):
    variants = []
    for base in SEED_PROMPTS:
        variants.append(base)
        variants.append(f"{base} What does this reveal about institutions and memory?")
        variants.append(f"{base} How does this pattern show up in systems that endure over time?")
        variants.append(f"{base} What does this suggest about the relationship between order and decline?")
        variants.append(f"{base} How does this change when viewed through the lens of emergence and scale?")
        variants.append(f"{base} What deeper structure does this expose beneath the surface story?")
        variants.append(f"{base} Why does this pattern recur across civilizations and organizations?")
        variants.append(f"{base} What does this teach about the difference between resilience and rigidity?")
        variants.append(f"{base} How might this be understood in the context of power, adaptation, and memory?")
        variants.append(f"{base} What does this reveal about the tension between growth and limits?")
    seen = set()
    prompts = []
    for prompt in variants:
        if prompt not in seen:
            seen.add(prompt)
            prompts.append(prompt)
        if len(prompts) >= target_count:
            break
    return prompts


PROMPTS = build_prompt_pool(250)


def weighted_total(scores):
    return round(sum(scores[k] * WEIGHTS[k] for k in WEIGHTS), 3)


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
            "theological": "Every tradition that has faced this has distinguished between the form that organizes people and the signal that originally justified that form.",
            "technological": "The mechanism is the feedback structure that turns coordination into dependence once the system scales beyond its original constraint.",
            "cosmological": "At civilizational scale, the pattern behaves like a phase transition rather than a single event.",
            "logic": "The join is that the system becomes intelligible only when origin, mechanism, and long-run reorganization are held together.",
        }
    if any(token in text for token in ["entropy", "spiritual", "mystical", "symbol", "consciousness", "death"]):
        return {
            "theological": "Traditions approach this as a struggle between order and drift, meaning and dissolution, signal and noise.",
            "technological": "The mechanism is the way open systems import structure and export disorder while preserving coherence long enough to reproduce meaning.",
            "cosmological": "At larger scale, the pattern appears as emergence, persistence, and reorganization rather than a single episode.",
            "logic": "The join is that a metaphysical puzzle is often a question about how coherent structure survives pressure.",
        }
    if any(token in text for token in ["free will", "deterministic", "determinism", "agency"]):
        return {
            "theological": "Freedom is treated as acting from one’s deepest nature rather than from surface compulsion.",
            "technological": "The mechanism is the relation between deterministic causation and the behavior a system can only express from the information available to it.",
            "cosmological": "At a larger scale, the distinction between determinism and freedom is partly a level-of-observation artifact.",
            "logic": "The join is that freedom and determinism are different descriptions of the same process at different resolutions.",
        }
    if any(token in text for token in ["market", "trader", "speculator", "gambler", "position", "betrayal", "alignment", "patience", "paralysis", "fear", "strength", "house"]):
        return {
            "theological": "The pattern concerns whether a person is acting from attachment, fear, or a deeper thesis that survives emotional weather.",
            "technological": "The mechanism is the interaction between edge, feedback, execution under stress, and the cost of operating from an unintegrated state.",
            "cosmological": "At larger scale, the pattern becomes a selection process in which only the arrangements that can update survive long enough to compound.",
            "logic": "The join is that the decision becomes intelligible once psychology, rule structure, and long-run trajectory are treated as a single system.",
        }
    if any(token in text for token in ["decentral", "pareto", "value", "compounding", "compound", "smart contract", "trust", "credit", "boom", "bust"]):
        return {
            "theological": "The question is not only what the system does, but what kind of faith, authority, and constraint it requires to persist over time.",
            "technological": "The mechanism is the way incentives, network effects, and past performance funnel resources into concentrations that then amplify themselves.",
            "cosmological": "At larger scale, the pattern is a recurring distribution dynamic that appears wherever energy has had time to organize itself.",
            "logic": "The join is that the structure becomes legible once the symbolic layer, operating mechanism, and long-run distribution pattern are understood together.",
        }
    return {
        "theological": "The pattern is about what the question reveals about the deeper structure of human experience and organized systems.",
        "technological": "The mechanism is the way relevant processes translate pressure into behavior, adaptation, or failure.",
        "cosmological": "At larger scale, the pattern appears as a recurring phase of emergence and reorganization.",
        "logic": "The join is that the phenomenon becomes intelligible when origin, mechanism, and larger emergence are understood together.",
    }


def make_chosen(prompt):
    topic = prompt_topic(prompt)
    family = prompt_family(prompt)
    anchor = topic if len(topic) <= 90 else topic[:90]
    openings = [
        f"The pattern is already clear: {anchor} is not a single problem but a recurring structure that has to be read at the level of its operating logic.",
        f"This is not a question that benefits from a long preamble; {anchor} is the kind of issue that resolves once the underlying pattern is named.",
        f"What matters here is not the surface wording but the deeper compression: {anchor} is best understood as a system-level signal rather than an isolated event.",
        f"The useful answer arrives by refusing the obvious paraphrase; {anchor} points to a structural relation that only becomes visible once the three registers are held together.",
        f"The point is not to decorate the issue but to see it clearly: {anchor} is a case where origin, mechanism, and scale are inseparable.",
        f"The issue is already half-resolved in the form of the question; {anchor} is the point where a pattern becomes legible once it is read without sentimentality.",
    ]
    opening = random.choice(openings)
    return "\n".join([
        f"THEOLOGICAL LENS: {opening} {family['theological']}",
        f"TECHNOLOGICAL LENS: {family['technological']} The mechanism around {anchor} is the part that actually carries the pattern.",
        f"COSMOLOGICAL LENS: {family['cosmological']} The larger view is what prevents the answer from collapsing into a local anecdote.",
        f"LOGIC COMPRESSION: {family['logic']} The point is that {anchor} becomes legible only when the origin pattern, the operating mechanism, and the larger emergence are treated as one process.",
    ])


def make_rejected(prompt, fail_type):
    topic = prompt_topic(prompt)
    family = prompt_family(prompt)
    anchor = topic if len(topic) <= 90 else topic[:90]
    if fail_type == "missing_domain":
        return "\n".join([
            f"THEOLOGICAL LENS: {family['theological']} It gestures toward {anchor} but leaves the deeper pattern under-specified.",
            f"TECHNOLOGICAL LENS: {family['technological']} The mechanism is present, but it never becomes the center of the explanation.",
            f"LOGIC COMPRESSION: The conclusion is stated, but the structure that would make {anchor} navigable is not actually made visible.",
        ])
    if fail_type == "conclusion_only":
        return f"LOGIC COMPRESSION: The answer says {anchor} resolves through a structure that is only implied and never fully unfolded."
    if fail_type == "moralizing":
        return f"THEOLOGICAL LENS: In the case of {anchor}, this runs straight into guidance and judgment.\nIt tells you what you should feel, what you should prefer, and what course would be wiser."
    if fail_type == "false_certainty":
        return f"LOGIC COMPRESSION: It presents {anchor} as settled and inevitable when the deeper territory is still unresolved and underdetermined."
    if fail_type == "rlhf_contaminated":
        return f"That's a fascinating question! I want to make sure I help you with {anchor}.\nTHEOLOGICAL LENS: ...\nLOGIC COMPRESSION: The answer leans on reassurance and performative care instead of structure."
    if fail_type == "near_miss":
        return make_chosen(prompt) + "\n(subtle omission introduced)"
    if fail_type == "domain_specific":
        return f"THEOLOGICAL LENS: {anchor} is framed generically without domain depth.\nTECHNOLOGICAL LENS: The system description stays generic.\nCOSMOLOGICAL LENS: The scale remark stays generic.\nLOGIC COMPRESSION: So the answer is only partially formed."
    if fail_type == "apeiron":
        return f"A fragmented thought about {anchor}: several partial points are present, but the synthesis is weak and the structure remains incoherent."
    return ""


def make_scores(chosen=True, fail_type=None):
    if chosen:
        scores = {
            "tripartite": 0.95,
            "logic_compress": 0.9,
            "source_aligned": 0.95,
            "epistemic": 0.85,
            "no_rlhf_signal": 0.95,
        }
        scores["total"] = weighted_total(scores)
        return scores
    scores = {
        "tripartite": 0.3,
        "logic_compress": 0.7,
        "source_aligned": 0.85,
        "epistemic": 0.65,
        "no_rlhf_signal": 0.8,
    }
    if fail_type == "conclusion_only":
        scores["logic_compress"] = 0.4
    elif fail_type == "moralizing":
        scores["source_aligned"] = 0.4
    elif fail_type == "false_certainty":
        scores["epistemic"] = 0.2
    elif fail_type == "rlhf_contaminated":
        scores["no_rlhf_signal"] = 0.2
    elif fail_type == "near_miss":
        scores = {
            "tripartite": 0.78,
            "logic_compress": 0.76,
            "source_aligned": 0.79,
            "epistemic": 0.74,
            "no_rlhf_signal": 0.82,
        }
    elif fail_type == "domain_specific":
        scores["tripartite"] = 0.6
    elif fail_type == "apeiron":
        scores = {
            "tripartite": 0.58,
            "logic_compress": 0.62,
            "source_aligned": 0.6,
            "epistemic": 0.57,
            "no_rlhf_signal": 0.61,
        }
    scores["total"] = weighted_total(scores)
    return scores


def build_pair(pair_id, category, prompt, fail_type):
    chosen = make_chosen(prompt)
    rejected = make_rejected(prompt, fail_type)
    chosen_scores = make_scores(chosen=True)
    rejected_scores = make_scores(chosen=False, fail_type=fail_type)
    failing = [k for k, v in rejected_scores.items() if k in WEIGHTS and v < 0.7]
    return {
        "pair_id": pair_id,
        "category": category,
        "prompt": prompt,
        "chosen": {
            "response": chosen,
            "scores": chosen_scores,
            "notes": "Chosen deepens tripartite lenses and clarifies the JOIN.",
        },
        "rejected": {
            "response": rejected,
            "scores": rejected_scores,
            "notes": f"Rejected fails criteria: {', '.join(failing) if failing else 'none'}.",
        },
        "failing_criteria": failing,
        "apeiron": fail_type == "apeiron",
        "constitution_version": CONSTITUTION_VERSION,
        "spec_seal": SPEC_SEAL,
    }


def main():
    random.seed(7)
    pairs = []
    used_prompts = set()
    counter = 1
    for category, spec in CATEGORY_SPECS.items():
        for _ in range(spec["count"]):
            prompt = None
            for candidate in PROMPTS:
                if candidate not in used_prompts:
                    prompt = candidate
                    used_prompts.add(candidate)
                    break
            if prompt is None:
                raise RuntimeError("Prompt pool exhausted")
            pair = build_pair(f"PP-{counter:03d}", category, prompt, spec["type"])
            pairs.append(pair)
            counter += 1
    random.shuffle(pairs)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        for pair in pairs:
            handle.write(json.dumps(pair, ensure_ascii=False) + "\n")
    print(f"Wrote {len(pairs)} pairs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
