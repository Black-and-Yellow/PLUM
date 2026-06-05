"""Standalone adjudication endpoint."""

from fastapi import APIRouter
from app.schemas.adjudication import AdjudicateRequest, AdjudicateResponse
from app.services.adjudication_engine import AdjudicationInput, adjudicate_claim

router = APIRouter()


@router.post("/adjudicate", response_model=AdjudicateResponse)
async def adjudicate(request: AdjudicateRequest):
    """Run the adjudication engine on provided input data.

    This endpoint runs the full 6-step adjudication pipeline:
    1. Eligibility verification
    2. Document validation
    3. Coverage verification
    4. Limit validation
    5. Medical necessity review
    6. Fraud detection
    """
    adj_input = AdjudicationInput(
        member_id=request.member_id,
        member_name=request.member_name,
        member_join_date=request.member_join_date,
        treatment_date=request.treatment_date,
        submitted_at=request.submitted_at,
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
        medical_necessity_result=request.medical_necessity_result,
        ytd_approved_amount=request.ytd_approved_amount,
        itemized_amounts=request.itemized_amounts,
    )

    decision = adjudicate_claim(adj_input)
    return AdjudicateResponse(decision=decision)
