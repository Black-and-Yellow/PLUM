"""Claim CRUD endpoints."""

from __future__ import annotations
import uuid
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.database.mongodb import get_database
from app.models.claim import (
    ClaimModel, MemberInfo, ClaimProvider, ClaimDocument,
    ClaimTimelineEvent, ClaimsStats, ExtractionResult, Appeal,
)
from app.models.decision import AdjudicationDecision, MedicalNecessityResult
from app.schemas.claim import (
    ClaimCreateRequest, ClaimResponse, ClaimListResponse,
    StatsResponse, ClaimUpdateRequest, AppealRequest,
)
from app.services.adjudication_engine import AdjudicationInput, adjudicate_claim
from app.services import document_extractor, audit_service

router = APIRouter()


def _generate_claim_id() -> str:
    """Generate a unique claim ID matching the frontend format."""
    ts = int(time.time() * 1000)
    return f"CLM-{_base36(ts).upper()}-{uuid.uuid4().hex[:4].upper()}"


def _base36(n: int) -> str:
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    result = ""
    while n > 0:
        n, r = divmod(n, 36)
        result = chars[r] + result
    return result or "0"


@router.post("/claims", response_model=ClaimResponse)
async def create_claim(request: ClaimCreateRequest):
    """Create a new claim, run adjudication, and store in MongoDB."""
    db = get_database()
    now = datetime.now().isoformat()
    claim_id = _generate_claim_id()

    # Attempt medical necessity if Gemini is configured
    med_result: Optional[MedicalNecessityResult] = None
    diagnosis = request.extracted_diagnosis or ""
    if document_extractor.has_api_key() and diagnosis:
        try:
            med_result = await document_extractor.assess_medical_necessity(
                diagnosis, request.extracted_medicines, request.extracted_procedures
            )
        except Exception:
            pass  # proceed without it

    # Fetch existing claims for fraud detection historical lookup
    existing_claims = await db.claims.find(
        {"member.member_id": request.member_id},
        {"member": 1, "treatment_date": 1, "provider": 1}
    ).to_list(100)

    # Run adjudication engine
    adj_input = AdjudicationInput(
        member_id=request.member_id,
        member_name=request.member_name,
        member_join_date=request.member_join_date,
        treatment_date=request.treatment_date,
        submitted_at=now.split("T")[0],
        claimed_amount=request.claimed_amount,
        provider_name=request.provider_name,
        cashless_request=request.cashless_request,
        extracted_patient_name=request.extracted_patient_name,
        extracted_doctor_name=request.extracted_doctor_name,
        extracted_doctor_reg=request.extracted_doctor_reg,
        extracted_diagnosis=request.extracted_diagnosis,
        extracted_medicines=request.extracted_medicines,
        extracted_procedures=request.extracted_procedures,
        consultation_amount=request.consultation_amount,
        pharmacy_amount=request.pharmacy_amount,
        diagnostic_amount=request.diagnostic_amount,
        treatment_date_from_doc=request.treatment_date_from_doc,
        bill_date_from_doc=request.bill_date_from_doc,
        has_prescription=request.has_prescription,
        has_bill=request.has_bill,
        previous_claims_same_day=request.previous_claims_same_day,
        medical_necessity_result=med_result,
        ytd_approved_amount=request.ytd_approved_amount,
        itemized_amounts=request.itemized_amounts,
        existing_claims=existing_claims,
    )

    decision = adjudicate_claim(adj_input)

    # Build timeline
    timeline = [
        ClaimTimelineEvent(stage="Submitted", status="completed", timestamp=now, description="Claim submitted successfully"),
        ClaimTimelineEvent(stage="AI Extraction", status="completed", timestamp=now,
                          description="Documents analyzed with Gemini Vision" if document_extractor.has_api_key() else "Manual data entry"),
        ClaimTimelineEvent(stage="Adjudication", status="completed", timestamp=now,
                          description=f"{len(decision.rule_evaluations)} rules evaluated"),
        ClaimTimelineEvent(stage="Decision", status="completed", timestamp=now, description=decision.status),
    ]

    # Build claim model
    claim = ClaimModel(
        claim_id=claim_id,
        status=decision.status,
        submitted_at=now,
        updated_at=now,
        member=MemberInfo(
            member_id=request.member_id,
            member_name=request.member_name,
            member_join_date=request.member_join_date,
            relationship=request.relationship,
        ),
        provider=ClaimProvider(
            provider_name=request.provider_name,
            is_network_provider=False,
            cashless_request=request.cashless_request,
        ),
        treatment_date=request.treatment_date,
        claimed_amount=request.claimed_amount,
        previous_claims_same_day=request.previous_claims_same_day,
        documents=[],
        decision=decision,
        appeals=[],
        timeline=timeline,
    )

    # Store in MongoDB
    await db.claims.insert_one(claim.model_dump())

    # Audit log
    await audit_service.log_event("claim_created", claim_id, {"status": decision.status})

    return ClaimResponse(claim=claim)


@router.get("/claims", response_model=ClaimListResponse)
async def list_claims(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    """List all claims with optional filters."""
    db = get_database()
    query: dict = {}

    if status and status != "ALL":
        query["status"] = status

    if search:
        query["$or"] = [
            {"claim_id": {"$regex": search, "$options": "i"}},
            {"member.member_name": {"$regex": search, "$options": "i"}},
            {"member.member_id": {"$regex": search, "$options": "i"}},
            {"provider.provider_name": {"$regex": search, "$options": "i"}},
        ]

    total = await db.claims.count_documents(query)
    cursor = db.claims.find(query, {"_id": 0}).sort("submitted_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    claims = [ClaimModel(**doc) for doc in docs]
    return ClaimListResponse(claims=claims, total=total)


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim(claim_id: str):
    """Get a single claim by ID."""
    db = get_database()
    doc = await db.claims.find_one({"claim_id": claim_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Claim not found")
    return ClaimResponse(claim=ClaimModel(**doc))


@router.patch("/claims/{claim_id}", response_model=ClaimResponse)
async def update_claim(claim_id: str, request: ClaimUpdateRequest):
    """Update a claim's status or add reviewer comments."""
    db = get_database()
    updates: dict = {"updated_at": datetime.now().isoformat()}

    if request.status:
        updates["status"] = request.status
    if request.reviewer_comments:
        updates["decision.notes"] = request.reviewer_comments

    result = await db.claims.update_one(
        {"claim_id": claim_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Claim not found")

    await audit_service.log_event("claim_updated", claim_id, updates)

    doc = await db.claims.find_one({"claim_id": claim_id}, {"_id": 0})
    return ClaimResponse(claim=ClaimModel(**doc))


@router.post("/claims/{claim_id}/appeal", response_model=ClaimResponse)
async def submit_appeal(claim_id: str, request: AppealRequest):
    """Submit an appeal on a claim."""
    db = get_database()
    doc = await db.claims.find_one({"claim_id": claim_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Claim not found")

    appeal = Appeal(
        id=str(uuid.uuid4())[:8],
        reason=request.reason,
        submitted_at=datetime.now().isoformat(),
        status="PENDING",
    )

    await db.claims.update_one(
        {"claim_id": claim_id},
        {
            "$push": {"appeals": appeal.model_dump()},
            "$set": {"status": "APPEALED", "updated_at": datetime.now().isoformat()},
        },
    )

    await audit_service.log_event("appeal_submitted", claim_id, {"reason": request.reason})

    updated = await db.claims.find_one({"claim_id": claim_id}, {"_id": 0})
    return ClaimResponse(claim=ClaimModel(**updated))


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get dashboard statistics."""
    db = get_database()
    all_claims = await db.claims.find({}, {"_id": 0}).to_list(10000)

    approved = [c for c in all_claims if c.get("status") == "APPROVED"]
    rejected = [c for c in all_claims if c.get("status") == "REJECTED"]
    partial = [c for c in all_claims if c.get("status") == "PARTIAL"]
    manual = [c for c in all_claims if c.get("status") == "MANUAL_REVIEW"]
    pending = [c for c in all_claims if c.get("status") in ("DRAFT", "SUBMITTED", "PROCESSING")]
    appealed = [c for c in all_claims if c.get("status") == "APPEALED"]

    total_approved_amount = sum(
        c.get("decision", {}).get("approved_amount", 0)
        for c in approved + partial
    )

    decided = [c for c in all_claims if c.get("decision")]
    avg_confidence = (
        sum(c["decision"].get("confidence", 0) for c in decided) / len(decided)
        if decided else 0
    )

    fraud_reviewed = [
        c for c in all_claims
        if c.get("decision") and c["decision"].get("fraud_risk") != "LOW"
    ]

    total = len(all_claims)
    stats = ClaimsStats(
        total=total,
        approved=len(approved),
        rejected=len(rejected),
        partial=len(partial),
        manual_review=len(manual),
        pending=len(pending),
        total_approved_amount=total_approved_amount,
        average_confidence=avg_confidence,
        fraud_review_rate=len(fraud_reviewed) / total if total > 0 else 0,
        appeal_rate=len(appealed) / total if total > 0 else 0,
    )

    return StatsResponse(stats=stats)
