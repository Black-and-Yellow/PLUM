"""Schemas for adjudication endpoint."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.decision import AdjudicationDecision, MedicalNecessityResult


class AdjudicateRequest(BaseModel):
    """Input for the adjudication engine."""
    member_id: str
    member_name: str
    member_join_date: str = "2024-01-01"
    treatment_date: str
    submitted_at: str
    claimed_amount: float
    provider_name: str
    cashless_request: bool = False

    # Extracted from documents
    extracted_patient_name: Optional[str] = None
    extracted_doctor_name: Optional[str] = None
    extracted_doctor_reg: Optional[str] = None
    extracted_diagnosis: Optional[str] = None
    extracted_medicines: list[str] = Field(default_factory=list)
    extracted_procedures: list[str] = Field(default_factory=list)
    consultation_amount: float = 0
    pharmacy_amount: float = 0
    diagnostic_amount: float = 0
    treatment_date_from_doc: Optional[str] = None
    bill_date_from_doc: Optional[str] = None

    has_prescription: bool = False
    has_bill: bool = False

    previous_claims_same_day: int = 0
    medical_necessity_result: Optional[MedicalNecessityResult] = None
    ytd_approved_amount: float = 0
    itemized_amounts: Optional[dict[str, float]] = None


class AdjudicateResponse(BaseModel):
    """Response from the adjudication engine."""
    decision: AdjudicationDecision
