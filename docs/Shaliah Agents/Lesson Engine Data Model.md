# Lesson Engine Data Model

## Entities
- Learner: identity, mastery state, spacing preferences, access tier.
- Skill: capability, prerequisites, target outcomes, transfer variants.
- Lesson: objective, model example, retrieval prompts, fading plan, delay schedule, transfer gate.
- Item: prompt text, expected response pattern, hint policy, solution key.
- Attempt: response, latency, hints used, correctness, explanation quality.
- Session: start/end, context, interruptions, retrieval and transfer success rates.
- MasteryEvent: delayed transfer evidence, score, integrity signature.
- TutorAction: selected prompt, rationale, next spacing interval, scaffold level, interleaving choice.

## States
- Learner: novice → guided → practiced → delayed → transferable → mastered
- Lesson: orient → model → retrieve → feedback → fade → interleave → delay → transfer → gate

## Progression rules
1. Log retrieval attempts immediately.
2. Successful retrieval reduces scaffolding.
3. Failed retrieval triggers feedback or re-modeling.
4. Mastery requires delayed success on a transfer variant.
5. Integrity-signed mastery events unlock the next tier.

## Storage shape
- Relational store for stable entities.
- Event log for attempts, tutor actions, and mastery evidence.