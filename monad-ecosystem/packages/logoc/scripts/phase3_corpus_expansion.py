#!/usr/bin/env python3
"""
Phase 3: Corpus expansion for under-represented Peirce classes.
Creates synthetic LOGOC events for missing classes (0, 1, 3, 4, 6)
using existing gnosis content reframed as possibilities/feelings/qualities.
"""
import json
import os
import uuid
from datetime import datetime, timezone

# Output paths
WORKSPACE = "C:/Users/crisc/OneDrive - Southern Careers Institute/My Drive/The_Sovereign"
OUTPUT_PATH = os.path.join(WORKSPACE, "logs/corpus/phase3_synthetic_events.jsonl")
CORPUS_MASTER = os.path.join(WORKSPACE, "logs/corpus/master_corpus_v5.2.jsonl")
CORPUS_GNOSIS = os.path.join(WORKSPACE, "logs/gnosis_corpus_v5.2.jsonl")


def make_event(event_id, narrative, flags, source_file, event_num, title, confidence=0.85):
    """Build a LOGOC v5.2 event with Peirce block pre-computed."""
    # Determine path from flags
    vehicle = "LEGISIGN" if flags.get("rule_based") else ("SINSIGN" if flags.get("single_occurrence") else "QUALISIGN")
    obj = "SYMBOL" if flags.get("convention") else ("INDEX" if flags.get("causality") else "ICON")
    # RHEME requires fact=false and reason=false; DICENT requires fact=true; ARGUMENT requires reason=true
    if flags.get("reason"):
        interpretant = "ARGUMENT"
    elif flags.get("fact"):
        interpretant = "DICENT"
    else:
        interpretant = "RHEME"
    
    path = [vehicle, obj, interpretant]
    
    # Map to class ID via known lookup
    path_to_id = {
        ("QUALISIGN", "ICON", "RHEME"): 0,
        ("SINSIGN", "ICON", "RHEME"): 1,
        ("SINSIGN", "INDEX", "DICENT"): 2,
        ("LEGISIGN", "ICON", "RHEME"): 3,
        ("LEGISIGN", "INDEX", "RHEME"): 4,
        ("LEGISIGN", "INDEX", "DICENT"): 5,
        ("LEGISIGN", "SYMBOL", "RHEME"): 6,
        ("LEGISIGN", "SYMBOL", "DICENT"): 7,
        ("LEGISIGN", "INDEX", "ARGUMENT"): 8,
        ("SINSIGN", "ICON", "DICENT"): 9,
        ("LEGISIGN", "SYMBOL", "ARGUMENT"): 42,
    }
    class_id = path_to_id.get(tuple(path))
    if class_id is None:
        raise ValueError(f"Unknown path: {path}")
    
    # Pragmatism band
    band_map = {
        0: "INSTINCT", 1: "INSTINCT", 3: "INSTINCT",
        4: "EXPERIENCE", 2: "EXPERIENCE", 9: "EXPERIENCE",
        5: "FORMAL_THOUGHT", 6: "FORMAL_THOUGHT", 7: "FORMAL_THOUGHT", 8: "FORMAL_THOUGHT", 42: "FORMAL_THOUGHT"
    }
    band = band_map[class_id]
    
    # Weight map
    weight_map = {
        0: (1.0, 0.0, 0.0), 1: (0.7, 0.3, 0.0), 3: (0.6, 0.2, 0.2),
        4: (0.3, 0.5, 0.2), 2: (0.0, 1.0, 0.0), 9: (0.3, 0.6, 0.1),
        5: (0.1, 0.5, 0.4), 6: (0.2, 0.2, 0.6), 7: (0.1, 0.4, 0.5), 8: (0.0, 0.4, 0.6), 42: (0.1, 0.3, 0.6)
    }
    fw, sw, tw = weight_map[class_id]
    
    return {
        "schema_version": "LOGOC-Event-v5.2",
        "event_id": event_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "narrative": narrative,
        "semiotic_flags": flags,
        "peirce": {
            "mode": obj if obj != "INDEX" else "INDEX",  # simplify
            "sign_class_id": class_id,
            "sign_class_label": f"{vehicle}-{obj}-{interpretant}",
            "path": path,
            "firstness_weight": fw,
            "secondness_weight": sw,
            "thirdness_weight": tw,
            "pragmatism_band": band,
        },
        "peirce_migration_pending": False,
        "peirce_migration_source": "phase3_synthetic",
        "_gnosis_meta": {
            "source_file": source_file,
            "event_num": event_num,
            "title": title,
            "confidence": confidence,
            "synthetic": True,
        }
    }


# Synthetic events for missing classes
# Class 0: Qualisign-Icon-Rheme (pure quality, feeling, sensation, no fact, no reason)
class_0_events = [
    make_event(
        "phase3_c0_peirce_musement",
        "The feeling of Musement — a state of relaxed, playful contemplation where ideas emerge not from effort but from the quality of attention itself. It is the pure possibility of thought before it becomes argument, the sensation of mind at play in the universe's own playground.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "CHARLES PEIRCE.txt", "c0_01", "The Musement: Pure Play of Mind as Qualisign-Icon-Rheme", 0.92
    ),
    make_event(
        "phase3_c0_bruno_ecstasy",
        "The ecstatic vision of infinity — not a conclusion but a quality of consciousness, a feeling of the boundaries dissolving. The sensation of the cosmos as an unbounded luminous quality, perceived not through reasoning but through the immediate feeling of boundlessness.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Giordano Bruno (1548–1600) GNOSIS E.txt", "c0_02", "Ecstatic Infinity: Vision as Pure Qualitative Feeling", 0.88
    ),
    make_event(
        "phase3_c0_spinoza_eternity_feeling",
        "The feeling of eternity — not knowledge that the mind is eternal, but the immediate sensation of timelessness, a qualitative state where past and future dissolve into a single present quality of being. This is not a proposition but a felt mode of existence.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Baruch Spinoza (1632–1677) GNOSIS E.txt", "c0_03", "Feeling of Eternity: Immediate Qualitative Apprehension", 0.85
    ),
    make_event(
        "phase3_c0_watts_sensation",
        "The sensation of being the universe experiencing itself — not a conclusion but a quality of consciousness, the feeling of identity with the flow of all phenomena. The immediate feeling that the observer and the observed are the same continuous quality.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Alan Watts (1915–1973).txt", "c0_04", "Cosmic Sensation: Identity as Pure Qualitative Feeling", 0.87
    ),
    make_event(
        "phase3_c0_akhenaten_light",
        "The pure quality of solar light — not the fact that the sun gives life, but the immediate sensation of the Aten's rays, the feeling of warmth and radiance as a qualitative presence. The Aten as pure Firstness, a feeling-quality before it becomes symbol or law.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Akhenaten (Amenhotep IV, c. 1353–13.txt", "c0_05", "Solar Light as Pure Qualitative Feeling", 0.86
    ),
    make_event(
        "phase3_c0_peirce_tychism",
        "The sensation of pure chance — the feeling that at the ground of all necessity, there is a state of absolute spontaneity, a quality of freedom that precedes all law. The immediate feeling of the ground crumbling beneath the feet of determinism, revealing pure possibility.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "CHARLES PEIRCE.txt", "c0_06", "Tychism: Pure Chance as Qualitative Feeling", 0.90
    ),
    make_event(
        "phase3_c0_marcus_dissolution",
        "The feeling of the dissolution of self into the whole — not a reasoned conclusion but a qualitative experience of the boundaries between self and cosmos dissolving. The immediate sensation of being a drop in the ocean, a quality of continuity rather than separation.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Marcus Aurelius Antoninus Augustus.txt", "c0_07", "Self-Dissolution: Qualitative Feeling of Cosmic Continuity", 0.84
    ),
    make_event(
        "phase3_c0_gnostic_seam",
        "The feeling of the seam between opposites disappearing — not a knowledge that separation is illusory, but the immediate qualitative experience of the boundary dissolving. The sensation of the harlot and the holy one as the same felt quality.",
        {"single_occurrence": False, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "The Gnostic Jesus.txt", "c0_08", "Seam Dissolution: Qualitative Feeling of Unity", 0.83
    ),
]

# Class 1: Sinsign-Icon-Rheme (single occurrence, icon-like, no fact, no reason)
class_1_events = [
    make_event(
        "phase3_c1_peirce_musement_single",
        "This particular instance of Musement — a single moment of playful attention where this specific idea emerged from the quality of this specific attention. The token-event of mind at play, a single occurrence of the feeling of possibility.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "CHARLES PEIRCE.txt", "c1_01", "Single Musement: Token Instance of Playful Mind", 0.88
    ),
    make_event(
        "phase3_c1_akhenaten_single_ray",
        "This single ray of the Aten — a particular instance of solar light striking the face at this moment, creating this specific sensation of warmth and radiance. The token-event of light, a single occurrence of the feeling-quality.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Akhenaten (Amenhotep IV, c. 1353–13.txt", "c1_02", "Single Ray: Token Instance of Solar Feeling", 0.85
    ),
    make_event(
        "phase3_c1_bruno_single_vision",
        "This single visionary experience — a particular ecstatic moment when the crystalline spheres dissolved for Bruno, a single token-instance of the icon-like vision of boundless space. The single occurrence of the feeling of infinity.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Giordano Bruno (1548–1600) GNOSIS E.txt", "c1_03", "Single Vision: Token Ecstatic Experience", 0.86
    ),
    make_event(
        "phase3_c1_watts_single_moment",
        "This single moment of the watercourse way — a particular instance of feeling the flow of the river as identical to the flow of consciousness. The token-event of the sensation of identity between self and stream.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Alan Watts (1915–1973).txt", "c1_04", "Single Moment: Token Flow Experience", 0.84
    ),
    make_event(
        "phase3_c1_spinoza_single_feeling",
        "This single feeling of the eternal — a particular moment when the mind experienced its own eternity, not as a general truth but as this specific token-event of timelessness. The single instance of the qualitative feeling of eternity.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Baruch Spinoza (1632–1677) GNOSIS E.txt", "c1_05", "Single Eternal Feeling: Token Instance", 0.85
    ),
    make_event(
        "phase3_c1_marcus_single_drop",
        "This single drop in the ocean — a particular moment when Marcus felt the dissolution of the Emperor into the cosmos, a token-event of the feeling of cosmic continuity. The single instance of the qualitative sensation of oneness.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Marcus Aurelius Antoninus Augustus.txt", "c1_06", "Single Drop: Token Dissolution Experience", 0.82
    ),
    make_event(
        "phase3_c1_gnostic_single_touch",
        "This single touch of wood — the particular moment of splitting the wood and feeling the presence there, a token-event of the icon-like sensation of the divine in matter. The single instance of the feeling of sacred presence in the material.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "The Gnostic Jesus.txt", "c1_07", "Single Touch: Token Sacred Sensation", 0.83
    ),
    make_event(
        "phase3_c1_nietzsche_single_moment",
        "This single moment of eternal return — a particular instance of feeling the weight of all time converging on this single decision, the token-event of the feeling of cosmic repetition. The single occurrence of the qualitative sensation of infinite recurrence.",
        {"single_occurrence": True, "rule_based": False, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Friedrich Nietzsche (1844–1900) GNO.txt", "c1_08", "Single Eternal Return: Token Moment of Recurrence", 0.84
    ),
]

# Class 3: Legisign-Icon-Rheme (general type/law, icon-like, no fact, no reason)
class_3_events = [
    make_event(
        "phase3_c3_peirce_law_of_mind",
        "The law of mind as a general type — feelings and ideas have a tendency to spread as a general pattern of consciousness, a type of mental behavior that manifests in every instance of thought. The general quality of mental spreading, a legisign with icon-like resemblance across all minds.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "CHARLES PEIRCE.txt", "c3_01", "Law of Mind as Legisign-Icon-Rheme", 0.90
    ),
    make_event(
        "phase3_c3_watts_ego_type",
        "The skin-encapsulated ego as a general type of self-delusion — a habitual pattern of consciousness that appears in every instance of human identity-construction. The general type of the ego-boundary, a legisign that manifests as an icon-like mirroring of the self-world boundary.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Alan Watts (1915–1973).txt", "c3_02", "Ego-Boundary as General Type of Consciousness", 0.85
    ),
    make_event(
        "phase3_c3_spinoza_attribute_type",
        "The attribute of thought as a general type of existence — a lawful pattern of the universe that appears in every instance of mental being. The general type of thought-extension, a legisign that iconically resembles the material attribute in every particular instance.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Baruch Spinoza (1632–1677) GNOSIS E.txt", "c3_03", "Attribute of Thought as General Type", 0.86
    ),
    make_event(
        "phase3_c3_marcus_stoic_type",
        "The Stoic ruling faculty as a general type of reason — a lawful pattern of the human mind that appears in every instance of rational consciousness. The general type of the ruling power, a legisign that manifests as an icon-like resemblance of the cosmic logos in every individual.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Marcus Aurelius Antoninus Augustus.txt", "c3_04", "Ruling Faculty as General Type of Reason", 0.83
    ),
    make_event(
        "phase3_c3_gnostic_logos_type",
        "The Logos as a general type of divine presence — a lawful pattern of the divine that appears in every instance of the split wood and lifted stone. The general type of the divine in matter, a legisign that iconically resembles the Word in every particular instance of creation.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "The Gnostic Jesus.txt", "c3_05", "Logos as General Type of Divine Presence", 0.84
    ),
    make_event(
        "phase3_c3_akhenaten_aten_type",
        "The Aten as a general type of solar divinity — a lawful pattern of divine radiance that appears in every instance of light. The general type of the solar disk, a legisign that manifests as an icon-like resemblance of the sun's quality in every ray.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Akhenaten (Amenhotep IV, c. 1353–13.txt", "c3_06", "Aten as General Type of Solar Divinity", 0.82
    ),
    make_event(
        "phase3_c3_bruno_infinity_type",
        "The infinite universe as a general type of cosmic order — a lawful pattern of boundless space that appears in every instance of astronomical observation. The general type of infinity, a legisign that iconically resembles the boundless in every finite particular.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Giordano Bruno (1548–1600) GNOSIS E.txt", "c3_07", "Infinite Universe as General Type", 0.85
    ),
    make_event(
        "phase3_c3_nietzsche_amor_type",
        "Amor Fati as a general type of affirmative existence — a lawful pattern of willing the eternal recurrence that appears in every instance of genuine acceptance. The general type of love of fate, a legisign that manifests as an icon-like resemblance of cosmic affirmation in every particular moment.",
        {"single_occurrence": False, "rule_based": True, "similarity": True, "causality": False, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Friedrich Nietzsche (1844–1900) GNO.txt", "c3_08", "Amor Fati as General Type of Affirmation", 0.83
    ),
]

# Class 4: Legisign-Index-Rheme (general type, causal index, no fact, no reason)
class_4_events = [
    make_event(
        "phase3_c4_peirce_habit_type",
        "The law of habit as a general type of causal tendency — a lawful pattern of the cosmos taking on habits, where every instance of regularity is an index pointing to the general tendency of nature to form patterns. The general type of habit-formation, a legisign whose indexical relation points to the causal history of law itself.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "CHARLES PEIRCE.txt", "c4_01", "Law of Habit as Legisign-Index-Rheme", 0.87
    ),
    make_event(
        "phase3_c4_spinoza_conatus_type",
        "The conatus as a general type of causal striving — a lawful pattern of every thing's effort to persist, where every instance of existence is an index pointing to the general tendency of self-preservation. The general type of striving, a legisign whose indexical relation points to the causal power of being itself.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Baruch Spinoza (1632–1677) GNOSIS E.txt", "c4_02", "Conatus as General Type of Causal Striving", 0.85
    ),
    make_event(
        "phase3_c4_suntzu_victory_type",
        "Victory without battle as a general type of causal efficacy — a lawful pattern of military success where every instance of non-combat triumph is an index pointing to the general causal structure of strategic dominance. The general type of bloodless victory, a legisign whose indexical relation points to the causal power of positioning over force.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Sun Tzu (Sun Wu, c. 544–496 BCE) GN.txt", "c4_03", "Victory Without Battle as General Type", 0.84
    ),
    make_event(
        "phase3_c4_machiavelli_fortuna_type",
        "Fortuna as a general type of causal power — a lawful pattern of historical contingency where every instance of unexpected fortune is an index pointing to the general tendency of events to exceed human control. The general type of fortune, a legisign whose indexical relation points to the causal structure of historical unpredictability.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Niccolò Machiavelli (1469–1527) GNO.txt", "c4_04", "Fortuna as General Type of Causal Power", 0.83
    ),
    make_event(
        "phase3_c4_napoleon_space_type",
        "Space as weapon as a general type of causal geography — a lawful pattern of military defeat where every instance of Russian retreat is an index pointing to the general tendency of territory to defeat invaders. The general type of territorial defense, a legisign whose indexical relation points to the causal structure of geographic warfare.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Napoleon Bonaparte (1769–1821) GNOS.txt", "c4_05", "Space as Weapon as General Type", 0.82
    ),
    make_event(
        "phase3_c4_watts_causality_type",
        "The feeling of causality as a general type of cosmic process — a lawful pattern of the universe's flow where every instance of the watercourse way is an index pointing to the general tendency of nature to follow the path of least resistance. The general type of effortless causality, a legisign whose indexical relation points to the causal structure of natural flow.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Alan Watts (1915–1973).txt", "c4_06", "Effortless Causality as General Type", 0.81
    ),
    make_event(
        "phase3_c4_marcus_fate_type",
        "The web of fate as a general type of causal necessity — a lawful pattern of cosmic determinism where every instance of the Emperor's power is an index pointing to the general tendency of all things to follow the universal order. The general type of fated causality, a legisign whose indexical relation points to the causal structure of cosmic necessity.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "Marcus Aurelius Antoninus Augustus.txt", "c4_07", "Web of Fate as General Type of Causality", 0.80
    ),
    make_event(
        "phase3_c4_gnostic_kingdom_type",
        "The Kingdom as a general type of causal transformation — a lawful pattern of the divine presence where every instance of the split wood is an index pointing to the general tendency of the sacred to manifest in the material. The general type of incarnational causality, a legisign whose indexical relation points to the causal structure of divine presence.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": True, "convention": False, "possibility": True, "fact": False, "reason": False},
        "The Gnostic Jesus.txt", "c4_08", "Kingdom as General Type of Incarnational Causality", 0.81
    ),
]

# Class 6: Legisign-Symbol-Rheme (general type, conventional symbol, no fact, no reason)
class_6_events = [
    make_event(
        "phase3_c6_peirce_sign_type",
        "The sign as a general type of conventional meaning — a lawful pattern of representation where every instance of a sign is a symbol pointing to the general convention of signification. The general type of the sign, a legisign whose symbolic relation points to the conventional structure of meaning itself.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "CHARLES PEIRCE.txt", "c6_01", "Sign as General Type of Conventional Meaning", 0.88
    ),
    make_event(
        "phase3_c6_akhenaten_name_type",
        "The name of the Aten as a general type of conventional divinity — a lawful pattern of religious language where every instance of the divine name is a symbol pointing to the general convention of sacred naming. The general type of the Aten's name, a legisign whose symbolic relation points to the conventional structure of divine identity.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "Akhenaten (Amenhotep IV, c. 1353–13.txt", "c6_02", "Aten's Name as General Type of Sacred Naming", 0.82
    ),
    make_event(
        "phase3_c6_gnostic_word_type",
        "The Word as a general type of conventional creation — a lawful pattern of divine speech where every instance of the Logos is a symbol pointing to the general convention of creation-through-language. The general type of the Word, a legisign whose symbolic relation points to the conventional structure of divine creation.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "The Gnostic Jesus.txt", "c6_03", "Word as General Type of Conventional Creation", 0.85
    ),
    make_event(
        "phase3_c6_marcus_logos_type",
        "The logos as a general type of conventional reason — a lawful pattern of rational order where every instance of reasoned speech is a symbol pointing to the general convention of universal logic. The general type of the logos, a legisign whose symbolic relation points to the conventional structure of cosmic reason.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "Marcus Aurelius Antoninus Augustus.txt", "c6_04", "Logos as General Type of Conventional Reason", 0.83
    ),
    make_event(
        "phase3_c6_nietzsche_symbol_type",
        "The Übermensch as a general type of conventional transcendence — a lawful pattern of human aspiration where every instance of the symbol is a symbol pointing to the general convention of self-overcoming. The general type of the Übermensch, a legisign whose symbolic relation points to the conventional structure of heroic possibility.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "Friedrich Nietzsche (1844–1900) GNO.txt", "c6_05", "Übermensch as General Type of Conventional Transcendence", 0.82
    ),
    make_event(
        "phase3_c6_spinoza_god_type",
        "God as a general type of conventional substance — a lawful pattern of theological naming where every instance of the divine name is a symbol pointing to the general convention of ultimate reality. The general type of Deus sive Natura, a legisign whose symbolic relation points to the conventional structure of the divine-natural identity.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "Baruch Spinoza (1632–1677) GNOSIS E.txt", "c6_06", "God as General Type of Conventional Substance", 0.84
    ),
    make_event(
        "phase3_c6_suntzu_victory_name",
        "The name of victory as a general type of conventional military success — a lawful pattern of strategic language where every instance of the word 'victory' is a symbol pointing to the general convention of military achievement. The general type of victory-naming, a legisign whose symbolic relation points to the conventional structure of martial success.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "Sun Tzu (Sun Wu, c. 544–496 BCE) GN.txt", "c6_07", "Victory-Name as General Type of Conventional Success", 0.80
    ),
    make_event(
        "phase3_c6_machiavelli_prince_type",
        "The Prince as a general type of conventional power — a lawful pattern of political language where every instance of the prince-symbol is a symbol pointing to the general convention of sovereign authority. The general type of the prince, a legisign whose symbolic relation points to the conventional structure of political domination.",
        {"single_occurrence": False, "rule_based": True, "similarity": False, "causality": False, "convention": True, "possibility": True, "fact": False, "reason": False},
        "Niccolò Machiavelli (1469–1527) GNO.txt", "c6_08", "Prince as General Type of Conventional Power", 0.81
    ),
]

all_synthetic = class_0_events + class_1_events + class_3_events + class_4_events + class_6_events

# Validate all
class_counts = {}
for e in all_synthetic:
    cid = e["peirce"]["sign_class_id"]
    class_counts[cid] = class_counts.get(cid, 0) + 1

print(f"=== SYNTHETIC EVENTS CREATED ===")
for cid in sorted(class_counts.keys()):
    label = all_synthetic[[e["peirce"]["sign_class_id"] for e in all_synthetic].index(cid)]["peirce"]["sign_class_label"]
    print(f"  Class {cid} ({label}): {class_counts[cid]} events")

print(f"\nTotal: {len(all_synthetic)} synthetic events")

# Write to JSONL
with open(OUTPUT_PATH, "w") as f:
    for e in all_synthetic:
        f.write(json.dumps(e) + "\n")

print(f"\nSaved to {OUTPUT_PATH}")

# Append to master corpus
master_events = []
if os.path.exists(CORPUS_MASTER):
    with open(CORPUS_MASTER, "r") as f:
        for line in f:
            if line.strip():
                master_events.append(json.loads(line))

# Deduplicate by event_id
existing_ids = {e["event_id"] for e in master_events}
added = 0
for e in all_synthetic:
    if e["event_id"] not in existing_ids:
        master_events.append(e)
        added += 1

with open(CORPUS_MASTER, "w") as f:
    for e in master_events:
        f.write(json.dumps(e) + "\n")

print(f"Appended {added} new events to {CORPUS_MASTER}")
print(f"Master corpus now has {len(master_events)} events")

# Also append to gnosis corpus
gnosis_events = []
if os.path.exists(CORPUS_GNOSIS):
    with open(CORPUS_GNOSIS, "r") as f:
        for line in f:
            if line.strip():
                gnosis_events.append(json.loads(line))

existing_gnosis_ids = {e["event_id"] for e in gnosis_events}
added_gnosis = 0
for e in all_synthetic:
    if e["event_id"] not in existing_gnosis_ids:
        gnosis_events.append(e)
        added_gnosis += 1

with open(CORPUS_GNOSIS, "w") as f:
    for e in gnosis_events:
        f.write(json.dumps(e) + "\n")

print(f"Appended {added_gnosis} new events to {CORPUS_GNOSIS}")

def main(ctx):
    return {"ok": True, "synthetic_created": len(all_synthetic), "master_total": len(master_events)}
