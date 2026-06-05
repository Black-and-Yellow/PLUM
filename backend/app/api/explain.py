"""Decision explanation endpoint.

POST /api/explain-decision
  Body: { "claim_id": "CLM-XXXX" }
  Returns: structured human-readable explanation of the adjudication decision.
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database.mongodb import get_database
from app.models.claim import ClaimModel
from app.models.decision import AdjudicationDecision
from app.services.decision_explainer import explain_decision

router = APIRouter()


class ExplainRequest(BaseModel):
    claim_id: str


@router.post("/explain-decision")
async def explain_claim_decision(request: ExplainRequest):
    """Return a human-readable explanation of a claim's adjudication decision.

    Input:
        claim_id: The ID of the claim to explain.

    Output:
        - title: e.g. "✅ Claim Approved"
        - status: raw status string
        - summary: one-paragraph narrative
        - steps: step-by-step rule evaluation summary (6 steps)
        - key_factors: most important decision factors as bullet points
        - financial_summary: plain-English financial breakdown
        - recommendation: what the claimant should do next

    Example response (APPROVED):
    {
        "title": "✅ Claim Approved",
        "status": "APPROVED",
        "confidence_percent": 88,
        "summary": "This claim has been approved ...",
        "steps": [...],
        "key_factors": [
            "Policy is active on the treatment date.",
            "All required documents were submitted.",
            ...
        ],
        "financial_summary": [
            "Claimed amount: ₹1,500",
            "Co-payment (10%): −₹150",
            "Approved amount: ₹1,350"
        ],
        "recommendation": "Reimbursement will be processed within 5–7 business days."
    }
    """
    db = get_database()
    doc = await db.claims.find_one({"claim_id": request.claim_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Claim '{request.claim_id}' not found")

    claim = ClaimModel(**doc)
    if not claim.decision:
        raise HTTPException(
            status_code=422,
            detail="This claim has no adjudication decision yet. Submit the claim first.",
        )

    explanation = explain_decision(claim.decision, claim_id=request.claim_id)
    return explanation
