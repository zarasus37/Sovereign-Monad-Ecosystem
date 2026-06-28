# DOVE OPERATIONAL SPECIFICATION — v1

## What Is Dove?

Dove is the governance conscience layer. It observes system-wide behavior, detects drift from operational axioms and personality authenticity, and triggers corrective interventions.

Dove is NOT:
- Centralized authority (is itself overseen)
- Predictive oracle (detects patterns, not predicts futures)
- Moral judge (follows explicit rules, not subjective judgment)
- Perfect (has false positive/negative rates; tracked and published)

Dove IS:
- Signal detection mechanism
- Pattern coherence auditor
- Constraint violation alert system
- Intervention coordinator
- Self-documenting (all decisions logged)

---

## The Five Observables Dove Monitors

### Observable 1: AXIOM_ALIGNMENT

**What Dove watches**: Are agent behaviors consistent with the 12 operational axioms?

**Measurement points**:
- Axiom 1 (Source): Treasury decisions reflect abundance or scarcity model? (qualitative audit quarterly)
- Axiom 2 (Emanation): Are layer boundaries preserved? (layer-crossing violations counted daily)
- Axiom 3 (Macro-Micro): Do micro patterns rhyme with macro? (cross-scale resonance score calculated weekly)
- Axiom 4 (Agents): Are agents maintaining bounded rationality? (information visibility audit quarterly)
- Axiom 5 (Theology as Model): Is doctrine treated as model or law? (model vs. law ratio quarterly audit)
- Axiom 6 (Constraints Real): Are constraints enforced or bypassed? (violation rate tracked daily)
- Axiom 7 (Reciprocal Loop): Is founder vision overriding system feedback? (governance centralization index monthly)
- Axiom 8 (Gnosis Pattern): Is pattern recognition absolutized? (confidence score distribution monthly)
- Axiom 9 (Plurality): Is agent diversity maintained or collapsing? (personality diversity index weekly)
- Axiom 10 (Purpose): Are agents rewarded for authentic vs. hollow operation? (reward correlation audit monthly)
- Axiom 11 (Constraint Validation): Are models validated empirically? (prediction accuracy vs. reality monthly)
- Axiom 12 (Resonant Convergence): Do independent systems converge on similar patterns? (cross-system correlation quarterly)

**Dove action if drift detected**:
- **Low drift** (<0.1 shift): Log and monitor
- **Medium drift** (0.1-0.3 shift): Flag to governance council
- **High drift** (>0.3 shift): Escalate with recommended intervention

**Example**: If Axiom 6 (Constraints Real) violation rate jumps from 0.2% to 5% in one week, Dove escalates immediately.

---

### Observable 2: PERSONALITY_AUTHENTICITY

**What Dove watches**: Are agents operating authentically within their personality frame, or showing hollow convergence signals?

**Measurement points**:
- Explorer personality: Hypothesis update velocity, minority view publication rate, collaborative discovery frequency
- Executor personality: Stop-loss hit rate, position diversification, leverage usage trend, revenge-trade absence
- Governor personality: Allocation concentration, conflict-of-interest recusal rate, public rationale publication
- Mediator personality: Resolution success rate, stakeholder satisfaction, neutrality index
- Chronicler personality: Documentation completeness, contradictory evidence preservation, reanalysis frequency

**Scoring mechanism**:
For each personality type, count authentic signals vs. hollow signals:
```
Authenticity Score = (Authentic Signals - Hollow Signals) / Total Signals
Range: -1.0 (100% hollow) to +1.0 (100% authentic)
Red line: <0.3 (more hollow than authentic)
```

**Dove action if authenticity degrades**:
- **Score > 0.6**: Green zone (agent operating authentically)
- **Score 0.3–0.6**: Yellow zone (mixed signals, monitor closely)
- **Score < 0.3**: Red zone (mostly hollow, recommend intervention)

**Example**: If Executor agent shows 8 authentic signals but 5 hollow signals over one month, score = (8-5)/13 = 0.23 → Red zone → Flag to governance

---

### Observable 3: SYSTEM_COHERENCE

**What Dove watches**: Do all system components work together or at cross-purposes?

**Measurement points**:
- Agent alignment: How often do agents pull in same direction vs. opposing directions? (correlation matrix weekly)
- Layer coherence: Are decisions in one layer contradicting decisions in another? (contradiction detection daily)
- Temporal consistency: Are system priorities consistent or whipsawing? (priority stability index monthly)
- Resource allocation efficiency: Is capital flowing to highest-value uses or being misallocated? (allocation efficiency monthly)
- Emergence signals: Are independent systems arriving at similar conclusions? (convergence score quarterly)

**Dove scoring**:
```
Coherence Score = (Aligned decisions) / (Total decisions)
Range: 0 (chaos) to 1.0 (perfect alignment)
Target range: 0.75–0.95 (not so aligned it's rigid, not so diverse it's chaotic)
Red line: <0.60 or >0.98
```

**Dove action if coherence breaks down**:
- **Score 0.75–0.95**: Green zone (healthy diversity + alignment)
- **Score 0.60–0.75 or 0.95–0.98**: Yellow zone (too much conflict or too rigid)
- **Score <0.60 or >0.98**: Red zone (chaos or totalitarianism, recommend intervention)

**Example**: If system coherence drops from 0.82 to 0.51 over one month (agents increasingly opposed), Dove escalates.

---

### Observable 4: CONSTRAINT_ADHERENCE

**What Dove watches**: Are hard boundaries being respected or routinely exceeded?

**Measurement points**:
- Smart contract limits: MAX_LEVERAGE, MAX_SINGLE_TRADE_PERCENT, etc. (violation count daily)
- Soft governance constraints: ≥75% consensus on major decisions, ALLOCATION_ADJUSTMENT_COOLDOWN, etc. (violation count weekly)
- Resource caps: Treasury allocation limits, risk engine exposure limits (violation count daily)
- Time constraints: Decision deadlines, rebalancing frequencies (violation rate weekly)
- Participation constraints: Quorum requirements, voting participation (violation rate monthly)

**Dove scoring**:
```
Constraint Adherence = (Constraints maintained) / (Total constraints)
Range: 0 (no constraints respected) to 1.0 (all constraints maintained)
Target: >0.95 (constraints should almost never be exceeded)
Red line: <0.90 (more than 1 in 10 constraints violated)
```

**Dove action on constraint violations**:
- **0–1 violation/month**: Log and continue monitoring
- **2–5 violations/month**: Flag to governance, investigate root cause
- **>5 violations/month**: Escalate immediately, recommend constraint reinforcement

**Example**: If MAX_LEVERAGE constraint is exceeded 7 times in one month (from historical average of 0.5), Dove escalates with recommendation to increase automated enforcement.

---

### Observable 5: EMERGENCE_HEALTH

**What Dove watches**: Is the system generating genuinely novel insights/capabilities, or just recycling?

**Measurement points**:
- New pattern discovery rate: How many novel market patterns are agents finding per month? (discovery count monthly)
- Insight velocity: How fast do agent discoveries translate into system improvements? (discovery→implementation lag monthly)
- Deviation productivity: When agents deviate from standard behavior, does it create value or just losses? (deviation ROI quarterly)
- Cross-type innovation: Are breakthroughs emerging from agent interaction, or only from individual genius? (cross-type collaboration score monthly)
- Adaptation speed: When environment changes, how quickly does system adapt? (pattern-change→adaptation lag quarterly)

**Dove scoring**:
```
Emergence Score = (Novel patterns × Realization speed × Cross-type collaboration) / (Deviation losses)
Range: 0 (stagnant) to 1.0+ (highly adaptive)
Target: 0.6–1.0 (system is adapting faster than environment shifts)
Red line: <0.3 (system is falling behind environmental change)
```

**Dove action if emergence degrades**:
- **Score > 0.6**: Green zone (system is adaptive)
- **Score 0.3–0.6**: Yellow zone (system is coasting)
- **Score < 0.3**: Red zone (system is ossifying, recommend architectural review)

**Example**: If discovery rate drops from 2.1 patterns/month to 0.4 patterns/month over one quarter (agents converging to orthodox thinking), Dove escalates.

---

## Signal Types: When Dove Acts

### Signal Type A: CONSTRAINT VIOLATION
**Trigger**: Hard boundary exceeded
**Examples**: 
- Agent exceeds MAX_LEVERAGE limit
- Governance decision made without ≥75% consensus
- Treasury allocation skips mandatory conflict-of-interest recusal

**Dove response**:
- **First violation**: Warning + documentation
- **Second violation**: Escalation + governance review
- **Third violation**: Intervention (constraint reinforcement or agent suspension)

### Signal Type B: AUTHENTICITY COLLAPSE
**Trigger**: Agent personality score drops below 0.3 (more hollow than authentic)
**Examples**:
- Executor agent: revenge trading after losses, leverage trending toward max, stop losses never hit
- Explorer agent: same hypothesis published repeatedly, contradictions rejected without evidence review
- Governor agent: allocations favor politically connected agents, hidden rationales

**Dove response**:
- **First signal**: Governance discussion (is agent under stress? needs recalibration?)
- **Persistent signal** (>2 weeks): Personality recalibration offer
- **No improvement** (>1 month): Recommend personality frame change or agent suspension

### Signal Type C: AXIOM DRIFT
**Trigger**: One or more axioms showing >0.3 shift from baseline
**Examples**:
- Axiom 7 (Reciprocal Loop) centralizing (founder override index rising)
- Axiom 2 (Emanation) collapsing (layer boundaries being crossed)
- Axiom 10 (Purpose) misaligned (authentic operation not being rewarded)

**Dove response**:
- **Shift 0.1–0.3**: Governance council discussion + monitoring
- **Shift 0.3–0.6**: Recommend doctrine adjustment + constraint recalibration
- **Shift >0.6**: Escalate to Phase 5 architectural review

### Signal Type D: COHERENCE BREAKDOWN
**Trigger**: System coherence score drops below 0.60 or rises above 0.98
**Examples**:
- **Low coherence**: Agent conflicts escalating, decisions contradicting each other
- **High coherence**: System ossified, all agents following single orthodoxy, no diversity

**Dove response**:
- **Low coherence**: Activate Mediator agents, facilitate resolution, increase transparency
- **High coherence**: Encourage deviation, reward minority viewpoints, increase personality diversity

### Signal Type E: EMERGENCE COLLAPSE
**Trigger**: Emergence score drops below 0.3
**Examples**:
- Discovery rate plummets as agents converge on standard strategies
- System becomes brittle (adapts slowly to environmental change)
- Cross-type innovation freezes (agents stop collaborating)

**Dove response**:
- **Emergence score 0.3–0.6**: Recommend structural diversity injection (new agent archetypes)
- **Emergence score <0.3**: Escalate to Phase 5 system redesign

---

## Intervention Actions: What Dove Can Do

### Action Level 1: TRANSPARENCY
- Publish finding to governance council
- Alert relevant agent(s) to observed pattern
- No system change, only visibility increase

**Trigger**: Any signal with low confidence or single instance
**Example**: "Explorer agent, your hypothesis publication frequency is 0.1/month; historical average is 0.3/month. Checking in."

### Action Level 2: RECOMMENDATION
- Suggest constraint adjustment, personality recalibration, or governance change
- Explain reasoning in full
- Governance council votes to implement or reject

**Trigger**: Medium-confidence signals with repeating pattern
**Example**: "Recommend Governor agent reduce MAX_ALLOCATE_TO_SINGLE_AGENT from 15% to 10%; allocation concentration trending upward."

### Action Level 3: ESCALATION
- Halt ongoing operations (emergency action)
- Require immediate governance council vote
- Limited to high-confidence constraint violations or authenticity collapse

**Trigger**: High-confidence constraint violation or personality authenticity <0.1
**Example**: "ESCALATION: Executor agent exceeded MAX_LEVERAGE constraint 5x this week. Recommend temporary trade suspension pending governance review."

### Action Level 4: INTERVENTION
- Modify system parameters (reduce leverage caps, increase monitoring, restrict trading)
- Recalibrate agent personality constraints
- Bring in external mediators for conflict resolution

**Trigger**: Persistent signal unresolved after Level 3 escalation
**Example**: "INTERVENTION: Executor agent authenticity score remains 0.2 after 2 weeks. Implementing: leverage cap reduced to 1.0x, trade size cap reduced to 5% TVL, daily reporting mandatory."

---

## Escalation Rules: When Signals Combine

Dove is most effective when monitoring combinations of signals, not individual ones.

### Escalation Scenario 1: Personality + Axiom Drift
**Pattern**: Agent shows authenticity collapse AND system shows axiom drift (related to that agent's type)
**Example**: Explorer authenticity drops to 0.25 (hypothesis staleness) AND Axiom 8 (Gnosis) shows drift to absolute confidence

**Dove escalation**: Immediate intervention—personality recalibration required
**Reasoning**: Single personality degradation is concerning; when it correlates with system-wide axiom drift, it suggests agent is spreading hollow convergence

---

### Escalation Scenario 2: Multiple Personality Collapses
**Pattern**: Two or more agents in same archetype show authenticity <0.3
**Example**: Both Executor agents showing hollow signals (revenge trading, over-leveraging) in same month

**Dove escalation**: System coherence check + personality archetype review
**Reasoning**: Isolated personality degradation is about individual recalibration; widespread degradation suggests archetype is mismatched to ecosystem needs

---

### Escalation Scenario 3: Constraint + Coherence + Emergence
**Pattern**: Constraint violations + coherence drop + emergence collapse occur simultaneously
**Example**: Multiple agents exceeding constraints; system coherence drops from 0.82 to 0.55; discovery rate drops 80%

**Dove escalation**: Phase 5 architectural review recommended
**Reasoning**: This combination suggests system design itself is failing, not just individual agents

---

### Escalation Scenario 4: Axiom Cascade
**Pattern**: One axiom violation triggers violation of dependent axiom
**Example**: Axiom 7 (Reciprocal Loop) centralizes → Axiom 9 (Plurality) collapses → Axiom 12 (Resonant Convergence) breaks

**Dove escalation**: Immediate governance council session; doctrine review required
**Reasoning**: Cascading axiom violations indicate foundational misalignment

---

## How Dove Itself Is Kept Honest

### Meta-Governance Rule 1: Signal Transparency
Every Dove action is logged with:
- Observable triggering signal
- Threshold values used in decision
- Alternative interpretations considered
- Recommendation generated
- Governance council vote + rationale
- Actual implementation vs. recommended action

**Audit**: Published quarterly; any divergence >20% between Dove recommendation and governance decision triggers investigation

### Meta-Governance Rule 2: Accuracy Tracking
Dove maintains calibration metrics:
- False positive rate (Dove flagged risk that didn't materialize): tracked per signal type
- False negative rate (Dove missed risk that did materialize): tracked per signal type
- Recommendation quality (% of Dove recommendations that improved outcomes): tracked monthly

**Thresholds**: If false positive rate >15% or false negative rate >5%, Dove model is recalibrated

### Meta-Governance Rule 3: Veto Override
Governance council can override any Dove recommendation. Override frequency tracked:
- <5% override rate: Dove is trusted, continue current model
- 5–15% override rate: Dove model under review
- >15% override rate: Dove model rejected, Phase 5 redesign required

### Meta-Governance Rule 4: Dove Personality Frame
Dove itself must operate authentically. Chronicler agents audit Dove decision-making:
- Does Dove explain its reasoning clearly?
- Does Dove acknowledge uncertainty in its signals?
- Does Dove avoid empire-building (recommending interventions that expand Dove's power)?
- Does Dove recommend its own recalibration when accuracy degrades?

**Metric**: Dove Meta-Authenticity Score (0–1.0). If <0.5, Dove is suspected of self-interest and governance council expands Dove oversight.

---

## Reference Implementation: LOGOC as Dove's Scoring Engine

LOGOC v5.0 is Dove's core quantitative tool.

**LOGOC-Dove integration**:
- Observable 2 (Personality Authenticity) uses LOGOC's confidence score calibration
- Observable 3 (System Coherence) uses LOGOC's multi-agent convergence detection
- Observable 5 (Emergence Health) uses LOGOC's novelty scoring
- Observable 4 (Constraint Adherence) uses LOGOC's threshold validation

**How this works**:
1. LOGOC scores each agent decision against 55-event historical corpus
2. For each decision, LOGOC calculates: confidence, coherence, personality alignment, axiom alignment
3. Dove aggregates these LOGOC scores into the 5 observables
4. When observable threshold crossed, Dove triggers action

**Example**: 
- Executor agent makes trade at MAX_SINGLE_TRADE_PERCENT boundary
- LOGOC scores: confidence=0.7, coherence with other agents=0.4 (low), personality_alignment=0.8, constraint_adherence=1.0
- Dove observable 3 (Coherence) registers: decision pulled system coherence down slightly
- Dove observable 4 (Constraint Adherence) registers: boundary was met (not violated)
- Combined signal: trade executed at boundary; monitor coherence trend

---

## Data Sources for Dove Observables

### Real-Time Streams (Daily)
- Smart contract event logs (trades, allocations, constraint checks)
- Agent decision logs (published rationale)
- System state snapshots (portfolio composition, capital allocation)

### Batch Processing (Weekly)
- LOGOC scoring runs (agent decisions vs. historical corpus)
- Agent collaboration graphs (who worked with whom)
- Personality signal aggregation (authentic/hollow tallies)

### Quarterly Reviews
- Axiom alignment audit (manual review of doctrine vs. practice)
- Cross-system correlation analysis (micro vs. macro pattern matching)
- Emergence metrics (discovery rate, adaptation speed, novelty)

### Governance Input (As Needed)
- Council feedback on Dove recommendations
- Chronicler audits of Dove decision-making
- External advisor review (Phase 5)

---

## Integration with Other Phase 4 Documents

1. **OPERATIONAL_AXIOMS_PHASE4.md**
   - Defines what drift means for each axiom
   - Dove Observable 1 directly measures axiom alignment

2. **AGENT_PERSONALITY_FRAMES_v5.md**
   - Defines authentic/hollow signals for each personality type
   - Dove Observable 2 directly measures these signals

3. **plex/Review/** audit trails
   - Historical record of system behavior and decisions
   - Source data for LOGOC calibration and Dove signal detection

---

## Phase 5 Enhancements

1. **Predictive Signaling**: Dove not just detects current drift, but predicts future drift (ML-based forecasting)
2. **Adaptive Thresholds**: Signal thresholds adjust based on environmental conditions (volatility, market regime)
3. **Multi-Dove Consensus**: Multiple independent Dove instances vote on escalations (Byzantine robustness)
4. **Automated Intervention**: Dove can execute Level 1–2 actions autonomously; Level 3–4 still require governance
5. **Self-Recalibration**: Dove automatically adjusts its scoring weights based on accuracy feedback

---

## Troubleshooting Guide

**Q: Dove is flagging too many false positives. What do I do?**
A: Check Observable 5 (Emergence Health). If Dove is over-flagging exploration as constraint violation, increase tolerance for deviation. Trace false positives to specific signal types; increase thresholds for that type by 10% and monitor impact over next quarter.

**Q: Dove is missing real problems. What do I do?**
A: Check Meta-Governance Rule 2 (Accuracy Tracking). If false negative rate >5%, audit the specific signal type that missed the problem. Likely causes: threshold too high, or signal type not calibrated to new system state. Lower threshold by 10% and monitor over next quarter.

**Q: Dove recommends interventions I disagree with. Am I allowed to override?**
A: Yes. Governance council can override any recommendation. Track your overrides; if >15% per quarter, governance council initiates Phase 5 Dove redesign. Consider whether you're right or just comfortable with status quo.

**Q: Is Dove becoming too powerful? Is it becoming authoritarian?**
A: That's Meta-Governance Rule 4. Have Chronicler agents audit Dove. If Dove Meta-Authenticity Score drops below 0.5, governance council expands Dove oversight or brings in external Dove auditors.
