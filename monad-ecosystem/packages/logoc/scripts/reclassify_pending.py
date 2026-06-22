
import json, os, re
from collections import Counter

WORKSPACE = "C:/Users/crisc/OneDrive - Southern Careers Institute/My Drive/The_Sovereign"

# Load spec
with open(os.path.join(WORKSPACE, "monad-ecosystem/packages/logoc/spec/peirce_sign_classes.json"), 'r') as f:
    sign_classes = json.load(f)

real_classes = {}
for sc in sign_classes:
    path = sc["path"]
    if all(p in ["Qualisign", "Sinsign", "Legisign", "Icon", "Index", "Symbol", "Rheme", "Dicent", "Argument"] for p in path):
        real_classes[sc["id"]] = sc

path_to_id = {}
for cid, sc in real_classes.items():
    path_to_id["-".join(sc["path"])] = cid

valid_paths = set(path_to_id.keys())

compat = {}
for cid, sc in real_classes.items():
    v, o, i = sc["path"]
    if v not in compat:
        compat[v] = {}
    if o not in compat[v]:
        compat[v][o] = []
    compat[v][o].append(i)

case_map = {
    "QUALISIGN": "Qualisign", "SINSIGN": "Sinsign", "LEGISIGN": "Legisign",
    "ICON": "Icon", "INDEX": "Index", "SYMBOL": "Symbol",
    "RHEME": "Rheme", "DICENT": "Dicent", "ARGUMENT": "Argument"
}

def find_valid_path(vehicle, obj, interpretant):
    vehicle = case_map.get(vehicle, vehicle)
    obj = case_map.get(obj, obj)
    interpretant = case_map.get(interpretant, interpretant)
    
    direct = "-".join([vehicle, obj, interpretant])
    if direct in valid_paths:
        return [vehicle, obj, interpretant]
    
    valid_objs = list(compat.get(vehicle, {}).keys())
    if obj not in valid_objs:
        for candidate in ["Symbol", "Index", "Icon"]:
            if candidate in valid_objs:
                obj = candidate
                break
    
    valid_ints = compat.get(vehicle, {}).get(obj, [])
    if interpretant not in valid_ints:
        for candidate in ["Rheme", "Dicent", "Argument"]:
            if candidate in valid_ints:
                interpretant = candidate
                break
    
    path = [vehicle, obj, interpretant]
    path_key = "-".join(path)
    if path_key in valid_paths:
        return path
    return None

master_path = os.path.join(WORKSPACE, "logs/corpus/master_corpus_v5.2.jsonl")

events = []
with open(master_path, 'r') as f:
    for line in f:
        if line.strip():
            events.append(json.loads(line))

pending = [e for e in events if not e.get("peirce") or e.get("peirce", {}).get("sign_class_id") is None]
print(f"Pending events to reclassify: {len(pending)}")

# Re-extract flags with improved logic for each pending event
classified = 0
still_pending = 0

for e in pending:
    narrative = e.get("narrative", "").lower()
    title = e.get("_gnosis_meta", {}).get("title", e.get("meta", {}).get("title", "")).lower()
    text = title + " " + narrative
    
    # Reset all flags
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
    
    # Gnosis detection - these are recognition events, not empirical facts
    gnosis_markers = ["recognition", "gnosis", "vision", "saw ", "seen", "realized", "realization", 
                      "understood", "transparent", "collapse", "dissolution", "rupture", "interruption",
                      "illumination", "recognized", "revelation", "now knew", "now knew that",
                      "became transparent", "what became transparent", "recognizes that"]
    gnosis_score = sum(1 for m in gnosis_markers if m in text)
    is_gnosis_recognition = gnosis_score >= 2
    
    # Conservative flag extraction
    # 1. single_occurrence: specific moment, event, childhood, sudden, unique, accidental
    single_kw = ["single", "token", "this particular", "one time", "particular instance", 
                 "unique moment", "one instance", "childhood", "sudden", "caught", "accidental",
                 "specific moment", "one morning", "the moment", "that moment", "in that instant",
                 "the day", "the night", "summer of", "winter of", "december", "february",
                 "the first", "the last time", "witnessed", "attended", "experienced"]
    flags["single_occurrence"] = any(w in text for w in single_kw)
    
    # 2. rule_based: habit, algorithm, law, system, pattern, type, structural, method, principle
    rule_kw = ["habit", "algorithm", "law of", "systematic", "structural pattern", "general type",
               "type of", "class of", "method", "principle", "structural", "pattern", "system",
               "rule", "framework", "mechanism", "technology", "reproducible", "governance"]
    flags["rule_based"] = any(w in text for w in rule_kw)
    
    # 3. similarity: resemblance, like, similar, icon, quality, feeling, sensation, analog, appearance
    sim_kw = ["resemblance", " like", "similar", "icon", "quality", "feeling", "sensation",
              "analog", "appearance", "image", "looks like", "seems like", "as if", "same as",
              "identical to", "mirror", "reflection"]
    flags["similarity"] = any(w in text for w in sim_kw)
    
    # 4. causality: cause, effect, because, result, force, determine, prediction, consequence
    cause_kw = ["cause", "effect", "because", "result", "force", "determine", "prediction",
                "predict", "consequence", "lead to", "influence", "mechanism", "produce",
                "generated", "produce", "determined", "produces", "led to", "drove"]
    flags["causality"] = any(w in text for w in cause_kw)
    
    # 5. convention: convention, symbolic, name, language, word, sign, term, label
    conv_kw = ["convention", "symbolic", "conventional", "name of", "named ", "language",
               "linguistic", "word ", "sign ", "agreement", "customary", "term ", "label ",
               "signify", "signifies", "symbol", "sign", "called ", "term"]
    flags["convention"] = any(w in text for w in conv_kw)
    
    # 6. possibility: possible, might, could, may, potential, if, hypothesis, would
    poss_kw = ["possible", "might", "could", "may", "potential", "if", "hypothesis", "would",
               "can", "perhaps", "maybe", "might be", "possibility"]
    flags["possibility"] = any(w in text for w in poss_kw)
    
    # 7. fact: ONLY for empirical, observable, demonstrable facts. NOT for "knew" in gnosis sense.
    # Very conservative: measurement, experiment, proof, evidence, demonstrated, observed
    fact_kw = ["measurement", "experiment", "proof", "evidence", "demonstrated", "observed",
               "verified", "empirical", "data", "record", "count", "survey", "test"]
    flags["fact"] = any(w in text for w in fact_kw)
    
    # 8. reason: ONLY for logical deduction, argument, conclusion, therefore, thus, hence.
    # Conservative: exclude gnosis recognition events
    reason_kw = ["therefore", "thus", "hence", "deduc", "infer", "logic", "rational",
                 "argument", "conclusion", "proposition", "proof", "demonstration"]
    flags["reason"] = any(w in text for w in reason_kw)
    
    # Override for gnosis recognition events: these are NOT facts or logical arguments
    # They are phenomenological recognitions = Qualisign or Sinsign, Icon or Index, Rheme
    if is_gnosis_recognition:
        flags["fact"] = False
        flags["reason"] = False
        # If rule_based is triggered by weak keywords but it's a recognition event, 
        # lean toward single_occurrence if it's a specific moment
        if flags["single_occurrence"] and not any(w in text for w in ["habitual", "law of mind", "algorithm", "systematic pattern"]):
            flags["rule_based"] = False
    
    # Domain-specific overrides for known cases
    title_upper = e.get("_gnosis_meta", {}).get("title", e.get("meta", {}).get("title", ""))
    
    # Spinoza's Conatus: "Every Thing Strives to Persist" - this is a general law, Legisign
    if "Conatus" in title_upper or "strives to persist" in text:
        flags["rule_based"] = True
        flags["single_occurrence"] = False
        flags["causality"] = True  # active striving/persistence
    
    # Spinoza's "Truth Outlives Its Author" - posthumous publication, a specific event but about a truth
    if "Truth Outlives" in title_upper or "posthumous" in text:
        flags["single_occurrence"] = True  # specific decision
        flags["convention"] = True  # publication, authorship conventions
        flags["rule_based"] = False
    
    # Nietzsche "I Am Dynamite" - self-recognition as historical force, Sinsign or Legisign?
    if "I Am Dynamite" in title_upper:
        flags["single_occurrence"] = True  # specific autobiographical recognition
        flags["convention"] = True  # names, historical categories
    
    # Nietzsche "Dictation of Zarathustra" - possession/inspiration, single occurrence
    if "Dictation of Zarathustra" in title_upper:
        flags["single_occurrence"] = True  # specific possession experience
        flags["convention"] = True  # prophetic language, authorship
    
    # Nietzsche "Bayreuth" - specific collapse of recognition, single occurrence
    if "Bayreuth" in title_upper:
        flags["single_occurrence"] = True  # specific 1876 event
    
    # Nietzsche "Ecce Homo" - autobiography, specific work, but also a general claim
    if "Ecce Homo" in title_upper or "Philosophy Is Autobiography" in title_upper:
        flags["single_occurrence"] = True  # specific writing act
        flags["convention"] = True  # genre of confession, autobiography
    
    # Napoleon "Austerlitz" - specific battle, tactical insight
    if "Austerlitz" in title_upper:
        flags["single_occurrence"] = True  # December 2, 1805
        flags["causality"] = True  # cognitive causality
    
    # Napoleon "Italian Campaign" - morale insight, specific campaign
    if "Italian Campaign" in title_upper or "Morale" in title_upper:
        flags["single_occurrence"] = True  # 1796 campaign
        flags["causality"] = True
    
    # Machiavelli "Blade in the Piazza" - specific event, recognition of mechanism
    if "Blade in the Piazza" in title_upper or "Cesena" in text:
        flags["single_occurrence"] = True  # December 1502
        flags["causality"] = True  # cause-effect of spectacle
        flags["convention"] = True  # semiotic instrument, message
    
    # Sun Tzu "Speed as Essence" - general strategic principle, Legisign
    if "Speed as the Essence" in title_upper or "Sun Tzu" in e.get("event_id", ""):
        flags["rule_based"] = True  # general principle from Art of War
        flags["single_occurrence"] = False
        flags["causality"] = True  # time as weapon
    
    # Marcus Aurelius "Death Did Not Feel Like Logos" - grief, specific losses
    if "Death That Did Not Feel" in title_upper:
        flags["single_occurrence"] = True  # specific child deaths
    
    # Marcus Aurelius "View from Above" - specific meditation practice
    if "View from Above" in title_upper or "Temporal Collapse" in title_upper:
        flags["single_occurrence"] = True  # specific meditative experience
    
    # Marcus Aurelius "Inner Citadel" - specific recognition
    if "Inner Citadel" in title_upper:
        flags["single_occurrence"] = True
    
    # Marcus Aurelius "People Will Not Remember" - specific meditation
    if "Will Not Remember" in title_upper or "Vanishing Point" in title_upper:
        flags["single_occurrence"] = True
    
    # Zarathustra "Radiant Self" - specific recognition at divine encounter
    if "Radiant Self" in title_upper:
        flags["single_occurrence"] = True  # specific encounter in Yasna
    
    # Akhenaten events - all specific moments of theological recognition
    if "Akhenaten" in e.get("event_id", ""):
        flags["single_occurrence"] = True  # specific moments (Year 5, etc.)
        # Most are about recognition, not convention
        if not any(w in text for w in ["name", "title", "word", "sign"]):
            flags["convention"] = False
    
    # Alan Watts "Realization of the I" - specific childhood/early experience
    if "Realization of the I" in title_upper or "Outsider" in title_upper:
        flags["single_occurrence"] = True
    
    # Alan Watts "Totality of the Now" - specific realization
    if "Totality" in title_upper or "Fallacy of Progress" in title_upper:
        flags["single_occurrence"] = True
    
    # Bruno "Heroic Frenzies" - specific recognition
    if "Heroic Frenzies" in title_upper:
        flags["single_occurrence"] = True
    
    # Bruno "English Sojourn" - specific experience
    if "English Sojourn" in title_upper or "Stranger Everywhere" in title_upper:
        flags["single_occurrence"] = True
    
    # Solomon "Ecclesiastes Closing" - specific book/conclusion
    if "Ecclesiastes" in title_upper or "Fear God" in title_upper:
        flags["single_occurrence"] = True  # specific textual conclusion
        flags["convention"] = True  # religious text, commandment
    
    # Spinoza "Hatred Cannot Be Returned" - specific recognition
    if "Hatred" in title_upper or "Non-Resistance" in title_upper:
        flags["single_occurrence"] = True  # specific encounters (Leiden student)
    
    # After all overrides, compute triad
    vehicle = "LEGISIGN" if flags["rule_based"] else ("SINSIGN" if flags["single_occurrence"] else "QUALISIGN")
    obj = "SYMBOL" if flags["convention"] else ("INDEX" if flags["causality"] else "ICON")
    interpretant = "ARGUMENT" if flags["reason"] else ("DICENT" if flags["fact"] else "RHEME")
    
    path = find_valid_path(vehicle, obj, interpretant)
    
    # If no valid path, try fallback permutations
    if not path:
        # Fallback 1: try with different interpretant
        for int_cand in ["RHEME", "DICENT", "ARGUMENT"]:
            if int_cand != interpretant:
                path = find_valid_path(vehicle, obj, int_cand)
                if path:
                    break
    
    if not path:
        # Fallback 2: try with different object
        for obj_cand in ["ICON", "INDEX", "SYMBOL"]:
            if obj_cand != obj:
                path = find_valid_path(vehicle, obj_cand, interpretant)
                if path:
                    break
    
    if path:
        path_key = "-".join(path)
        class_id = path_to_id[path_key]
        sc = real_classes[class_id]
        
        e["peirce"] = {
            "mode": sc["path"][1] if sc["path"][1] != "Index" else "Index",
            "sign_class_id": class_id,
            "sign_class_label": sc["label"],
            "path": sc["path"],
            "firstness_weight": sc["firstness_weight"],
            "secondness_weight": sc["secondness_weight"],
            "thirdness_weight": sc["thirdness_weight"],
            "pragmatism_band": sc["pragmatism_band"],
        }
        e["peirce_migration_pending"] = False
        e["peirce_migration_source"] = "rubric_v2_corrected"
        e["semiotic_flags"] = flags
        classified += 1
    else:
        e["peirce_migration_pending"] = True
        e["peirce_migration_source"] = "rubric_ambiguous_v2"
        e["semiotic_flags"] = flags
        still_pending += 1

print(f"Classified: {classified} | Still pending: {still_pending}")

# Show distribution
class_counts = Counter()
for e in pending:
    if not e.get("peirce_migration_pending", False):
        cid = e.get("peirce", {}).get("sign_class_id")
        if cid is not None:
            class_counts[cid] += 1

print(f"\nClass distribution (resolved pending):")
for cid, cnt in sorted(class_counts.items()):
    sc = real_classes.get(cid, {})
    print(f"  Class {cid} ({sc.get('label','?')}): {cnt}")

print(f"\n=== SAMPLES ===")
for e in pending[:10]:
    if not e.get("peirce_migration_pending", False):
        flags = e.get("semiotic_flags", {})
        active = [k for k, v in flags.items() if v]
        p = e.get("peirce", {})
        title = e.get("_gnosis_meta", {}).get("title", e.get("meta", {}).get("title", "Unknown"))
        print(f"  {e['event_id']}: Class {p.get('sign_class_id')} ({p.get('sign_class_label')})")
        print(f"    flags={active}")
        print(f"    Title: {title}")

if still_pending > 0:
    print(f"\n=== STILL PENDING ===")
    for e in pending:
        if e.get("peirce_migration_pending", False):
            flags = e.get("semiotic_flags", {})
            active = [k for k, v in flags.items() if v]
            title = e.get("_gnosis_meta", {}).get("title", e.get("meta", {}).get("title", "Unknown"))
            print(f"  {e['event_id']}: flags={active}")
            print(f"    Title: {title}")

# Rewrite corpus
with open(master_path, "w") as f:
    for e in events:
        f.write(json.dumps(e) + "\n")

gnosis_path = os.path.join(WORKSPACE, "logs/gnosis_corpus_v5.2.jsonl")
with open(gnosis_path, "w") as f:
    for e in events:
        f.write(json.dumps(e) + "\n")

print(f"\nRewrote corpus files")

# Full stats
labeled = [e for e in events if e.get("peirce") and e["peirce"].get("sign_class_id") is not None]
pending_all = [e for e in events if not e.get("peirce") or e["peirce"].get("sign_class_id") is None]

print(f"\n=== FULL CORPUS ===")
print(f"Total: {len(events)} | Labeled: {len(labeled)} | Pending: {len(pending_all)}")

full_classes = Counter(e["peirce"]["sign_class_id"] for e in labeled)
print(f"Classes: {dict(sorted(full_classes.items()))}")

full_bands = Counter(e["peirce"]["pragmatism_band"] for e in labeled)
print(f"Bands: {dict(sorted(full_bands.items()))}")

def main(ctx):
    return {"ok": True, "total": len(events), "labeled": len(labeled), "pending": len(pending_all)}
