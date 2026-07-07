# Human Review Queue — 27 Events Requiring Expert Judgment

**Date:** June 20, 2026  
**Corpus:** 337 events (after bulk reprocessing + Class 9 enrichment)  
**Pipeline:** ML v8 + Rubric v3  
**Auto-accept rate:** 92.0% (310/337)  
**Human review rate:** 8.0% (27/337)

These 27 events are genuinely ambiguous — the rubric classifier and ML model disagree, or the ML model is low-confidence. No amount of automated flag cleaning or model training will resolve them. They require **domain expert judgment** on the Peirce semiotic classification.

---

## How to Use This Document

For each event, consider:

1. **What is the sign ABOUT?** A specific occurrence (Sinsign) or a general type (Legisign)?
2. **What is the relation to the object?** Resemblance (Icon), causal connection (Index), or arbitrary convention (Symbol)?
3. **What kind of interpretant does it produce?** Possibility (Rheme), fact (Dicent), or reason/argument (Argument)?

If you decide a different classification is correct, note the event ID and the correct class. The flags can then be manually corrected in the corpus.

---

## Class 2 Events (15 events) — Sinsign-Index-Dicent vs. Other Classes

Class 2 = **single_occurrence + causality + fact** (a specific event causally connected to reality, producing factual knowledge). The ambiguity is usually: is this a **specific recognition event** (Sinsign) or a **general principle being illustrated** (Legisign)? Is the "because" causal (Index) or inferential (Argument)?

---

### 1. `gnosis_Akhenaten_ev04` — Actual: Class 2 | Rubric: 1 (Rheme-Index-Sinsign) | ML: 2 (96.1%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=0 FA=1 RE=1`

> Akhenaten now knew that all life processes were solar processes — that the many gods of Egypt were not separate beings but partial perceptions of a single source, and that recognizing this dissolved the entire polytheistic structure. The gnosis is the recognition that all biological processes are...

**Why ambiguous:** The narrative describes a **single moment of recognition** (Sinsign, `SO=1`) about a **causal structure** (Index, `CA=1`) producing **factual knowledge** (Dicent, `FA=1`). But the rubric sees `RE=1` ("reason" — the word "because" appears inferentially) and demotes to Class 1 (Rheme-Index-Sinsign = possibility, not fact). The ML is confident it's Class 2.

**Question:** Is this a factual assertion (Dicent, Class 2) or a possibility/understanding (Rheme, Class 1)? The narrative says "Akhenaten **now knew**" — that sounds like fact. But the rubric picks up on "reason" keywords.

**→ Suggested resolution:** Remove `RE=1` flag (the "reason" is causal, not inferential). This would make it clean Class 2.

---

### 2. `gnosis_Baruch Spinoza_ev05` — Actual: Class 2 | Rubric: 1 | ML: 2 (98.6%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=1 FA=1 RE=1`

> Spinoza now knew that freedom was not the power to interrupt the causal order but the understanding of the causal order — and that this understanding transformed the experience of necessity from bondage to liberation. The gnosis is the recognition that freedom is not the capacity to have done...

**Why ambiguous:** Same pattern as #1. `PO=1` (possibility — "freedom was not... but") + `RE=1` ("reason" — inferential language about "understanding") pushes rubric to Class 1 (Rheme). ML is confident Class 2 because `SO=1 CA=1 FA=1` is the dominant pattern.

**Question:** Is Spinoza's recognition about **what freedom IS** (fact, Dicent) or **what freedom could be** (possibility, Rheme)? The narrative says "now knew" — factual. But the language of possibility (")not... but") confuses the rubric.

**→ Suggested resolution:** Remove `PO=1` and `RE=1`. The recognition is factual, not hypothetical.

---

### 3. `gnosis_Baruch Spinoza_ev15` — Actual: Class 2 | Rubric: 1 | ML: 2 (64.1%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=0 FA=0 RE=1`

> Spinoza now knew that death was not a problem to be solved or a state to be prepared for but a limit that the free person simply does not attend to — that wisdom is meditation on life, because life is what exists and death is what does not. The gnosis is the recognition that death is not an event...

**Why ambiguous:** `FA=0` (no "fact" flag) + `RE=1` ("reason" — inferential "because") means the rubric can't find a valid Dicent path. It falls back to Rheme (Class 1). ML is only 64.1% confident in Class 2 — low confidence.

**Question:** Is this a **fact about death** (Dicent, Class 2) or a **reasoned argument about death** (Argument, Class 8)? The narrative says "now knew" — but the reasoning is philosophical argumentation, not causal observation.

**→ Suggested resolution:** This may actually be **Class 8** (Legisign-Index-Argument). Spinoza is making a **general philosophical argument** (Legisign) about death, not describing a **single recognition event** (Sinsign). The `SO=1` is weak here — he's not describing a specific moment of seeing death; he's articulating a general principle. Consider: **Class 8** (`RB=1 CA=1 RE=1`) or keep **Class 2** if the "now knew" is the key.

---

### 4. `gnosis_Cyrus the Great_ev01` — Actual: Class 2 | Rubric: 8 | ML: 2 (83.8%)

**Flags:** `SO=1 RB=1 CA=1 CO=0 PO=1 FA=1 RE=1`

> Divine authority is not located in a god — it is located in the coherence between a ruler's actions and a people's cosmological expectations, and Cyrus was now able to enter that coherence from the outside. The gnosis is not that Cyrus decided to use Marduk rhetorically. The gnosis is the prior re...

**Why ambiguous:** Too many flags = all over the place. `RB=1` (rule-based — "coherence between a ruler's actions and expectations" sounds like a general principle) + `RE=1` ("reason" — inferential) pushes rubric to Class 8 (Argument). ML is 83.8% on Class 2 but also sees Class 8 possibility.

**Question:** Is this Cyrus **recognizing a general principle** (Legisign, Class 8) about political legitimacy, or **recognizing a specific fact** (Sinsign, Class 2) about his own situation? The phrase "Divine authority is not located in a god" sounds like a **general law** (Legisign), not a specific event.

**→ Suggested resolution:** This is likely **Class 8** (Legisign-Index-Argument). The narrative describes a **general principle of political legitimacy** (`RB=1`) that Cyrus **reasoned his way into** (`RE=1`). The `SO=1` is misleading — he's not describing a single flash of recognition; he's articulating a structural insight. **Change to Class 8:** `RB=1 CA=1 RE=1`, remove `SO=1 PO=1 FA=1`.

---

### 5. `gnosis_Cyrus the Great_ev07` — Actual: Class 2 | Rubric: 8 | ML: 5 (67.6%)

**Flags:** `SO=0 RB=1 CA=1 CO=0 PO=0 FA=1 RE=1`

> Cyrus recognized that the man who had twice violated sacred commands was the most faithful person in his world, and that this meant faithfulness was a category organized around pattern rather than institution. The recognition is that *loyalty and treachery are not moral opposites but structural posi...

**Why ambiguous:** `SO=0` (no single occurrence!) — but actual is Class 2 (Sinsign). The narrative is about a **general pattern** ("faithfulness was a category organized around pattern" = `RB=1`). ML picks Class 5 (Dicent-Index-Legisign = general law + causality + fact). Rubric picks Class 8 (Argument) because `RE=1`.

**Question:** Is Cyrus describing a **specific historical recognition** (Sinsign, Class 2) or a **general philosophical principle** about loyalty (Legisign, Class 5 or 8)? The `SO=0` strongly suggests this is NOT a single event. The narrative is about a **pattern** (`RB=1`), not a token.

**→ Suggested resolution:** This is likely **Class 5** (Legisign-Index-Dicent = `RB=1 CA=1 FA=1`). Cyrus is recognizing a **general principle** about loyalty and structure. Remove `RE=1` (the reasoning is not formal argumentation; it's causal insight). **Change to Class 5:** `RB=1 CA=1 FA=1`, no `SO=1 RE=1`.

---

### 6. `gnosis_Gnostic Jesus_ev05` — Actual: Class 2 | Rubric: 1 | ML: 2 (99.2%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=0 FA=1 RE=1`

> Jesus recognized that the quest for the kingdom and the quest for self-knowledge were the same quest, and that not knowing this was not an error but a structural condition of poverty — being absent from what one already is. The gnosis event behind Logion 3 is the recognition that self-knowledge an...

**Why ambiguous:** `RE=1` pushes rubric to Class 1 (Rheme). But ML is 99.2% confident Class 2 because `SO=1 CA=1 FA=1` is dominant. The narrative says "Jesus recognized" — a single recognition event. But the content is about a **general structural condition** ("not knowing this was not an error but a structural condition").

**Question:** Is this a **single recognition** (Sinsign) about a **general truth** (Legisign)? Jesus sees a **specific fact** (the two quests are the same) in a **specific moment** (Logion 3). But the fact is a general principle. The `RE=1` is tricky — "the quest for the kingdom and the quest for self-knowledge **were** the same quest" is a factual assertion, not an argument.

**→ Suggested resolution:** Remove `RE=1`. This is a factual assertion (Dicent), not a logical argument. Keep Class 2: `SO=1 CA=1 FA=1`.

---

### 7. `gnosis_Gnostic Jesus_ev09` — Actual: Class 2 | Rubric: 1 | ML: 2 (99.2%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=0 FA=1 RE=1`

> Jesus recognized that he was not a person who had the light — he *was* the light, distributed through every material thing, and that the wood and the stone already contained what everyone was looking for. Logion 77 is particularly significant because it is not a theological claim about salvation...

**Why ambiguous:** Same pattern as #6. `RE=1` from rubric keyword matching, but the narrative is a **factual assertion** about Jesus's identity. ML is 99.2% confident Class 2.

**Question:** Is "he was the light" a **fact** (Dicent) or a **possibility/theory** (Rheme)? The narrative says "Jesus recognized" — this is a gnosis event, a moment of recognition. The content is asserted as fact, not hypothesized.

**→ Suggested resolution:** Remove `RE=1`. Keep Class 2: `SO=1 CA=1 FA=1`.

---

### 8. `gnosis_Gnostic Jesus_ev12` — Actual: Class 2 | Rubric: 9 | ML: 2 (96.7%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=1 PO=0 FA=1 RE=0`

> Jesus recognized, looking at the man born blind, that the entire explanatory framework of moral causation was a false category, and that what had been called a punishment was actually a structural opening — an occasion made for recognition. The gnosis event is the dissolution of the entire causal...

**Why ambiguous:** `CO=1` (convention — "moral causation," "false category," "structural opening") pushes rubric to Class 9 (Dicent-Iconic-Sinsign = `SO=1 SI=1 FA=1`). But `SI=0`! So the rubric can't find a valid path and falls through to the closest match. ML is 96.7% Class 2.

**Question:** Is Jesus recognizing a **causal structure** (Index, Class 2) or a **symbolic/conventional structure** (Symbol, Class 7/42)? The narrative is about **moral causation as a category** — that's conventional (Symbol), not causal (Index). But the actual classification is Class 2 (Index = causal).

**→ Suggested resolution:** This is tricky. The narrative is about Jesus **seeing through** a conventional category (moral causation) to a **causal reality** (structural opening). The `CO=1` is a **false positive** from the flag extractor — "moral causation" is not a convention in Peirce's sense (arbitrary sign), it's a **causal belief**. Remove `CO=1`. Keep Class 2: `SO=1 CA=1 FA=1`.

---

### 9. `gnosis_King Solomon_ev03` — Actual: Class 2 | Rubric: 1 | ML: 2 (98.6%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=1 FA=1 RE=1`

> Solomon now knew that the Temple both was and was not God's dwelling — that divine presence could be locally real without divine being being locally contained, and that this paradox was the structure of sacred space. The gnosis is the simultaneous recognition of two contradictory truths: that the...

**Why ambiguous:** `PO=1` (possibility — "could be") + `RE=1` ("reason" — inferential paradox) pushes rubric to Class 1. ML is 98.6% Class 2 because `SO=1 CA=1 FA=1` dominates.

**Question:** Is Solomon's recognition of the Temple paradox a **fact** (Dicent) or a **possibility** (Rheme)? The narrative says "Solomon **now knew**" — factual. But the language of paradox ("both was and was not," "could be") introduces possibility language.

**→ Suggested resolution:** Remove `PO=1` and `RE=1`. The paradox is a **recognized fact**, not a hypothesis. Solomon is not wondering if the Temple could be God's dwelling; he is asserting that it IS and IS NOT simultaneously. That's a factual recognition (Dicent). Keep Class 2.

---

### 10. `gnosis_Marcus Aurelius_ev14` — Actual: Class 2 | Rubric: 1 | ML: 2 (99.2%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=0 FA=1 RE=1`

> Writing what became his last entry, Marcus recognized that the sense of incompleteness he felt about his life was not a measure of the life's actual condition — that "three acts is the whole play" when the playwright decides it is, and that the grace being demanded of him was to accept that judgme...

**Why ambiguous:** Same pattern as #6, #7, #9. `RE=1` pushes rubric to Class 1. ML is 99.2% Class 2.

**Question:** Is Marcus's recognition about his **life's condition** a **fact** or a **reasoned argument**? He "recognized" (single event, Sinsign) that the incompleteness was "not a measure" (causal insight, Index) producing factual knowledge (Dicent). The `RE=1` is from "because" used causally, not inferentially.

**→ Suggested resolution:** Remove `RE=1`. Keep Class 2: `SO=1 CA=1 FA=1`.

---

### 11. `gnosis_Marcus Aurelius_ev1` — Actual: Class 2 | Rubric: null (ambiguous) | ML: 2 (77.6%)

**Flags:** `SO=0 RB=0 SI=0 CA=1 CO=0 PO=0 FA=1 RE=0`

> Individual identity is a linguistic error; we are functional extensions of a single, living intelligence. * Tripartite Camera Address: A macro shot of a single cell that zooms out rapidly until the cell is revealed to be a pixel in an eye looking back at the viewer. * Confidence Score: 1.0 ---------

**Why ambiguous:** `SO=0`! But actual is Class 2 (Sinsign). This is a **synthetic/camera-address entry** with insufficient narrative text. The rubric can't find a valid path because `SO=0` means the vehicle is Qualisign (not Sinsign), and the only path with `Qualisign-Icon-Dicent` is Class 9. But `SI=0` too. So rubric returns null (ambiguous).

**Question:** This is not a real gnosis event — it's a **synthetic camera address** with no narrative. It should probably be **removed from the corpus** or **manually rewritten** with a proper narrative. The actual classification (Class 2) is based on the original intent, but the text doesn't support it.

**→ Suggested resolution:** **Remove from corpus** or **rewrite with a proper narrative**. This is not a genuine gnosis event; it's a synthetic camera-direction entry. If kept, manually set `SO=1` to make it Class 2.

---

### 12. `gnosis_Niccolò Machiavelli_ev01` — Actual: Class 2 | Rubric: 1 | ML: 2 (99.2%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=0 FA=1 RE=1`

> Machiavelli now knew that the gap between sacred and secular authority was not a metaphysical divide but an engineering absence — a missing weapon. This is not a logical inference — it is a recognition of structure that had become *visible* through a specific historical event. The false category...

**Why ambiguous:** `RE=1` pushes rubric to Class 1. But the narrative **explicitly says** "This is **not** a logical inference" — the author is telling us it's NOT Class 8 (Argument). The ML correctly picks Class 2 (99.2%).

**Question:** This is a clear case where the flag extractor is wrong. The narrative explicitly denies inferential reasoning. The `RE=1` is a **false positive** from the flag extractor matching "not a logical inference" — the word "inference" triggers the `reason` flag even though the context is "NOT inference."

**→ Suggested resolution:** **Remove `RE=1` flag**. The narrative explicitly says this is NOT a logical inference. Keep Class 2: `SO=1 CA=1 FA=1`. This is a textbook case of flag extraction noise.

---

### 13. `gnosis_Niccolò Machiavelli_ev16` — Actual: Class 2 | Rubric: 9 | ML: 2 (96.7%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=1 PO=0 FA=1 RE=0`

> Machiavelli now knew that the entire humanist tradition of political education had been operating with a broken conceptual tool — a word that made moral goodness and political effectiveness appear to be the same thing, thus preventing the political thinker from ever confronting the actual choice b...

**Why ambiguous:** `CO=1` (convention — "word," "conceptual tool," "humanist tradition") pushes rubric to Class 9. But `SI=0` (no similarity), so it can't find a valid path. The ML is 96.7% Class 2.

**Question:** Is Machiavelli recognizing a **conventional structure** (Symbol, Class 7) or a **causal structure** (Index, Class 2)? The narrative is about a **"broken conceptual tool"** — that's language/convention (Symbol). But the actual classification is Class 2 (Index = causal).

**→ Suggested resolution:** This is genuinely ambiguous. The narrative is about a **conceptual tool** (convention, Symbol), but the recognition is about **how that tool causes blindness** (causal, Index). The `CO=1` is from "word" and "conceptual tool" — but Machiavelli is not using these as arbitrary conventions; he's describing them as **causal mechanisms** of blindness. Remove `CO=1`. Keep Class 2: `SO=1 CA=1 FA=1`.

---

### 14. `gnosis_Nietzsche_ev08` — Actual: Class 2 | Rubric: 8 | ML: 5 (67.6%)

**Flags:** `SO=0 RB=1 CA=1 CO=0 PO=0 FA=1 RE=1`

> Nietzsche now knew — not as a theory but as a recognition received beside a pyramid-shaped rock — that the question of whether life is worth living is not a question about life in general but a question that must be answered about *this specific life, in this specific moment*, with full knowledg...

**Why ambiguous:** `SO=0` (no single occurrence) + `RB=1` (rule-based — "question about life in general") + `RE=1` (inferential). Rubric goes to Class 8 (Argument). ML is 67.6% Class 5 (Legisign-Index-Dicent = general law + causality + fact).

**Question:** Is this a **general philosophical principle** (Legisign, Class 5/8) or a **specific recognition event** (Sinsign, Class 2)? The narrative says "beside a pyramid-shaped rock" — a specific location. But `SO=0` means no single occurrence flag. And the content is about a **general question** ("whether life is worth living").

**→ Suggested resolution:** This is likely **Class 5** (Legisign-Index-Dicent = `RB=1 CA=1 FA=1`). Nietzsche is articulating a **general principle** about the question of life's worth, not describing a **single flash of recognition**. The "beside a pyramid-shaped rock" is narrative color, not the sign itself. The sign is ABOUT the general question. **Change to Class 5:** `RB=1 CA=1 FA=1`, remove `SO=1 RE=1`.

---

### 15. `gnosis_The Gnostic Jesus_ev2` — Actual: Class 2 | Rubric: 1 | ML: 2 (98.6%)

**Flags:** `SO=1 RB=0 SI=0 CA=1 CO=0 PO=1 FA=1 RE=1`

> Divinity is not a destination to be reached, but an inherent structural identity to be remembered. * Best Tripartite Camera Address: A slow zoom through a drop of water that reveals an entire galaxy identical to the one outside the drop. * Confidence Score: 0.97 ------------------------------ as Gno...

**Why ambiguous:** This is another **synthetic camera-address entry** mixed with a real narrative. The `PO=1` ("to be reached," "to be remembered" = possibility language) + `RE=1` pushes rubric to Class 1. ML is 98.6% Class 2.

**Question:** The narrative part is a **general assertion** about divinity ("Divinity is not a destination..."). This sounds like a **general law** (Legisign), not a single event (Sinsign). But the actual classification is Class 2. The camera-address part is synthetic fluff.

**→ Suggested resolution:** **Remove the camera-address suffix** from the narrative. The core text is a **general principle** (Legisign), not a specific recognition. Consider changing to **Class 5** (Legisign-Index-Dicent = `RB=1 CA=1 FA=1`) or keeping Class 2 if the "as Gnostic Jesus" framing is the key. The `PO=1` should be removed — "Divinity is not a destination" is a factual assertion, not a possibility.

---

## Class 9 Events (6 events) — Dicent-Iconic-Sinsign vs. Other Classes

Class 9 = **single_occurrence + similarity + fact** (a specific event recognized through resemblance/likeness, producing factual knowledge). These are the hardest class because the boundary between **causal recognition** (Index, Class 2) and **resemblance recognition** (Icon, Class 9) is often blurry in mystical narratives.

---

### 16. `gnosis_Friedrich Nietzsche_ev01` — Actual: Class 9 | Rubric: 3 | ML: 9 (72.8%)

**Flags:** `SO=1 RB=1 SI=1 CA=0 CO=0 PO=1 FA=1 RE=1`

> Nietzsche now knew that his inner experience — previously inarticulate and isolating — was not his private pathology but a map of reality, and that the map had already been drawn by a predecessor he had not known existed. The gnosis is not the content of Schopenhauer's philosophy — Nietzsche h...

**Why ambiguous:** Too many flags: `SO=1 SI=1 RB=1 PO=1 FA=1 RE=1`. The rubric sees `RB=1` (Legisign) + `SI=1` (Icon) + `PO=1` (Rheme) and picks Class 3 (Legisign-Icon-Rheme). The ML is 72.8% Class 9 but uncertain.

**Question:** Is Nietzsche recognizing **resemblance** (his inner experience = a map of reality, Icon) or **causality** (his inner experience was caused by Schopenhauer's philosophy, Index)? The narrative says "a map of reality" — that's **resemblance** (Icon, the inner experience resembles/represents reality). But it also says "the map had already been drawn by a predecessor" — that's **causality** (Index, Schopenhauer caused the map).

**→ Suggested resolution:** This is genuinely ambiguous and could be **Class 9** (resemblance: inner experience = map) or **Class 2** (causality: Schopenhauer caused the recognition). The narrative emphasizes **resemblance** more than causality: "was not his private pathology but a map of reality." The key is the **iconic relation** — the inner experience **looks like** / **represents** reality. Keep **Class 9** but clean flags: `SO=1 SI=1 FA=1`, remove `RB=1 PO=1 RE=1`.

---

### 17. `gnosis_Marcus Aurelius_ev05` — Actual: Class 9 | Rubric: 3 | ML: 9 (72.8%)

**Flags:** `SO=1 RB=1 SI=1 CA=0 CO=0 PO=1 FA=1 RE=1`

> Somewhere on the Danube frontier, facing a war he had not chosen and could not avoid, Marcus recognized that waiting for better conditions to practice philosophy was the specific error — that the war, the plague, and the frustration were not interruptions of his life but its actual content. The fo...

**Why ambiguous:** Same pattern as #16. `RB=1` ("specific error" = rule) + `SI=1` ("not interruptions but actual content" = likeness/resemblance) + `PO=1` + `RE=1` = too many flags. Rubric picks Class 3. ML is 72.8% Class 9.

**Question:** Is Marcus recognizing **resemblance** (war resembles actual content of life) or **causality** (war causes the content of life)? The narrative says "were not interruptions of his life but its actual content" — that's **identity through resemblance**, not causal connection. The war IS the content; it doesn't cause it.

**→ Suggested resolution:** The narrative is about **resemblance/identity** (war = content), not causality. Keep **Class 9** but clean flags: `SO=1 SI=1 FA=1`, remove `RB=1 PO=1 RE=1`.

---

### 18. `gnosis_Napoleon Bonaparte_ev10` — Actual: Class 9 | Rubric: 3 | ML: 9 (89.2%)

**Flags:** `SO=1 RB=1 SI=1 CA=0 CO=0 PO=1 FA=1 RE=0`

> Napoleon now knew that his identity was not tied to the scale of his rule but to the structural impulse to rule — and that this essence would not allow him to rest on Elba. The gnosis is the recognition that his identity as ruler was not dependent on the scale of his rule — that the same structur...

**Why ambiguous:** `RB=1` ("structural impulse," "essence" = general rule) + `SI=1` ("not tied to the scale" = resemblance/identity) + `PO=1` ("would not allow" = possibility). Rubric sees `RB=1` + `SI=1` + `PO=1` and picks Class 3 (Legisign-Icon-Rheme). ML is 89.2% Class 9.

**Question:** Is Napoleon recognizing a **resemblance** (his identity resembles the structural impulse) or a **general law** (Legisign, Class 3)? The narrative is about **identity** — who Napoleon IS. The "structural impulse to rule" is not a general law; it's a **description of Napoleon's essence**, recognized through **likeness** (his identity = the impulse to rule).

**→ Suggested resolution:** This is about **self-recognition through resemblance** (who I am = what I do). Keep **Class 9** but remove `RB=1 PO=1`. The "structural impulse" is not a general rule being illustrated; it's a **description of Napoleon's own identity**. Flags: `SO=1 SI=1 FA=1`.

---

### 19. `gnosis_Niccolò Machiavelli_ev07` — Actual: Class 9 | Rubric: 3 | ML: 9 (72.8%)

**Flags:** `SO=1 RB=1 SI=1 CA=0 CO=0 PO=1 FA=1 RE=1`

> Machiavelli now knew that his exile from Florentine political life had accidentally placed him in a position to receive a kind of instruction that no active political career could have given him — that the ancients would only speak to a man who had been stripped of everything else. This is a self-...

**Why ambiguous:** Same as #16, #17. Too many flags. `RB=1` + `SI=1` + `PO=1` + `RE=1`. Rubric picks Class 3. ML is 72.8% Class 9.

**Question:** Is Machiavelli recognizing **resemblance** (exile = instruction) or **causality** (exile caused instruction)? The narrative says "his exile... had... placed him in a position" — that's **causality** (Index). But it also says "the ancients would only speak to a man who had been stripped of everything else" — that's **resemblance** (the stripped man resembles the proper listener).

**→ Suggested resolution:** The narrative is ambiguous between causality and resemblance. The key phrase is "the ancients would only speak to a man who had been stripped of everything else" — this is about **qualitative resemblance** (the stripped man = the proper listener), not causality. Keep **Class 9** but clean flags: `SO=1 SI=1 FA=1`, remove `RB=1 PO=1 RE=1`.

---

### 20. `gnosis_Alan Watts_ev06` — Actual: Class 9 | Rubric: 9 | ML: 1 (60.5%)

**Flags:** `SO=1 RB=0 SI=0 CA=0 CO=0 PO=1 FA=0 RE=0`

> The Complementary Contradiction His lecture series on The Philosophy of Nature, where he categorized all thinkers into Prickles (logical, precise, discrete) and Goo (mystical, flowing, holistic). He recognized that these are not "conflicting" theories, but "complementary" modes of a single cosmic pr...

**Why ambiguous:** `SI=0`! But actual is Class 9 (Iconic = similarity). The rubric correctly sees Class 9 (because `SO=1` + no causality + no convention = Icon is the only object option). But the ML is only 60.5% and picks Class 1 (Rheme-Index-Sinsign) because `PO=1` is the only interpretant flag.

**Question:** Is Watts recognizing **similarity** (Prickles and Goo are complementary — they resemble each other as parts of a whole) or **possibility** (they COULD be complementary)? The narrative is about **categorization** (Prickles vs. Goo) — that's convention (Symbol), not resemblance (Icon). But the actual classification is Class 9.

**→ Suggested resolution:** This is likely **misclassified**. Watts is creating **categories** (Prickles/Goo) — that's **conventional** (Symbol, Class 7 or 42), not **resemblance** (Icon, Class 9). The recognition is about **complementarity** — but complementarity is a **structural relationship** (Index or Symbol), not **likeness** (Icon). Consider changing to **Class 7** (Dicent-Symbol-Legisign = `RB=1 CO=1 FA=1`) or **Class 2** (if the recognition is a specific causal insight). The `SI=0` strongly suggests this is NOT Class 9. **Most likely: Class 7** (Legisign + Symbol + Dicent = a general conventional truth about categories).

---

### 21. `gnosis_Charles Sanders Peirce_03` — Actual: Class 9 | Rubric: 9 | ML: 1 (60.5%)

**Flags:** `SO=1 RB=0 SI=0 CA=0 CO=0 PO=1 FA=0 RE=0`

> The Neglected Argument While attending a service at St. Thomas's Episcopal Church in New York (1892), Peirce—previously a skeptic—experienced a sudden, overwhelming sense of the reality of God while observing the ritual. It was a "recognition of the Absolute" through the medium of aesthetic and comm...

**Why ambiguous:** Same as #20. `SI=0` but actual is Class 9. ML is 60.5% Class 1 because `PO=1` is the only interpretant flag. Rubric correctly picks Class 9 (fallback to Icon when no causality/convention).

**Question:** Is Peirce's recognition of God **through resemblance** (the ritual resembles the Absolute) or **through possibility** (a sense that God COULD be real)? The narrative says "recognition of the Absolute through the medium of aesthetic and communal experience" — the ritual is a **medium**, not a **likeness**. A medium is causal/Indexical, not iconic.

**→ Suggested resolution:** This is likely **misclassified**. Peirce's recognition is through a **ritual** (conventional, Symbol) or **aesthetic experience** (qualitative, Qualisign). The "sense of the reality of God" is a **feeling** (Qualisign). Consider **Class 0** (Rheme-Iconic-Qualisign = `SI=1 PO=1`) or **Class 3** (Rheme-Iconic-Legisign). But the actual is Class 9. The `SI=0` is the problem — if it's Class 9, there must be similarity. Where is the similarity? The ritual **resembles** the divine? That's a stretch. **Most likely: Class 0** (pure feeling of the Absolute, qualitative + possibility) or keep Class 9 if the similarity is implicit (aesthetic experience = likeness to divine beauty).

---

## Class 3 Events (2 events) — Rheme-Iconic-Legisign

Class 3 = **rule_based + similarity + possibility** (a general type recognized through resemblance, producing a possibility). These are about **general principles** (Legisign) recognized through **likeness** (Icon) that open up **possibilities** (Rheme).

---

### 22. `gnosis_Gnostic Jesus_ev15` — Actual: Class 9 | Rubric: 8 | ML: 9 (38.4%)

**Flags:** `SO=1 RB=1 SI=1 CA=1 CO=0 PO=0 FA=1 RE=1`

> Looking at Caesar's face on a coin, Jesus recognized that the coin and the human body were the same kind of thing — image-bearers of different sovereignties — and that returning each to its source was not a political compromise but a cosmological sorting. This is often read as a clever political...

**Why ambiguous:** WAY too many flags: `SO=1 RB=1 SI=1 CA=1 FA=1 RE=1`. The rubric sees `RB=1` + `RE=1` and picks Class 8 (Argument). The ML is only 38.4% on Class 9 — very uncertain. The actual classification is Class 9, but this is one of the most ambiguous events in the corpus.

**Question:** Is Jesus recognizing **resemblance** (coin = human body as image-bearers, Icon) or **causality** (returning each to its source = causal sorting, Index)? The narrative says "the coin and the human body were the **same kind of thing**" — that's **resemblance/identity** (Icon). But it also says "returning each to its source" — that's **causality** (Index). And the whole thing is a **general principle** ("image-bearers of different sovereignties" = Legisign).

**→ Suggested resolution:** This is genuinely **multi-class ambiguous**. It could be:
- **Class 9** (Sinsign-Icon-Dicent): Jesus recognizes the coin's resemblance to the human body in a single moment
- **Class 5** (Legisign-Index-Dicent): Jesus sees a general principle about sovereignty and causality
- **Class 8** (Legisign-Index-Argument): Jesus reasons about cosmological sorting

The narrative is so dense that it triggers ALL flags. **Expert judgment needed.** My recommendation: **keep Class 9** but with a note that this is a boundary case. The key is "the coin and the human body were the same kind of thing" — that's **resemblance** (Icon). The causality ("returning each to its source") is secondary.

---

### 23. `gnosis_Irenaeus of Lyon_11` — Actual: Class 3 | Rubric: 3 | ML: 9 (64.3%)

**Flags:** `SO=1 RB=1 SI=1 CA=0 CO=0 PO=0 FA=0 RE=0`

> The Anti-Gnostic Who Had to Think Like a Gnostic This event is not anchored in a single passage but in the structure of the entire corpus. The recognition: at some point during the composition of Book I of Against Heresies — in which Irenaeus reconstructs Valentinian theology with extraordinary prec...

**Why ambiguous:** `SO=1` (single occurrence) + `RB=1` (rule-based — "structure of the entire corpus") + `SI=1` (similarity — "think like a Gnostic"). Rubric picks Class 3 (Legisign-Icon-Rheme). But `PO=0` and `FA=0` — no interpretant! So the rubric falls through to Class 3 as the closest match. ML is 64.3% Class 9 because `SO=1 SI=1` looks like Class 9.

**Question:** Is Irenaeus recognizing a **general principle** (Legisign, Class 3) or a **specific resemblance** (Sinsign, Class 9)? The narrative is about "the structure of the entire corpus" — that's general (Legisign). But it's also about Irenaeus **thinking like a Gnostic** — that's resemblance (Icon). The lack of `PO=1` or `FA=1` means no interpretant is set, making this impossible to classify cleanly.

**→ Suggested resolution:** This needs a **rewrite or flag correction**. The narrative is about Irenaeus **understanding** (possibility, Rheme) the Gnostic system through **resemblance** (thinking like them). Add `PO=1` to make it clean Class 3: `RB=1 SI=1 PO=1`. Or, if the recognition is factual, add `FA=1` and change to **Class 5** (`RB=1 CA=1 FA=1` — but `CA=0` here). **Most likely: Class 3** with `PO=1` added.

---

## Class 0 Events (1 event) — Rheme-Iconic-Qualisign

Class 0 = **similarity + possibility** (a pure quality/feeling recognized through resemblance, producing a possibility). These are the most "mystical" events — pure phenomenological experiences.

---

### 24. `gnosis_Thales of Miletus_06` — Actual: Class 0 | Rubric: 0 | ML: 0 (40.8%)

**Flags:** `SO=0 RB=0 SI=0 CA=0 CO=0 PO=0 FA=1 RE=0`

> The Flooding Nile (Geometry from Mud) Diogenes Laertius (Lives, I.27) records that Thales visited Egypt and demonstrated the measurement of the height of the pyramids by their shadows — using the moment at which a vertical stick casts a shadow equal to its own height as the moment to measure the pyr...

**Why ambiguous:** `FA=1` (fact) but actual is Class 0 (Rheme = possibility). The rubric correctly sees `FA=1` and tries Dicent paths, but with no `SO=1`, `RB=1`, `CA=1`, or `CO=1`, it falls back to Class 0. The ML is only 40.8% confident — very low.

**Question:** Is Thales's discovery a **pure feeling/quality** (Qualisign, Class 0) or a **causal fact** (Index, Class 2)? The narrative is about **measuring pyramids by shadows** — that's a **method/discovery** (causal, Index). The "moment at which a vertical stick casts a shadow equal to its own height" is a **specific event** (Sinsign).

**→ Suggested resolution:** This is almost certainly **misclassified**. Thales's discovery is a **causal method** (Index) producing **factual knowledge** (Dicent) about a **specific event** (Sinsign). It should be **Class 2** (`SO=1 CA=1 FA=1`). The actual Class 0 (Qualisign) makes no sense for a geometric measurement. **Change to Class 2:** add `SO=1 CA=1`, keep `FA=1`.

---

## Class 9 / Class 1 Boundary (4 events) — Low Confidence ML

These events have the ML model disagreeing with the rubric at low confidence, suggesting they are on the boundary between classes.

---

### 25. `gnosis_Aristotle_15` — Actual: Class 9 | Rubric: 9 | ML: 1 (60.5%)

**Flags:** `SO=1 RB=0 SI=0 CA=0 CO=0 PO=1 FA=0 RE=0`

> When Athens indicted Aristotle for impiety (asebeia) following Alexander's death in 323 BCE — the same charge used to kill Socrates in 399 BCE — Aristotle fled to Chalcis in Euboea. The explanation preserved by later sources (Aelian, Varia Historia III.36, though the historicity is debated):
 Aristo...

**Why ambiguous:** `PO=1` (possibility) + `SO=1` but no `SI=1`, `CA=1`, or `CO=1`. The rubric can't find a valid path and falls through to Class 9 (Icon as default object). ML is 60.5% Class 1 (Rheme-Index-Sinsign) because `PO=1` + `SO=1` looks like Class 1.

**Question:** Is Aristotle's flight a **recognition of possibility** (Rheme, Class 1) or a **recognition of resemblance** (Icon, Class 9)? The narrative is about historical events (indictment, flight) — not a mystical recognition at all. This seems like a **historical event entry**, not a gnosis event.

**→ Suggested resolution:** This is likely **not a gnosis event** — it's a historical narrative about Aristotle's flight. If kept, it's probably **Class 1** (Rheme-Index-Sinsign = `SO=1 CA=1 PO=1`) because Aristotle **recognized the danger** (causal, Index) and **fled** (possibility of death). But the actual is Class 9. This needs **expert judgment** on whether this is a genuine gnosis event or a historical placeholder. **Consider removing** if it's not a real gnosis event.

---

### 26. `gnosis_Galileo Galilei_02` — Actual: Class 9 | Rubric: 9 | ML: 1 (60.5%)

**Flags:** `SO=1 RB=0 SI=0 CA=0 CO=0 PO=1 FA=0 RE=0`

> The Medicean Stars (The Non-Centrality of the Earth) January 7–13, 1610: The observation of four small stars moving around Jupiter.
 I should have examined the distance between them and Jupiter... but the sight of them being in a straight line... and then seeing them change position... my amazement...

**Why ambiguous:** Same as #25. `PO=1` + `SO=1` but no `SI=1`, `CA=1`, or `CO=1`. Rubric falls through to Class 9. ML is 60.5% Class 1.

**Question:** Is Galileo's observation a **scientific discovery** (causal, Index, Class 2) or a **recognition of resemblance** (Icon, Class 9)? The narrative is about **observing stars moving around Jupiter** — that's a **causal observation** (Index, the motion causes the recognition). The "amazement" is a feeling (Qualisign). But the actual is Class 9.

**→ Suggested resolution:** This is a **scientific observation**, not a mystical recognition. The stars' motion is **causally observed** (Index), not recognized through resemblance (Icon). The actual Class 9 is likely **wrong**. Consider changing to **Class 2** (Sinsign-Index-Dicent = `SO=1 CA=1 FA=1`) — Galileo sees a specific causal fact (stars move around Jupiter) producing factual knowledge. Or **Class 0** (Qualisign) if the "amazement" is the key. **Most likely: Class 2**.

---

### 27. `gnosis_Alan Watts_06` — Already covered as #20.

---

## Summary of Recommendations

| # | Event ID | Actual | Recommended | Action | Confidence |
|---|---|---|---|---|---|
| 1 | Akhenaten_ev04 | 2 | **2** | Remove `RE=1` | High |
| 2 | Spinoza_ev05 | 2 | **2** | Remove `PO=1`, `RE=1` | High |
| 3 | Spinoza_ev15 | 2 | **8** or **2** | Remove `FA=0`, clarify | Medium |
| 4 | Cyrus_ev01 | 2 | **8** | Remove `SO=1`, add `RB=1 RE=1` | Medium |
| 5 | Cyrus_ev07 | 2 | **5** | Remove `SO=1 RE=1`, add `RB=1` | Medium |
| 6 | Jesus_ev05 | 2 | **2** | Remove `RE=1` | High |
| 7 | Jesus_ev09 | 2 | **2** | Remove `RE=1` | High |
| 8 | Jesus_ev12 | 2 | **2** | Remove `CO=1` | High |
| 9 | Solomon_ev03 | 2 | **2** | Remove `PO=1`, `RE=1` | High |
| 10 | Marcus_ev14 | 2 | **2** | Remove `RE=1` | High |
| 11 | Marcus_ev1 | 2 | **Remove** | Synthetic camera entry | High |
| 12 | Machiavelli_ev01 | 2 | **2** | Remove `RE=1` (explicitly denied) | High |
| 13 | Machiavelli_ev16 | 2 | **2** | Remove `CO=1` | Medium |
| 14 | Nietzsche_ev08 | 2 | **5** | Remove `SO=1 RE=1`, add `RB=1` | Medium |
| 15 | Jesus_ev2 | 2 | **2 or 5** | Remove camera suffix, `PO=1` | Medium |
| 16 | Nietzsche_ev01 | 9 | **9** | Remove `RB=1 PO=1 RE=1` | Medium |
| 17 | Marcus_ev05 | 9 | **9** | Remove `RB=1 PO=1 RE=1` | Medium |
| 18 | Napoleon_ev10 | 9 | **9** | Remove `RB=1 PO=1` | Medium |
| 19 | Machiavelli_ev07 | 9 | **9** | Remove `RB=1 PO=1 RE=1` | Medium |
| 20 | Watts_ev06 | 9 | **7** or **remove** | Misclassified? | Low |
| 21 | Peirce_03 | 9 | **0 or 9** | Add `SI=1` or reclassify | Low |
| 22 | Jesus_ev15 | 9 | **9** (keep) | Boundary case | Expert |
| 23 | Irenaeus_11 | 3 | **3** | Add `PO=1` | High |
| 24 | Thales_06 | 0 | **2** | Add `SO=1 CA=1` | High |
| 25 | Aristotle_15 | 9 | **1 or remove** | Not a gnosis event? | Low |
| 26 | Galileo_02 | 9 | **2** | Scientific, not mystical | Medium |
| 27 | (duplicate) | — | — | — | — |

---

## How to Apply Corrections

After you've reviewed and decided, I can apply the corrections in bulk. Just tell me:

1. **Which events to remove** (e.g., Marcus_ev1, Aristotle_15)
2. **Which events to reclassify** (e.g., Cyrus_ev01 → Class 8, Thales_06 → Class 2)
3. **Which flags to clean** (e.g., remove `RE=1` from all Class 2 events where it's a false positive)

I'll then update the corpus, retrain the ML model, and regenerate the audit report.
