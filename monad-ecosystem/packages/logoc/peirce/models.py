from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Literal
from typing_extensions import Self

PragmatismBand = Literal["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]
CoarseMode = Literal["ICON", "INDEX", "SYMBOL"]

class SemioticFlags(BaseModel):
    single_occurrence: bool = False
    rule_based: bool = False
    similarity: bool = False
    causality: bool = False
    convention: bool = False
    possibility: bool = False
    fact: bool = False
    reason: bool = False

class PeirceSignature(BaseModel):
    mode: CoarseMode
    sign_class_id: int = Field(ge=0, le=65)
    sign_class_label: str
    path: List[str]
    firstness_weight: float
    secondness_weight: float
    thirdness_weight: float
    pragmatism_band: PragmatismBand

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> Self:
        total = self.firstness_weight + self.secondness_weight + self.thirdness_weight
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Triadic weights must sum to 1.0, got {total:.6f} "
                f"(first={self.firstness_weight}, second={self.secondness_weight}, third={self.thirdness_weight})"
            )
        return self

class LogocEvent(BaseModel):
    schema_version: str = "LOGOC-Event-v5.2"
    event_id: str
    timestamp: str
    narrative: str
    semiotic_flags: Optional[SemioticFlags] = Field(default_factory=SemioticFlags)
    peirce: Optional[PeirceSignature] = None
    peirce_migration_pending: bool = False
    peirce_migration_source: Optional[str] = None
    # ------------------------------------------------------------------
    # Production pipeline triage metadata (added in v2.5.0 P2)
    # ------------------------------------------------------------------
    pipeline_triage_status: Optional[str] = None  # "auto_accept" | "human_review"
    pipeline_triage_reason: Optional[str] = None  # "rubric_direct" | "ensemble_agree_high" | ...
    pipeline_ml_confidence: Optional[float] = None
    pipeline_rubric_method: Optional[str] = None  # "direct" | "fallback_interpretant" | ...
    pipeline_rubric_class_id: Optional[int] = None
    pipeline_ml_class_id: Optional[int] = None
    pipeline_p4_cleaned: bool = False  # P4 narrative-purpose flag cleaning was applied
