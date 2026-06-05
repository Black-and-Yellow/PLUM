"""Request/response schemas for claim endpoints."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.claim import ClaimModel, ClaimsStats


class ClaimCreateRequest(BaseModel):
    """Request body for creating a new claim (JSON portion of multipart)."""
    member_id: str
    member_name: str
    member_join_date: str = "2024-01-01"
    relationship: str = "employee"
    treatment_date: str
    provider_name: str
    cashless_request: bool = False
    claimed_amount: float
    previous_claims_same_day: int = 0
    # Optional pre-extracted data (when documents already processed)
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
    ytd_approved_amount: float = 0
    itemized_amounts: Optional[dict[str, float]] = None


class ClaimUpdateRequest(BaseModel):
    """Request for updating a claim."""
    status: Optional[str] = None
    reviewer_comments: Optional[str] = None


class AppealRequest(BaseModel):
    """Request for submitting an appeal."""
    reason: str


class ClaimResponse(BaseModel):
    """Single claim response."""
    claim: ClaimModel


class ClaimListResponse(BaseModel):
    """List of claims response."""
    claims: list[ClaimModel]
    total: int


class StatsResponse(BaseModel):
    """Dashboard statistics response."""
    stats: ClaimsStats
