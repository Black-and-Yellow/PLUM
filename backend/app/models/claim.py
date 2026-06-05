"""Claim-related models mirroring the TypeScript types."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.decision import AdjudicationDecision


class MemberInfo(BaseModel):
    """Policy member information."""
    member_id: str
    member_name: str
    member_join_date: str = "2024-01-01"
    relationship: str = "employee"  # employee | spouse | child | parent


class ClaimProvider(BaseModel):
    """Provider information."""
    provider_name: str
    is_network_provider: bool = False
    cashless_request: bool = False


class Appeal(BaseModel):
    """Appeal on a claim decision."""
    id: str
    reason: str
    submitted_at: str
    status: str = "PENDING"  # PENDING | UNDER_REVIEW | RESOLVED
    reviewer_comments: Optional[str] = None
    resolved_at: Optional[str] = None


class ClaimTimelineEvent(BaseModel):
    """Timeline event for claim processing."""
    stage: str
    status: str  # completed | active | pending | error
    timestamp: str
    description: str


class ExtractionResult(BaseModel):
    """Document extraction result."""
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_registration_number: Optional[str] = None
    diagnosis: Optional[str] = None
    medicines: list[str] = Field(default_factory=list)
    procedures: list[str] = Field(default_factory=list)
    consultation_amount: Optional[float] = None
    pharmacy_amount: Optional[float] = None
    diagnostic_amount: Optional[float] = None
    provider_name: Optional[str] = None
    treatment_date: Optional[str] = None
    bill_date: Optional[str] = None
    confidence: float = 0.5
    raw_text: Optional[str] = None


class ClaimDocument(BaseModel):
    """Uploaded document metadata stored in MongoDB.

    Persists full provenance of each uploaded file so it can be
    retrieved, previewed, and audited after submission.
    """
    document_id: str  # unique ID for this document
    original_filename: str  # original name from user's filesystem
    filename: str  # stored filename on disk (may be renamed)
    filepath: str  # relative path inside uploads/
    mime_type: str  # e.g. image/jpeg, application/pdf
    doc_type: str  # prescription | bill | diagnostic_report | other
    size_bytes: int = 0  # file size at upload time
    upload_date: str  # ISO-8601 datetime of upload
    claim_reference: str = ""  # claim_id this document belongs to
    download_url: str = ""  # relative URL for preview/download
    extraction_result: Optional[ExtractionResult] = None
    extraction_status: str = "pending"  # pending | extracting | done | error
    extraction_error: Optional[str] = None


class ClaimModel(BaseModel):
    """Complete claim model for MongoDB storage."""
    claim_id: str
    status: str = "SUBMITTED"  # DRAFT|SUBMITTED|PROCESSING|APPROVED|REJECTED|PARTIAL|MANUAL_REVIEW|APPEALED
    submitted_at: str
    updated_at: str
    member: MemberInfo
    provider: ClaimProvider
    treatment_date: str
    claimed_amount: float
    previous_claims_same_day: int = 0
    documents: list[ClaimDocument] = Field(default_factory=list)
    decision: Optional[AdjudicationDecision] = None
    appeals: list[Appeal] = Field(default_factory=list)
    timeline: list[ClaimTimelineEvent] = Field(default_factory=list)


class ClaimsStats(BaseModel):
    """Dashboard statistics."""
    total: int = 0
    approved: int = 0
    rejected: int = 0
    partial: int = 0
    manual_review: int = 0
    pending: int = 0
    total_approved_amount: float = 0
    average_confidence: float = 0
    fraud_review_rate: float = 0
    appeal_rate: float = 0
