"""
Flag Extractor v3 — Domain-Aware Semiotic Flag Disambiguation

P4 Enhancement: Narrative Purpose Detection
------------------------------------------
Eliminates false positives from narrative context by distinguishing:
  - CONSTitutive: The historical event IS the subject (Sinsign-Index-Dicent, Class 2)
  - ILLUSTRATIVE: The historical event is USED AS AN EXAMPLE of a general principle
                  (Legisign-Index-Dicent, Class 5)

Example:
  "Napoleon won at Austerlitz in 1805" → CONSTitutive → Class 2 (Sinsign)
  "Austerlitz 1805 demonstrates the principle of concentration of force" → ILLUSTRATIVE → Class 5 (Legisign)

The v2/v3.0 extractor treated any temporal anchor ("1805", "Austerlitz") as favoring
Sinsign. P4 adds NARRATIVE PURPOSE detection: when a historical reference is framed
as demonstrating, illustrating, or exemplifying a general rule, the primary mode
becomes Legisign even with strong temporal anchors.

Key insight (Peirce): A sign is about EITHER a specific occurrence (Sinsign) OR a
general type (Legisign). When a narrative uses a specific event as an EXAMPLE of a
general principle, the sign is ABOUT the principle (Legisign), not the event (Sinsign).
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# Domain-aware keyword dictionaries
# ---------------------------------------------------------------------------

# Sinsign (single occurrence) indicators — specific events, moments, tokens
SINSIGN_STRONG = [
    "in 1805", "in 1859", "in 1905", "in 1914", "in 1945", "in 1969",
    "the battle of", "the treaty of", "the discovery of", "the invention of",
    "on that day", "at that moment", "in that instant", "suddenly",
    "this single", "this event", "this token", "this actual",
    "the day when", "the moment when", "the time when",
]

SINSIGN_WEAK = [
    "this", "that", "single", "token", "event", "occurrence", "instance",
    "actual", "concrete", "particular", "specific", "individual",
    "moment", "instant", "flash", "breakthrough", "suddenly",
    "recognized", "saw", "seen", "vision", "witnessed",
]

# Legisign (general type) indicators — universal, general, law-like
LEGISIGN_STRONG = [
    "general rule", "universal law", "for all", "in all cases", "necessarily",
    "always true", "by definition", "as a type", "as a category",
    "the principle that", "the law states", "the rule applies",
    "for every", "in general", "universally", "invariably",
]

LEGISIGN_WEAK = [
    "rule", "law", "principle", "structure", "system", "pattern",
    "type", "category", "general", "universal", "always", "necessarily",
    "regularity", "norm", "standard", "formula", "equation",
]

# Qualisign (pure quality) indicators
QUALISIGN_STRONG = [
    "pure feeling", "immediate quality", "sensation of", "redness",
    "raw feel", "qualia", "phenomenal quality",
]

QUALISIGN_WEAK = [
    "quality", "feel", "sensation", "pure", "immediate", "redness",
    "color", "sound", "taste", "texture", "pain", "joy", "beauty",
]

# Causality (Index) vs Reason (Argument) disambiguation
# Causal "because" — historical, physical, empirical causation
CAUSAL_BECAUSE_CONTEXTS = [
    "caused by", "led to", "resulted in", "because of", "due to",
    "the cause was", "the effect was", "followed from", "arose from",
    "stemmed from", "originated in", "triggered by", "produced by",
]

# Inferential "because" — logical, mathematical, deductive reasoning
INFERENTIAL_BECAUSE_CONTEXTS = [
    "therefore", "it follows that", "consequently", "as a result",
    "the conclusion is", "proof that", "theorem states", "we deduce",
    "logical consequence", "entails that", "implies that",
    "since p, therefore q", "if p then q", "given that",
]

# Convention (Symbol) — arbitrary, linguistic, cultural
CONVENTION_STRONG = [
    "symbol of", "word for", "language of", "conventionally called",
    "arbitrary sign", "named", "called", "referred to as",
    "cultural symbol", "linguistic sign", "nominal",
]

CONVENTION_WEAK = [
    "symbol", "word", "language", "name", "called", "convention",
    "agreement", "custom", "tradition", "doctrine", "dogma",
]

# Fact (Dicent) — empirical, observed, asserted
FACT_STRONG = [
    "the fact that", "it is true that", "state of affairs",
    "actually occurred", "was observed", "was measured",
    "empirically confirmed", "experiment showed",
]

FACT_WEAK = [
    "fact", "true", "is", "was", "actually", "really", "indeed",
    "certainly", "definitely", "assertion", "proposition",
    "observed", "measured", "detected", "found",
]

# Possibility (Rheme)
POSSIBILITY_STRONG = [
    "pure possibility", "may be", "might be", "could potentially",
    "what if", "imagine", "conceivable", "possible world",
]

POSSIBILITY_WEAK = [
    "possible", "could", "might", "may", "potential", "perhaps",
    "maybe", "would", "hypothetical", "speculative",
]


# ---------------------------------------------------------------------------
# P4 — Narrative Purpose Detection (NEW)
# ---------------------------------------------------------------------------

# ILLUSTRATIVE framing: historical event is used as an example of a general principle
ILLUSTRATIVE_FRAMING_STRONG = [
    "demonstrates that", "demonstrates the", "demonstrates how",
    "illustrates the principle", "illustrates that", "illustrates how",
    "exemplifies the", "exemplifies how", "is an exemplar of",
    "shows that", "shows how", "shows the principle",
    "proves that", "proves the", "proves how",
    "confirms that", "confirms the principle",
    "is an example of", "is a case of", "is an instance of",
    "is a token of the type", "is a token of the rule",
    "the lesson of", "the lesson from", "the lesson is",
    "we learn from", "from this we see", "from this we learn",
    "this teaches us that", "this teaches us the",
    "the principle demonstrated by", "the principle illustrated by",
    "the rule demonstrated by", "the rule illustrated by",
    "generalizes to", "applies to all", "general principle", "universal principle",
    "for all such cases", "in all similar cases", "extends to all",
    "the general pattern", "the universal pattern", "the type exemplified by",
]

ILLUSTRATIVE_FRAMING_WEAK = [
    "demonstrates", "illustrates", "exemplifies", "shows", "proves", "confirms",
    "example of", "case of", "instance of", "lesson from", "lesson of",
    "principle", "rule", "law", "pattern", "type", "generalizes",
    "applies", "extends", "universal", "general",
]

# CONSTitutive framing: the historical event IS the subject being described
CONSTITUTIVE_FRAMING_STRONG = [
    "at the battle of", "during the battle of", "at the treaty of",
    "during the", "at the", "on the day of", "on the day when",
    "the event at", "the battle at", "the moment at",
    "occurred at", "happened at", "took place at", "was fought at",
    "was signed at", "was discovered at", "was invented at",
    "the day of the", "the moment of the", "the time of the",
    "in that moment", "at that moment", "at that instant", "suddenly at",
    "this happened", "this occurred", "this took place", "this event",
    "the specific event", "the particular event", "the actual event",
    "the historical event", "the single event", "the token event",
    "in the experiment", "in that experiment", "in the test", "in that test",
    "in the discovery", "in that discovery", "in the invention", "in that invention",
    "in the 1887", "in the 1805", "in the 1815", "in the 1905",
    "in the battle", "in the war", "in the conflict", "in the campaign",
]

CONSTITUTIVE_FRAMING_WEAK = [
    "at", "during", "the event", "the battle", "the treaty",
    "occurred", "happened", "took place", "was fought", "was signed",
    "the day", "the moment", "the time",
    "specific", "particular", "actual", "historical", "single", "token",
]

# Meta-discourse markers: when the text is ABOUT a general topic using examples
META_DISCOURSE_STRONG = [
    "the general strategy of", "the general principle of", "the general rule of",
    "the universal strategy", "the universal principle", "the universal rule",
    "strategy in general", "principles in general", "rules in general",
    "military strategy", "general strategy", "strategic principle",
    "theoretical framework", "theoretical model", "conceptual framework",
    "in strategic terms", "in theoretical terms", "in general terms",
    "from a strategic perspective", "from a theoretical perspective",
    "the abstract principle", "the abstract rule", "the abstract type",
]

META_DISCOURSE_WEAK = [
    "strategy", "principle", "rule", "theory", "model", "framework",
    "abstract", "general", "universal", "conceptual", "theoretical",
    "perspective", "terms", "approach", "method", "methodology",
]


def _score_framing(text_lower: str, strong: List[str], weak: List[str]) -> int:
    """Score how strongly a framing pattern is present in the text."""
    score = 0
    for s in strong:
        if s in text_lower:
            score += 3
    for w in weak:
        if w in text_lower:
            score += 1
    return score


def _detect_narrative_purpose(text_lower: str) -> Tuple[str, int, int, int, Dict[str, any]]:
    """
    Detect the narrative purpose: is the text ABOUT a specific event,
    USING an event as an example, or ABOUT a general principle?

    Returns:
        purpose: "constitutive" | "illustrative" | "general" | "ambiguous"
        illustrative_score: strength of illustrative framing
        constitutive_score: strength of constitutive framing
        meta_score: strength of meta-discourse (general topic markers)
        detail: dict with component scores for debugging
    """
    illustrative_score = _score_framing(text_lower, ILLUSTRATIVE_FRAMING_STRONG, ILLUSTRATIVE_FRAMING_WEAK)
    constitutive_score = _score_framing(text_lower, CONSTITUTIVE_FRAMING_STRONG, CONSTITUTIVE_FRAMING_WEAK)
    meta_score = _score_framing(text_lower, META_DISCOURSE_STRONG, META_DISCOURSE_WEAK)

    # -----------------------------------------------------------------------
    # Boost illustrative score if there's explicit "example" grammar
    # Pattern: "[Event] [verb] [general noun]" where verb is demonstrate/illustrate/show
    # -----------------------------------------------------------------------
    example_grammar = re.search(
        r'\b([a-z]\w+\s+\d{4}|the\s+battle\s+of\s+\w+|the\s+treaty\s+of\s+\w+|'
        r'the\s+\w+\s+of\s+[a-z]\w+)\s+'
        r'(demonstrates|illustrates|exemplifies|shows|proves|confirms|teaches)\s+'
        r'(the|that|how|why|a|an)\b',
        text_lower
    )
    if example_grammar:
        illustrative_score += 5  # Very strong indicator

    # Boost constitutive score if there's event-internal description
    # Pattern: "at [Event], [specific action happened]"
    event_internal = re.search(
        r'\b(at|during|on|in)\s+(the\s+)?(battle|treaty|day|moment|event|experiment|test|discovery|invention|war|campaign)\s+'
        r'(of|when|where|,)?\s+\w+.*?(was|occurred|happened|took|fought|signed|discovered|rotated|observed|measured)',
        text_lower
    )
    if event_internal:
        constitutive_score += 4

    # Boost meta score for general topic with "of" phrase
    meta_grammar = re.search(
        r'\b(the\s+)?(general|universal|abstract|theoretical|strategic)\s+'
        r'(principle|rule|law|strategy|pattern|type|framework|model)\s+of\b',
        text_lower
    )
    if meta_grammar:
        meta_score += 4

    # -----------------------------------------------------------------------
    # P4: General discourse detection — texts without historical events
    # that are clearly about general principles (theorems, laws, rules)
    # BUT: skip if there are strong illustrative markers (event used as example)
    # -----------------------------------------------------------------------
    has_temporal_anchor = bool(re.search(
        r'\b(in\s+\d{3,4}|on\s+\w+\s+\d{1,2}|the\s+battle\s+of|the\s+treaty\s+of|'
        r'the\s+discovery\s+of|the\s+invention\s+of|the\s+experiment\s+of|'
        r'[a-z]\w+\s+\d{4}|\d{4}\s+experiment|\d{4}\s+battle|\d{4}\s+treaty)\b',
        text_lower
    ))
    has_named_event = bool(re.search(
        r'\b(the\s+\w+\s+of\s+[a-z]\w+|at\s+[a-z]\w+|in\s+[a-z]\w+\s+\d{4})\b',
        text_lower
    ))
    has_strong_legisign = bool(re.search(
        r'\b(for all|for every|in all cases|always|necessarily|universally|'
        r'by definition|in general|as a type|as a rule|as a law|as a principle|'
        r'theorem states|general principle|universal principle|universal law|'
        r'the general rule|the general principle|the universal rule)\b',
        text_lower
    ))

    # No temporal anchors + strong legisign + no illustrative markers = general discourse
    if not has_temporal_anchor and has_strong_legisign and illustrative_score < 5:
        return "general", illustrative_score, constitutive_score, meta_score, {
            "illustrative": illustrative_score,
            "constitutive": constitutive_score,
            "meta": meta_score,
            "has_temporal_anchor": has_temporal_anchor,
            "has_strong_legisign": has_strong_legisign,
        }

    # Determine purpose
    # Illustrative + meta strongly favors Legisign (general principle with example)
    if illustrative_score >= 5 and (illustrative_score > constitutive_score or meta_score >= 3):
        purpose = "illustrative"
    elif constitutive_score >= 5 and constitutive_score > illustrative_score + 2:
        purpose = "constitutive"
    elif meta_score >= 5 and illustrative_score >= 3:
        purpose = "illustrative"  # General topic using examples
    elif meta_score >= 5 and constitutive_score < 3:
        purpose = "general"
    elif illustrative_score > constitutive_score + 2:
        purpose = "illustrative"
    elif constitutive_score > illustrative_score + 2:
        purpose = "constitutive"
    else:
        purpose = "ambiguous"

    return purpose, illustrative_score, constitutive_score, meta_score, {
        "illustrative": illustrative_score,
        "constitutive": constitutive_score,
        "meta": meta_score,
        "has_temporal_anchor": has_temporal_anchor,
        "has_named_event": has_named_event,
        "has_strong_legisign": has_strong_legisign,
    }


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

def _score_mode(text_lower: str, strong: List[str], weak: List[str]) -> int:
    """Score how strongly a mode is indicated in the text."""
    score = 0
    for s in strong:
        if s in text_lower:
            score += 3
    for w in weak:
        if w in text_lower:
            score += 1
    return score


def _detect_primary_mode(text_lower: str) -> Tuple[str, int, int, int, str, Dict]:
    """
    Detect the primary ontological mode of the narrative.
    P4: Now incorporates narrative purpose to distinguish illustrative from constitutive.

    Returns:
        (mode, sinsign_score, legisign_score, qualisign_score, purpose, detail)
    """
    sinsign_score = _score_mode(text_lower, SINSIGN_STRONG, SINSIGN_WEAK)
    legisign_score = _score_mode(text_lower, LEGISIGN_STRONG, LEGISIGN_WEAK)
    qualisign_score = _score_mode(text_lower, QUALISIGN_STRONG, QUALISIGN_WEAK)

    # Detect narrative purpose (P4)
    purpose, ill_score, const_score, meta_score, purpose_detail = _detect_narrative_purpose(text_lower)

    # Temporal anchors heavily favor Sinsign — BUT ONLY if constitutive or ambiguous
    temporal_pattern = re.search(
        r'\b(in\s+\d{3,4}|on\s+\w+\s+\d{1,2}|the\s+battle\s+of|the\s+treaty\s+of|'
        r'the\s+discovery\s+of|the\s+invention\s+of)\b',
        text_lower
    )
    if temporal_pattern:
        if purpose == "illustrative":
            # P4: In illustrative narratives, temporal anchors are JUST EXAMPLES
            # Don't boost Sinsign; the sign is about the principle, not the event
            sinsign_score += 1  # Minimal token acknowledgment
            legisign_score += 3  # Boost Legisign because the principle is the subject
        elif purpose == "constitutive":
            sinsign_score += 4  # Strong boost for constitutive temporal anchors
        else:  # ambiguous or general
            sinsign_score += 3  # Default temporal boost

    # Named proper events — same logic as temporal anchors
    named_event_pattern = re.search(
        r'\b(the\s+\w+\s+of\s+[A-Z]\w+|at\s+[A-Z]\w+|in\s+[A-Z]\w+\s+\d{4})\b',
        text_lower
    )
    if named_event_pattern:
        if purpose == "illustrative":
            sinsign_score += 1  # Minimal token
            legisign_score += 2  # Boost principle
        elif purpose == "constitutive":
            sinsign_score += 3
        else:
            sinsign_score += 2

    # Gnosis recognition moments very strongly favor Sinsign
    gnosis_moment_markers = [
        "in that moment", "that moment", "suddenly", "single flash",
        "this single", "this moment", "in that instant", "occurred during",
        "at the moment of", "the moment when", "the instant",
    ]
    gnosis_moment_count = sum(1 for m in gnosis_moment_markers if m in text_lower)
    if gnosis_moment_count >= 1:
        if purpose != "illustrative":  # Gnosis moments are always constitutive
            sinsign_score += 4 + gnosis_moment_count
        if any(w in text_lower for w in ["structure", "pattern", "system"]):
            legisign_score = max(0, legisign_score - 2)

    # Universal quantifiers heavily favor Legisign
    if re.search(r'\b(for all|for every|in all cases|always|necessarily|universally)\b', text_lower):
        legisign_score += 4
        if purpose == "illustrative":
            legisign_score += 2  # Extra boost: universal + illustrative = definitely Legisign

    # Explicit generalization language
    if re.search(r'\b(as a (type|rule|law|principle)|in general|the general)\b', text_lower):
        legisign_score += 3

    # Mathematical/logical theorem language strongly favors Legisign + suppress Sinsign
    math_theorem_markers = [
        "theorem states", "if a set", "then it is", "for all such",
        "by logical necessity", "holds for all", "given that", "implies that",
    ]
    math_theorem_count = sum(1 for m in math_theorem_markers if m in text_lower)
    if math_theorem_count >= 2:
        legisign_score += 5
        sinsign_score = max(0, sinsign_score - 3)

    # P4: Meta-discourse (general topic) strongly favors Legisign
    if meta_score >= 5:
        legisign_score += 3
        if purpose == "illustrative":
            legisign_score += 2  # General topic + illustrative example = strong Legisign

    # P4: Illustrative purpose override
    # If the narrative is clearly illustrative, force Legisign unless VERY strong constitutive markers
    if purpose == "illustrative" and ill_score >= 7 and const_score < 5:
        # Strong override: this is a general principle using an example
        legisign_score = max(legisign_score, sinsign_score + 4)

    # P4: Constitutive purpose override
    if purpose == "constitutive" and const_score >= 7 and ill_score < 3:
        sinsign_score = max(sinsign_score, legisign_score + 3)

    # Determine primary mode
    if sinsign_score > legisign_score + 2 and sinsign_score > qualisign_score:
        mode = "sinsign"
    elif legisign_score > sinsign_score + 2 and legisign_score > qualisign_score:
        mode = "legisign"
    elif qualisign_score > sinsign_score and qualisign_score > legisign_score:
        mode = "qualisign"
    else:
        scores = [("sinsign", sinsign_score), ("legisign", legisign_score), ("qualisign", qualisign_score)]
        scores.sort(key=lambda x: -x[1])
        mode = scores[0][0]

    detail = {
        "purpose": purpose,
        "purpose_scores": purpose_detail,
        "mode_scores": {
            "sinsign": sinsign_score,
            "legisign": legisign_score,
            "qualisign": qualisign_score,
        },
    }
    return mode, sinsign_score, legisign_score, qualisign_score, purpose, detail


def _is_causal_because(text_lower: str, position: int) -> bool:
    """Determine if 'because' at position is causal (Index) or inferential (Argument)."""
    start = max(0, position - 30)
    end = min(len(text_lower), position + 40)
    context = text_lower[start:end]

    inferential_markers = [
        "therefore", "conclusion", "proof", "theorem", "deduce", "infer",
        "logical", "consequence", "entails", "implies", "follows that",
    ]
    for marker in inferential_markers:
        if marker in context:
            return False

    causal_markers = ["caused", "led to", "resulted", "due to", "because of", "triggered", "produced"]
    for marker in causal_markers:
        if marker in context:
            return True

    temporal_markers = ["in 1", "in 2", "the battle", "the war", "the event", "occurred", "happened"]
    for marker in temporal_markers:
        if marker in text_lower[:100] or marker in text_lower[-100:]:
            return True

    return True


def _is_law_as_rule(
    text_lower: str,
    sinsign_score: int = 0,
    legisign_score: int = 0,
    purpose: str = "ambiguous",
) -> bool:
    """
    Determine if 'law'/'rule'/'structure'/'pattern' refers to a general type (Legisign)
    or is just descriptive in a specific event context.
    P4: Now considers narrative purpose.
    """
    # Strong Legisign contexts
    legisign_contexts = [
        "the law states", "the rule applies", "general law", "universal rule",
        "the principle that", "as a type", "as a category", "in all cases",
        "for every", "necessarily", "by definition", "invariably",
        "for all", "always true", "as a general",
    ]
    for ctx in legisign_contexts:
        if ctx in text_lower:
            return True

    # P4: In illustrative narratives, "rule" and "principle" are almost always Legisign
    # because the narrative is explicitly ABOUT a general principle
    if purpose == "illustrative" and any(w in text_lower for w in ["rule", "principle", "law", "pattern"]):
        return True

    # Strong Sinsign contexts
    sinsign_contexts = [
        "in that moment", "that moment", "suddenly", "this single",
        "this event", "occurred", "happened", "took place", "was observed",
        "at the time", "in that instant", "this actual",
    ]
    sinsign_match_count = sum(1 for ctx in sinsign_contexts if ctx in text_lower)

    if sinsign_match_count >= 2 and legisign_score <= 2:
        return False

    if re.search(r'\b(in\s+\d{3,4}|on\s+\w+\s+\d{1,2})\b', text_lower) and legisign_score < 5:
        return False

    descriptive_contexts = [
        "saw the structure", "saw the pattern", "observed the structure",
        "observed the pattern", "perceived the structure", "perceived the pattern",
        "revealed itself", "revealed the structure", "revealed the pattern",
        "structure of the system", "pattern of the", "structure suddenly",
        "pattern suddenly", "structure of this", "pattern of this",
    ]
    for ctx in descriptive_contexts:
        if ctx in text_lower:
            return False

    if sinsign_score > legisign_score + 2:
        return False

    if legisign_score >= 3:
        return True

    return False if sinsign_score > legisign_score else True


# ---------------------------------------------------------------------------
# Main API: clean_and_extract_flags
# ---------------------------------------------------------------------------

def clean_and_extract_flags(
    narrative: str,
    why: str = "",
    compressed: str = "",
    existing_flags: Optional[Dict[str, bool]] = None,
) -> Dict[str, bool]:
    """
    Extract or clean semiotic flags using domain-aware disambiguation.
    P4: Now includes narrative purpose detection to eliminate false positives
    from narrative context (e.g., historical events used as illustrations).
    """
    text = (narrative + " " + why + " " + compressed).lower()

    if existing_flags is None:
        flags = _extract_flags_from_text(text)
    else:
        flags = dict(existing_flags)

    primary_mode, sinsign_score, legisign_score, qualisign_score, purpose, detail = _detect_primary_mode(text)

    # -----------------------------------------------------------------------
    # Mode-aware flag cleaning
    # -----------------------------------------------------------------------

    if primary_mode == "sinsign":
        if flags.get("rule_based") and not _is_law_as_rule(text, sinsign_score, legisign_score, purpose):
            flags["rule_based"] = False

        if flags.get("convention"):
            convention_score = _score_mode(text, CONVENTION_STRONG, CONVENTION_WEAK)
            if convention_score < 2:
                flags["convention"] = False

        if flags.get("reason"):
            inferential_score = _score_mode(text, INFERENTIAL_BECAUSE_CONTEXTS, ["therefore", "conclusion", "proof", "theorem", "deduce"])
            causal_score = _score_mode(text, CAUSAL_BECAUSE_CONTEXTS, ["caused", "led to", "resulted", "due to"])
            if causal_score > inferential_score:
                flags["reason"] = False

        if not flags.get("single_occurrence"):
            flags["single_occurrence"] = True

    elif primary_mode == "legisign":
        if flags.get("single_occurrence"):
            token_markers = ["instance of", "example of", "token of", "this particular", "single case"]
            if not any(m in text for m in token_markers):
                flags["single_occurrence"] = False

        if not flags.get("rule_based"):
            flags["rule_based"] = True

    elif primary_mode == "qualisign":
        flags["rule_based"] = False
        flags["causality"] = False
        flags["fact"] = False
        flags["reason"] = False
        flags["convention"] = False
        if not flags.get("similarity"):
            flags["similarity"] = True
        if not flags.get("possibility"):
            flags["possibility"] = True

    # Dicent vs Argument
    if flags.get("reason") and flags.get("fact"):
        inferential_score = _score_mode(text, INFERENTIAL_BECAUSE_CONTEXTS, ["therefore", "conclusion", "proof", "theorem", "deduce", "logical"])
        factual_score = _score_mode(text, FACT_STRONG, FACT_WEAK)

        if inferential_score > factual_score + 1:
            flags["fact"] = False
        elif factual_score > inferential_score + 1:
            flags["reason"] = False

    # Rheme vs Dicent
    if flags.get("possibility") and flags.get("fact"):
        possibility_score = _score_mode(text, POSSIBILITY_STRONG, POSSIBILITY_WEAK)
        factual_score = _score_mode(text, FACT_STRONG, FACT_WEAK)

        if possibility_score > factual_score + 1:
            flags["fact"] = False
        elif factual_score > possibility_score + 1:
            flags["possibility"] = False

    # Minimum viable flags
    if not any([flags.get("possibility"), flags.get("fact"), flags.get("reason")]):
        flags["fact"] = True

    if not any([flags.get("similarity"), flags.get("causality"), flags.get("convention")]):
        flags["causality"] = True

    return flags


def _extract_flags_from_text(text_lower: str) -> Dict[str, bool]:
    """Base flag extraction (same as v2 but with contextual disambiguation)."""
    flags = {
        "single_occurrence": False,
        "rule_based": False,
        "similarity": False,
        "causality": False,
        "convention": False,
        "possibility": False,
        "fact": False,
        "reason": False,
    }

    is_math_context = any(m in text_lower for m in [
        "theorem", "proof", "logical necessity", "deduce", "implies", "entails",
        "if a set", "then it is", "for all such", "consequently", "therefore"
    ])

    # Vehicle
    if any(kw in text_lower for kw in [
        "recognized", "recognition", "saw", "seen", "vision",
        "suddenly", "moment", "instant", "breakthrough", "flash",
        "this moment", "this recognition", "in that moment", "single", "token", "event", "occurrence"
    ]):
        flags["single_occurrence"] = True

    if any(kw in text_lower for kw in [
        "rule", "law", "principle", "structure", "system", "pattern",
        "always", "universal", "general", "type", "category"
    ]):
        flags["rule_based"] = True

    # Object
    causal_keywords = ["caused", "causal", "led to", "resulted in",
                       "trace", "sign", "symptom", "evidence", "indicated",
                       "pointer", "pointed", "directed", "followed from"]
    if not is_math_context:
        causal_keywords.append("because")
    if any(kw in text_lower for kw in causal_keywords):
        flags["causality"] = True

    if is_math_context and "because" in text_lower:
        flags["reason"] = True

    if any(kw in text_lower for kw in [
        "like", "similar", "resemblance", "image", "likeness",
        "mirror", "reflection", "parallel", "analogous"
    ]):
        flags["similarity"] = True

    if any(kw in text_lower for kw in [
        "word", "language", "name", "called", "symbol",
        "convention", "agreement", "custom", "tradition",
        "law", "constitution", "doctrine", "dogma"
    ]):
        flags["convention"] = True

    # Interpretant
    if any(kw in text_lower for kw in [
        "possible", "could", "might", "may", "potential",
        "what if", "imagine", "conceive", "conceivable",
        "possibility", "maybe", "perhaps", "would"
    ]):
        flags["possibility"] = True

    if any(kw in text_lower for kw in [
        "fact", "true", "truth", "is", "was", "actually",
        "really", "indeed", "certainly", "definitely",
        "assertion", "proposition", "state of affairs"
    ]):
        flags["fact"] = True

    if any(kw in text_lower for kw in [
        "therefore", "thus", "conclude", "conclusion", "argument",
        "proof", "reason", "since", "inference",
        "theorem", "deduction", "logical", "consequence"
    ]):
        flags["reason"] = True

    return flags


# ---------------------------------------------------------------------------
# Class-2-specific cleaning utility
# ---------------------------------------------------------------------------

def is_class2_candidate(flags: Dict[str, bool]) -> bool:
    """Check if an event is a candidate for Class 2 (Sinsign-Index-Dicent)."""
    return (
        flags.get("single_occurrence", False) and
        flags.get("causality", False) and
        flags.get("fact", False)
    )


def analyze_class2_ambiguity(flags: Dict[str, bool]) -> Dict[str, any]:
    """Analyze why a Class 2 candidate might be ambiguous in the pipeline."""
    conflicts = []

    if flags.get("rule_based"):
        conflicts.append({
            "flag": "rule_based",
            "problem": "Pushes vehicle to Legisign → Class 5/7/42 instead of Class 2",
            "resolution": "Suppress if narrative is about specific occurrence, not general law"
        })

    if flags.get("convention"):
        conflicts.append({
            "flag": "convention",
            "problem": "Pushes object to Symbol → Class 7/42 instead of Class 2",
            "resolution": "Suppress if narrative uses natural causation, not arbitrary convention"
        })

    if flags.get("reason"):
        conflicts.append({
            "flag": "reason",
            "problem": "Pushes interpretant to Argument → Class 42 instead of Class 2",
            "resolution": "Suppress if 'because' is causal, not inferential"
        })

    if flags.get("possibility"):
        conflicts.append({
            "flag": "possibility",
            "problem": "Pushes interpretant to Rheme → Class 0/1/3 instead of Class 2",
            "resolution": "Suppress if narrative is factual, not hypothetical"
        })

    if flags.get("similarity"):
        conflicts.append({
            "flag": "similarity",
            "problem": "Pushes object to Icon → Class 3/4/6 instead of Class 2",
            "resolution": "Suppress if relation is causal, not resemblance"
        })

    return {
        "is_candidate": is_class2_candidate(flags),
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
        "clean_profile": {
            "single_occurrence": True,
            "causality": True,
            "fact": True,
            "rule_based": False,
            "convention": False,
            "reason": False,
            "possibility": False,
            "similarity": False,
        }
    }


# ---------------------------------------------------------------------------
# P4 — Diagnostic API
# ---------------------------------------------------------------------------

def diagnose_flags(
    narrative: str,
    why: str = "",
    compressed: str = "",
) -> Dict[str, any]:
    """
    P4 diagnostic: full analysis of how flags were extracted and why.
    Returns primary mode, narrative purpose, scores, and resolved flags.
    """
    text = (narrative + " " + why + " " + compressed).lower()
    base_flags = _extract_flags_from_text(text)
    cleaned_flags = clean_and_extract_flags(narrative, why, compressed)
    primary_mode, sinsign_score, legisign_score, qualisign_score, purpose, detail = _detect_primary_mode(text)

    vehicle = "Legisign" if cleaned_flags.get("rule_based") else ("Sinsign" if cleaned_flags.get("single_occurrence") else "Qualisign")
    obj = "Symbol" if cleaned_flags.get("convention") else ("Index" if cleaned_flags.get("causality") else "Icon")
    interpretant = "Argument" if cleaned_flags.get("reason") else ("Dicent" if cleaned_flags.get("fact") else "Rheme")

    path_map = {
        ("Qualisign", "Icon", "Rheme"): 0,
        ("Sinsign", "Index", "Rheme"): 1,
        ("Sinsign", "Index", "Dicent"): 2,
        ("Legisign", "Icon", "Rheme"): 3,
        ("Legisign", "Index", "Rheme"): 4,
        ("Legisign", "Index", "Dicent"): 5,
        ("Legisign", "Symbol", "Rheme"): 6,
        ("Legisign", "Symbol", "Dicent"): 7,
        ("Legisign", "Index", "Argument"): 8,
        ("Sinsign", "Icon", "Dicent"): 9,
        ("Legisign", "Symbol", "Argument"): 42,
    }

    return {
        "narrative_purpose": purpose,
        "purpose_detail": detail["purpose_scores"],
        "mode_scores": detail["mode_scores"],
        "primary_mode": primary_mode,
        "base_flags": {k: v for k, v in base_flags.items() if v},
        "cleaned_flags": {k: v for k, v in cleaned_flags.items() if v},
        "triad_path": f"{vehicle}-{obj}-{interpretant}",
        "predicted_class": path_map.get((vehicle, obj, interpretant), "unknown"),
        "class2_analysis": analyze_class2_ambiguity(cleaned_flags),
    }


# ---------------------------------------------------------------------------
# CLI / test harness
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json
    import sys

    test_cases = [
        {
            "name": "P4: Constitutive — Austerlitz as specific event (Class 2)",
            "narrative": "Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive because the French army outmaneuvered the Austro-Russian forces, leading to a crushing victory that ended the Third Coalition.",
            "expected_class": 2,
            "expected_purpose": "constitutive",
        },
        {
            "name": "P4: Illustrative — Austerlitz as example of general principle (Class 5)",
            "narrative": "Austerlitz 1805 demonstrates the principle of concentration of force: the successful deployment of superior combat power at the decisive point consistently produces victory across all theaters of war.",
            "expected_class": 5,
            "expected_purpose": "illustrative",
        },
        {
            "name": "P4: General principle (Class 5)",
            "narrative": "The principle of concentration of force states that for all military engagements, success requires the assembly of superior combat power at the decisive point. This rule applies universally across all theaters of war.",
            "expected_class": 5,
            "expected_purpose": "general",
        },
        {
            "name": "P4: Illustrative with meta-discourse (Class 5)",
            "narrative": "From a strategic perspective, the Battle of Austerlitz 1805 proves the universal rule that interior lines of operation enable the commander to defeat a numerically superior force by concentrating against isolated fractions of the enemy army in succession.",
            "expected_class": 5,
            "expected_purpose": "illustrative",
        },
        {
            "name": "Specific experiment (Class 2)",
            "narrative": "In the 1887 Michelson-Morley experiment, the interferometer was rotated to detect the aether wind, but no fringe shift was observed because the speed of light is invariant in all inertial frames.",
            "expected_class": 2,
            "expected_purpose": "constitutive",
        },
        {
            "name": "Logical theorem (Class 8)",
            "narrative": "The theorem states that if a set is closed and bounded, then it is compact. This follows because every open cover has a finite subcover, and therefore by logical necessity the property holds for all such sets.",
            "expected_class": 8,
            "expected_purpose": "general",
        },
        {
            "name": "Gnosis recognition (Class 2)",
            "narrative": "In that moment of recognition, I saw the structure of the system because the pattern suddenly revealed itself. This single flash of insight occurred during the meditation session.",
            "expected_class": 2,
            "expected_purpose": "constitutive",
        },
        {
            "name": "P4: Waterloo as historical example (Class 5)",
            "narrative": "Waterloo 1815 illustrates the general principle that overextension of supply lines inevitably leads to strategic defeat, a rule confirmed by countless campaigns throughout military history.",
            "expected_class": 5,
            "expected_purpose": "illustrative",
        },
        {
            "name": "P4: Waterloo as specific event (Class 2)",
            "narrative": "At Waterloo in 1815, Wellington held his ground because the Prussian army arrived at the critical moment and tipped the balance, producing a decisive victory for the Allied coalition.",
            "expected_class": 2,
            "expected_purpose": "constitutive",
        },
    ]

    print("=" * 80)
    print("FLAG EXTRACTOR V3 — P4 Narrative Purpose Detection Test")
    print("=" * 80)

    all_pass = True
    for tc in test_cases:
        diag = diagnose_flags(tc["narrative"])
        predicted = diag["predicted_class"]
        purpose = diag["narrative_purpose"]

        purpose_match = "✓" if purpose == tc["expected_purpose"] else "✗"
        class_match = "PASS" if predicted == tc["expected_class"] else "FAIL"

        if class_match == "FAIL" or purpose_match == "✗":
            all_pass = False

        print(f"\n{tc['name']}")
        print(f"  Purpose: {purpose} {purpose_match} (expected: {tc['expected_purpose']})")
        print(f"  Detail: {json.dumps(diag['purpose_detail'], indent=2)}")
        print(f"  Mode scores: {json.dumps(diag['mode_scores'], indent=2)}")
        print(f"  Primary mode: {diag['primary_mode']}")
        print(f"  Base flags: {diag['base_flags']}")
        print(f"  Cleaned flags: {diag['cleaned_flags']}")
        print(f"  Triad: {diag['triad_path']}")
        print(f"  Expected: Class {tc['expected_class']} | Predicted: Class {predicted} → {class_match}")

    print(f"\n{'=' * 80}")
    print(f"Overall: {'ALL PASS' if all_pass else 'SOME FAILURES'}")
    print("=" * 80)
