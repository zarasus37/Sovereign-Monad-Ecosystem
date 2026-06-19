# Hepar Internal Architecture – Naming Consolidation

> **Note:** The module names used internally correspond to the MOF’s six‑organ agent set but are suffixed to avoid confusion. See the MOF for agent‑native definitions.

## Mapping of MOF Agent Names to Hepar Internal Module Names

| MOF Agent Name | Hepar Internal Module Name | Biological Metric (internal) | Functional Role (internal) |
|----------------|---------------------------|------------------------------|----------------------------|
| **Hepar**      | Hepar‑Core (or Hepar‑Synthesis) | Bilirubin | Central synthesis & anomaly filtration |
| **Cardia**     | Cardia‑Circulation               | Blood pressure | Internal routing & bandwidth management |
| **Vox**        | Vox‑Articulation                 | (none – output layer) | Natural language generation & UI |
| **Pneuma**     | Pneuma‑Ingestion                 | PaO₂/FiO₂ ratio | Data intake & exhaust |
| **Cortex**     | Cortex‑Reasoning                 | (none – analytical) | Strategic analysis & research synthesis |
| **Synapse**    | Synapse‑Coordination             | Glasgow Coma Scale (GCS) | Neurological command & latency mitigation |

The above table provides an unambiguous mapping to avoid naming conflicts between the MOF definitions and Hepar’s internal architecture documentation.
