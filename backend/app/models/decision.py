"""Decision-related models mirroring the TypeScript types."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class RuleEvaluationResult(BaseModel):
    """Result of a single rule evaluation."""
    rule_id: str
    rule_name: str
    step: int
    result: str  # PASS | FAIL | WARNING | SKIP
    reason: str
    rejection_code: Optional[str] = None
    impact: Optional[str] = None


class ConfidenceBreakdown(BaseModel):
    """Breakdown of confidence scores by dimension."""
    eligibility: float = 1.0
    documents: float = 1.0
    coverage: float = 1.0
    limits: float = 1.0
    medical: float = 1.0


class FraudResult(BaseModel):
    """Fraud detection result."""
    score: int = 0
    risk_level: str = "LOW"  # LOW | MEDIUM | HIGH
    flags: list[str] = Field(default_factory=list)
    requires_manual_review: bool = False


class FinancialBreakdown(BaseModel):
    """Financial calculation breakdown."""
    claimed_amount: float = 0
    consultation_claimed: float = 0
    pharmacy_claimed: float = 0
    diagnostic_claimed: float = 0
    copay_amount: float = 0
    copay_percentage: float = 0
    network_discount: float = 0
    sublimit_deductions: float = 0
    approved_amount: float = 0


class MedicalNecessityResult(BaseModel):
    """Medical necessity assessment from Gemini."""
    score: float = 0.8
    reasoning: str = ""


class AdjudicationDecision(BaseModel):
    """Complete adjudication decision."""
    status: str  # APPROVED | REJECTED | PARTIAL | MANUAL_REVIEW
    claimed_amount: float = 0
    approved_amount: float = 0
    copay_amount: float = 0
    network_discount: float = 0
    rejection_reasons: list[str] = Field(default_factory=list)
    rejection_codes: list[str] = Field(default_factory=list)
    confidence: float = 0
    confidence_breakdown: ConfidenceBreakdown = Field(default_factory=ConfidenceBreakdown)
    fraud_score: int = 0
    fraud_risk: str = "LOW"
    fraud_flags: list[str] = Field(default_factory=list)
    rule_evaluations: list[RuleEvaluationResult] = Field(default_factory=list)
    financial_breakdown: FinancialBreakdown = Field(default_factory=FinancialBreakdown)
    medical_necessity_score: float = 1.0
    medical_necessity_reasoning: str = ""
    next_steps: list[str] = Field(default_factory=list)
    notes: str = ""
    processed_at: str = ""
