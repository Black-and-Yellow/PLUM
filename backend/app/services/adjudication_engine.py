"""Adjudication engine — direct port of adjudicationEngine.ts (642 lines).

All rule IDs, rejection codes, confidence calculations, and decision logic
are preserved identically from the TypeScript implementation.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from app.models.decision import (
    AdjudicationDecision,
    ConfidenceBreakdown,
    FinancialBreakdown,
    FraudResult,
    MedicalNecessityResult,
    RuleEvaluationResult,
)
from app.services import policy_service
from app.services.fraud_detector import analyze_fraud


# ── Input type ────────────────────────────────────────────────────────────────

class AdjudicationInput:
    """Input data for the adjudication engine."""

    def __init__(
        self,
        member_id: str,
        member_name: str,
        member_join_date: str,
        treatment_date: str,
        submitted_at: str,
        claimed_amount: float,
        provider_name: str,
        cashless_request: bool,
        extracted_patient_name: Optional[str],
        extracted_doctor_name: Optional[str],
        extracted_doctor_reg: Optional[str],
        extracted_diagnosis: Optional[str],
        extracted_medicines: list[str],
        extracted_procedures: list[str],
        consultation_amount: float,
        pharmacy_amount: float,
        diagnostic_amount: float,
        treatment_date_from_doc: Optional[str],
        bill_date_from_doc: Optional[str],
        has_prescription: bool,
        has_bill: bool,
        previous_claims_same_day: int = 0,
        medical_necessity_result: Optional[MedicalNecessityResult] = None,
        ytd_approved_amount: float = 0,
        itemized_amounts: Optional[dict[str, float]] = None,
        existing_claims: Optional[list[dict]] = None,
    ):
        self.member_id = member_id
        self.member_name = member_name
        self.member_join_date = member_join_date
        self.treatment_date = treatment_date
        self.submitted_at = submitted_at
        self.claimed_amount = claimed_amount
        self.provider_name = provider_name
        self.cashless_request = cashless_request
        self.extracted_patient_name = extracted_patient_name
        self.extracted_doctor_name = extracted_doctor_name
        self.extracted_doctor_reg = extracted_doctor_reg
        self.extracted_diagnosis = extracted_diagnosis
        self.extracted_medicines = extracted_medicines
        self.extracted_procedures = extracted_procedures
        self.consultation_amount = consultation_amount
        self.pharmacy_amount = pharmacy_amount
        self.diagnostic_amount = diagnostic_amount
        self.treatment_date_from_doc = treatment_date_from_doc
        self.bill_date_from_doc = bill_date_from_doc
        self.has_prescription = has_prescription
        self.has_bill = has_bill
        self.previous_claims_same_day = previous_claims_same_day
        self.medical_necessity_result = medical_necessity_result
        self.ytd_approved_amount = ytd_approved_amount
        self.itemized_amounts = itemized_amounts
        self.existing_claims = existing_claims or []


# ── Helper builders ───────────────────────────────────────────────────────────

def _pass(rule_id: str, rule_name: str, step: int, reason: str) -> RuleEvaluationResult:
    return RuleEvaluationResult(rule_id=rule_id, rule_name=rule_name, step=step, result="PASS", reason=reason)


def _fail(rule_id: str, rule_name: str, step: int, reason: str, code: str) -> RuleEvaluationResult:
    return RuleEvaluationResult(rule_id=rule_id, rule_name=rule_name, step=step, result="FAIL", reason=reason, rejection_code=code)


def _warn(rule_id: str, rule_name: str, step: int, reason: str) -> RuleEvaluationResult:
    return RuleEvaluationResult(rule_id=rule_id, rule_name=rule_name, step=step, result="WARNING", reason=reason)


def _definitive_rejection_confidence() -> float:
    return 0.98


def _compute_weighted_confidence(bd: ConfidenceBreakdown) -> float:
    weights = {
        "eligibility": 0.30,
        "documents": 0.30,
        "coverage": 0.20,
        "limits": 0.10,
        "medical": 0.10,
    }
    score = (
        bd.eligibility * weights["eligibility"]
        + bd.documents * weights["documents"]
        + bd.coverage * weights["coverage"]
        + bd.limits * weights["limits"]
        + bd.medical * weights["medical"]
    )
    return round(score * 100) / 100


def _get_code_advice(code: str) -> str:
    policy = policy_service.get_policy()
    advice = {
        "MISSING_DOCUMENTS": "Please resubmit with a valid prescription from a registered doctor.",
        "INVALID_PRESCRIPTION": "Ensure the prescription includes doctor name, registration number, and diagnosis.",
        "DOCTOR_REG_INVALID": "Doctor registration number must be in format: [State]/[Number]/[Year].",
        "DATE_MISMATCH": "Ensure treatment date on prescription matches the bill date.",
        "WAITING_PERIOD": "The waiting period for this condition has not been completed. Please resubmit once eligible.",
        "PER_CLAIM_EXCEEDED": f"Claim amount exceeds the per-claim limit of ₹{policy.coverage_details.per_claim_limit:,}.",
        "ANNUAL_LIMIT_EXCEEDED": "Annual limit has been reached. No further claims can be processed this policy year.",
        "SERVICE_NOT_COVERED": "The treatment/service is not covered under your policy. Review your policy exclusions.",
        "PRE_AUTH_MISSING": "MRI/CT Scan requires pre-authorization. Please obtain approval before the procedure.",
        "BELOW_MIN_AMOUNT": f"Claim amount must be at least ₹{policy_service.get_minimum_claim_amount()}.",
    }
    return advice.get(code, f"Contact support regarding {code}.")


def _build_next_steps(status: str, rejection_codes: list[str]) -> list[str]:
    if status == "APPROVED":
        return ["Claim approved. Reimbursement will be processed within 5-7 business days."]
    if status == "PARTIAL":
        return [
            "Partial approval granted. Non-covered items have been excluded.",
            "Reimbursement for approved amount will be processed within 5-7 business days.",
            "You may appeal the decision for the rejected portion.",
        ]
    if status == "REJECTED":
        steps = [
            "Your claim has been rejected. Review the rejection reasons above.",
            "You may appeal this decision within 30 days with supporting documents.",
        ]
        steps.extend(_get_code_advice(code) for code in rejection_codes)
        return steps
    if status == "MANUAL_REVIEW":
        return [
            "Your claim has been flagged for manual review.",
            "A claims officer will review your case within 2-3 business days.",
            "You will be notified via email once the review is complete.",
        ]
    return []


def _build_notes(status: str, codes: list[str], fraud: FraudResult, inp: AdjudicationInput) -> str:
    parts: list[str] = []
    if "WAITING_PERIOD" in codes:
        wr = policy_service.get_waiting_period_result(
            inp.extracted_diagnosis or "", inp.member_join_date, inp.treatment_date
        )
        parts.append(f"Eligible from {wr['eligible_from']}.")
    if "PER_CLAIM_EXCEEDED" in codes:
        policy = policy_service.get_policy()
        parts.append(
            f"Claim amount exceeds per-claim limit of ₹{policy.coverage_details.per_claim_limit:,}."
        )
    if fraud.flags:
        parts.append(f"Fraud flags: {', '.join(fraud.flags)}.")
    if status == "MANUAL_REVIEW":
        parts.append("Claim referred to claims officer for manual review.")
    return " ".join(parts)


# ── Main Engine ───────────────────────────────────────────────────────────────

def adjudicate_claim(inp: AdjudicationInput) -> AdjudicationDecision:
    """Run the full adjudication pipeline.

    Implements 6 steps matching adjudication_rules.md exactly:
    1. Eligibility verification
    2. Document validation
    3. Coverage verification
    4. Financial calculations
    5. Medical necessity
    6. Fraud detection
    """
    rules: list[RuleEvaluationResult] = []
    rejection_reasons: list[str] = []
    rejection_codes: list[str] = []
    status = "APPROVED"
    is_partial = False

    cb = ConfidenceBreakdown(eligibility=1.0, documents=1.0, coverage=1.0, limits=1.0, medical=1.0)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 1: ELIGIBILITY VERIFICATION
    # ══════════════════════════════════════════════════════════════════════

    # 1.1 Policy Active
    if policy_service.is_policy_active(inp.treatment_date):
        rules.append(_pass("ELIG_POLICY", "Policy Active Check", 1, "Policy is active on treatment date."))
    else:
        rules.append(_fail("ELIG_POLICY", "Policy Active Check", 1, "Policy was not active on treatment date.", "POLICY_INACTIVE"))
        rejection_codes.append("POLICY_INACTIVE")
        rejection_reasons.append("Policy was not active on the treatment date.")
        cb.eligibility = _definitive_rejection_confidence()
        status = "REJECTED"

    # 1.2 Waiting Period
    waiting = policy_service.get_waiting_period_result(
        inp.extracted_diagnosis or "", inp.member_join_date, inp.treatment_date
    )
    if waiting["eligible"]:
        rules.append(_pass(
            "ELIG_WAIT", "Waiting Period Check", 1,
            f"Waiting period satisfied. {waiting['days_served']} days served out of {waiting['days_required']} required."
        ))
    else:
        rules.append(_fail(
            "ELIG_WAIT", "Waiting Period Check", 1,
            f"Waiting period not satisfied. {waiting['days_served']} days served; {waiting['days_required']} required. Eligible from {waiting['eligible_from']}.",
            "WAITING_PERIOD",
        ))
        rejection_codes.append("WAITING_PERIOD")
        wp_type = waiting["type"]
        rejection_reasons.append(
            f"{'Condition-specific' if 'specific' in wp_type else 'Initial'} waiting period not completed. Eligible from {waiting['eligible_from']}."
        )
        cb.eligibility = min(cb.eligibility, _definitive_rejection_confidence())
        status = "REJECTED"

    # 1.3 Member Verification
    if inp.member_id and inp.member_name:
        rules.append(_pass("ELIG_MEMBER", "Member Verification", 1, "Member ID and name present."))
    else:
        rules.append(_fail("ELIG_MEMBER", "Member Verification", 1, "Member ID or name is missing.", "MEMBER_NOT_COVERED"))
        rejection_codes.append("MEMBER_NOT_COVERED")
        rejection_reasons.append("Member information is incomplete or not found in policy records.")
        cb.eligibility = min(cb.eligibility, _definitive_rejection_confidence())
        status = "REJECTED"

    # 1.4 Late submission
    if policy_service.is_late_submission(inp.treatment_date, inp.submitted_at):
        rules.append(_fail("ELIG_LATE", "Submission Timeline Check", 1,
            f"Claim submitted after {policy_service.get_submission_timeline_days()}-day deadline.", "LATE_SUBMISSION"))
        rejection_codes.append("LATE_SUBMISSION")
        rejection_reasons.append("Claim submitted after the 30-day submission deadline.")
        cb.eligibility = min(cb.eligibility, 0.2)
        status = "REJECTED"
    else:
        rules.append(_pass("ELIG_LATE", "Submission Timeline Check", 1, "Claim submitted within the 30-day deadline."))

    # ══════════════════════════════════════════════════════════════════════
    # STEP 2: DOCUMENT VALIDATION
    # ══════════════════════════════════════════════════════════════════════

    # 2.1 Prescription required
    if inp.has_prescription:
        rules.append(_pass("DOC_PRESC", "Prescription Present", 2, "Prescription document has been submitted."))
    else:
        rules.append(_fail("DOC_PRESC", "Prescription Present", 2, "Prescription document is missing.", "MISSING_DOCUMENTS"))
        rejection_codes.append("MISSING_DOCUMENTS")
        rejection_reasons.append("Prescription from a registered doctor is required but not submitted.")
        cb.documents = _definitive_rejection_confidence()
        status = "REJECTED"

    # 2.2 Bill required
    if inp.has_bill:
        rules.append(_pass("DOC_BILL", "Bill Present", 2, "Medical bill has been submitted."))
    else:
        rules.append(_fail("DOC_BILL", "Bill Present", 2, "Medical bill is missing.", "MISSING_DOCUMENTS"))
        if "MISSING_DOCUMENTS" not in rejection_codes:
            rejection_codes.append("MISSING_DOCUMENTS")
            rejection_reasons.append("Medical bill/invoice is required but not submitted.")
        cb.documents = min(cb.documents, _definitive_rejection_confidence())
        status = "REJECTED"

    # 2.3 Doctor registration number
    if inp.extracted_doctor_reg:
        if policy_service.is_valid_doctor_reg(inp.extracted_doctor_reg):
            rules.append(_pass("DOC_REG", "Doctor Registration Validation", 2,
                f'Doctor registration number "{inp.extracted_doctor_reg}" is valid.'))
        else:
            rules.append(_warn("DOC_REG", "Doctor Registration Validation", 2,
                f'Doctor registration number "{inp.extracted_doctor_reg}" has non-standard format. Accepted.'))
            cb.documents = min(cb.documents, 0.85)
    elif not inp.has_prescription:
        rules.append(_warn("DOC_REG", "Doctor Registration Validation", 2, "Skipped — prescription not submitted."))
    else:
        rules.append(_fail("DOC_REG", "Doctor Registration Validation", 2,
            "Doctor registration number is missing from the prescription.", "DOCTOR_REG_INVALID"))
        rejection_codes.append("DOCTOR_REG_INVALID")
        rejection_reasons.append("Doctor's registration number must be visible on the prescription.")
        cb.documents = min(cb.documents, 0.3)
        status = "REJECTED"

    # 2.4 Date consistency
    doc_date = inp.treatment_date_from_doc or inp.bill_date_from_doc
    if doc_date:
        doc_day = doc_date.split("T")[0]
        claim_day = inp.treatment_date.split("T")[0]
        if doc_day == claim_day:
            rules.append(_pass("DOC_DATE", "Date Consistency Check", 2, "Treatment dates on documents match the claimed date."))
        else:
            rules.append(_warn("DOC_DATE", "Date Consistency Check", 2,
                f"Document date ({doc_day}) differs from claimed treatment date ({claim_day})."))
            cb.documents = min(cb.documents, 0.75)
    else:
        rules.append(_warn("DOC_DATE", "Date Consistency Check", 2, "Could not extract treatment date from documents."))
        cb.documents = min(cb.documents, 0.9)

    # 2.5 Patient name consistency
    if inp.extracted_patient_name and inp.member_name:
        extracted = inp.extracted_patient_name.lower().strip()
        member = inp.member_name.lower().strip()
        name_similar = (
            extracted.split(" ")[0] in member or member.split(" ")[0] in extracted
        )
        if name_similar:
            rules.append(_pass("DOC_PATIENT", "Patient Name Verification", 2, "Patient name matches member records."))
        else:
            rules.append(_warn("DOC_PATIENT", "Patient Name Verification", 2,
                f'Patient name on document ("{inp.extracted_patient_name}") does not closely match member name ("{inp.member_name}").'))
            cb.documents = min(cb.documents, 0.7)
    elif inp.has_prescription:
        rules.append(_warn("DOC_PATIENT", "Patient Name Verification", 2, "Could not extract patient name from documents."))
        cb.documents = min(cb.documents, 0.9)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 3: COVERAGE VERIFICATION
    # ══════════════════════════════════════════════════════════════════════

    diagnosis_text = inp.extracted_diagnosis or ""
    procedures_text = inp.extracted_procedures

    # 3.1 Detect cosmetic dental (partial scenario — TC002)
    cosmetic_dental = policy_service.has_cosmetic_dental_procedure(procedures_text)
    covered_dental = policy_service.get_covered_dental_procedures(procedures_text)

    if cosmetic_dental and covered_dental:
        rules.append(_warn("COV_EXCL", "Exclusion Check", 3,
            f"Cosmetic procedures excluded: [{', '.join(cosmetic_dental)}]. Covered: [{', '.join(covered_dental)}]."))
        is_partial = True
    else:
        exclusion_result = policy_service.is_excluded(diagnosis_text, procedures_text)
        if exclusion_result["excluded"]:
            rules.append(_fail("COV_EXCL", "Exclusion Check", 3,
                f"Treatment is excluded: {exclusion_result['reason']}.", "SERVICE_NOT_COVERED"))
            rejection_codes.append("SERVICE_NOT_COVERED")
            rejection_reasons.append(f"{exclusion_result['reason']} is excluded from coverage.")
            cb.coverage = _definitive_rejection_confidence()
            status = "REJECTED"
        else:
            rules.append(_pass("COV_EXCL", "Exclusion Check", 3, "Treatment is not in the exclusions list."))

    # 3.2 Pre-authorization requirement
    if policy_service.requires_pre_auth(procedures_text, inp.extracted_medicines):
        rules.append(_fail("COV_PREAUTH", "Pre-Authorization Check", 3,
            "MRI or CT Scan detected — pre-authorization is required but was not obtained.", "PRE_AUTH_MISSING"))
        rejection_codes.append("PRE_AUTH_MISSING")
        rejection_reasons.append("MRI/CT Scan requires pre-authorization for claims.")
        cb.coverage = min(cb.coverage, _definitive_rejection_confidence())
        status = "REJECTED"
    else:
        rules.append(_pass("COV_PREAUTH", "Pre-Authorization Check", 3, "No pre-authorization required for this treatment."))

    # 3.3 Alternative medicine check
    alt_med_keywords = ["ayurveda", "ayurvedic", "homeopathy", "unani", "panchakarma", "vaidya"]
    diag_lower = diagnosis_text.lower()
    proc_lower = " ".join(procedures_text).lower()
    doctor_lower = (inp.extracted_doctor_name or "").lower()
    is_alt_med = any(k in diag_lower or k in proc_lower or k in doctor_lower for k in alt_med_keywords)

    if is_alt_med:
        if policy_service.is_alternative_medicine_covered("Ayurveda"):
            rules.append(_pass("COV_ALTMED", "Alternative Medicine Coverage", 3,
                "Alternative medicine treatment is covered under policy."))
        else:
            rules.append(_fail("COV_ALTMED", "Alternative Medicine Coverage", 3,
                "This alternative medicine treatment is not covered.", "SERVICE_NOT_COVERED"))
            if "SERVICE_NOT_COVERED" not in rejection_codes:
                rejection_codes.append("SERVICE_NOT_COVERED")
                rejection_reasons.append("Alternative medicine treatment not covered under policy.")
            status = "REJECTED"

    # ══════════════════════════════════════════════════════════════════════
    # STEP 4: FINANCIAL CALCULATIONS
    # ══════════════════════════════════════════════════════════════════════

    is_network = policy_service.is_network_provider(inp.provider_name) or inp.cashless_request

    # 4a. Compute base approved amount
    base_approved_amount = inp.claimed_amount
    partial_deduction = 0

    if is_partial and cosmetic_dental and covered_dental:
        if inp.itemized_amounts:
            cosmetic_total = 0
            for proc in cosmetic_dental:
                proc_lc = proc.lower()
                for k, v in inp.itemized_amounts.items():
                    if k.lower() == proc_lc or proc_lc in k.lower() or k.lower() in proc_lc:
                        cosmetic_total += v
                        break
            partial_deduction = cosmetic_total if cosmetic_total > 0 else round(
                inp.claimed_amount * (len(cosmetic_dental) / (len(cosmetic_dental) + len(covered_dental)))
            )
        else:
            total_procs = len(cosmetic_dental) + len(covered_dental)
            partial_deduction = round(inp.claimed_amount * (len(cosmetic_dental) / total_procs))

        base_approved_amount = inp.claimed_amount - partial_deduction
        rules.append(_warn("FIN_PARTIAL", "Partial Coverage Calculation", 4,
            f"Cosmetic procedures ({', '.join(cosmetic_dental)}) excluded: ₹{partial_deduction}. Covered base: ₹{base_approved_amount}."))

    # 4.1 Minimum claim threshold
    if inp.claimed_amount < policy_service.get_minimum_claim_amount():
        rules.append(_fail("FIN_MIN", "Minimum Claim Threshold", 4,
            f"Claim ₹{inp.claimed_amount} is below minimum ₹{policy_service.get_minimum_claim_amount()}.", "BELOW_MIN_AMOUNT"))
        rejection_codes.append("BELOW_MIN_AMOUNT")
        rejection_reasons.append(
            f"Claim amount ₹{inp.claimed_amount} is below the minimum threshold of ₹{policy_service.get_minimum_claim_amount()}."
        )
        cb.limits = 0.05
        status = "REJECTED"
    else:
        rules.append(_pass("FIN_MIN", "Minimum Claim Threshold", 4,
            f"Claim amount ₹{inp.claimed_amount} meets the minimum threshold."))

    # 4.2 Per-claim limit
    is_dental_partial = is_partial and len(covered_dental) > 0
    amount_to_check = base_approved_amount if is_partial else inp.claimed_amount
    per_claim_limit = (
        policy_service.get_sub_limit("dental") if is_dental_partial
        else policy_service.get_policy().coverage_details.per_claim_limit
    )

    within_per_claim = amount_to_check <= per_claim_limit
    if not within_per_claim:
        limit_label = "dental sub-" if is_dental_partial else "per-claim "
        rules.append(_fail("FIN_PERCLAIM", "Per-Claim Limit Check", 4,
            f"Amount ₹{amount_to_check} exceeds {limit_label}limit ₹{per_claim_limit}.", "PER_CLAIM_EXCEEDED"))
        rejection_codes.append("PER_CLAIM_EXCEEDED")
        rejection_reasons.append(
            f"Amount ₹{amount_to_check} exceeds the {'dental sub-limit' if is_dental_partial else 'per-claim limit'} of ₹{per_claim_limit:,}."
        )
        cb.limits = min(cb.limits, _definitive_rejection_confidence())
        if not is_partial:
            status = "REJECTED"
    else:
        rules.append(_pass("FIN_PERCLAIM", "Per-Claim Limit Check", 4,
            f"Amount ₹{amount_to_check} is within {('dental sub-' if is_dental_partial else 'per-claim ')}limit of ₹{per_claim_limit}."))

    # 4.3 Annual limit
    ytd = inp.ytd_approved_amount
    within_annual = policy_service.is_within_annual_limit(ytd, amount_to_check)
    if not within_annual:
        rules.append(_fail("FIN_ANNUAL", "Annual Limit Check", 4,
            f"YTD ₹{ytd} + claim ₹{amount_to_check} exceeds annual limit ₹{policy_service.get_policy().coverage_details.annual_limit}.",
            "ANNUAL_LIMIT_EXCEEDED"))
        rejection_codes.append("ANNUAL_LIMIT_EXCEEDED")
        rejection_reasons.append("Annual coverage limit has been reached.")
        cb.limits = min(cb.limits, 0.05)
        status = "REJECTED"
    else:
        rules.append(_pass("FIN_ANNUAL", "Annual Limit Check", 4,
            f"Annual limit OK. YTD: ₹{ytd}, remaining: ₹{policy_service.get_policy().coverage_details.annual_limit - ytd}."))

    # 4.4 Apply network discount OR copay
    approved_amount = base_approved_amount
    copay_amount = 0
    network_discount_amount = 0

    should_apply_financials = status == "APPROVED" or is_partial
    if should_apply_financials:
        if is_network:
            discount = policy_service.apply_network_discount(approved_amount, True)
            network_discount_amount = discount["discount_amount"]
            approved_amount = discount["payable_amount"]
            rules.append(_pass("FIN_NETWORK", "Network Provider Discount", 4,
                f"Network provider: 20% discount applied. Discount: ₹{network_discount_amount}. Approved: ₹{approved_amount}."))
        elif not is_dental_partial:
            copay_result = policy_service.apply_copay(approved_amount, False)
            copay_amount = copay_result["copay_amount"]
            approved_amount = copay_result["payable_amount"]
            rules.append(_pass("FIN_COPAY", "Co-payment Calculation", 4,
                f"10% co-payment applied. Copay: ₹{copay_amount}. Approved: ₹{approved_amount}."))
        else:
            rules.append(_pass("FIN_COPAY", "Co-payment Calculation", 4,
                "Dental sub-limit applies — no co-payment required on covered dental procedures."))

    financial_breakdown = FinancialBreakdown(
        claimed_amount=inp.claimed_amount,
        consultation_claimed=inp.consultation_amount,
        pharmacy_claimed=inp.pharmacy_amount,
        diagnostic_claimed=inp.diagnostic_amount,
        copay_amount=copay_amount,
        copay_percentage=0 if is_network else 10,
        network_discount=network_discount_amount,
        sublimit_deductions=partial_deduction,
        approved_amount=approved_amount,
    )

    # ══════════════════════════════════════════════════════════════════════
    # STEP 5: MEDICAL NECESSITY
    # ══════════════════════════════════════════════════════════════════════

    has_medical_result = inp.medical_necessity_result is not None
    med_score = inp.medical_necessity_result.score if has_medical_result else 1.0
    med_reasoning = (
        inp.medical_necessity_result.reasoning if has_medical_result
        else "Medical necessity not assessed (Gemini API not configured). Full confidence assumed."
    )

    rules.append(RuleEvaluationResult(
        rule_id="MED_NEC", rule_name="Medical Necessity Review", step=5,
        result="PASS" if med_score >= 0.5 else "WARNING",
        reason=med_reasoning,
    ))

    if has_medical_result:
        cb.medical = med_score

    # ══════════════════════════════════════════════════════════════════════
    # STEP 6: FRAUD DETECTION
    # ══════════════════════════════════════════════════════════════════════

    fraud_result: FraudResult = analyze_fraud(
        member_id=inp.member_id,
        treatment_date=inp.treatment_date,
        claim_amount=inp.claimed_amount,
        provider_name=inp.provider_name,
        diagnosis=inp.extracted_diagnosis or "",
        previous_claims_same_day=inp.previous_claims_same_day,
        existing_claims=inp.existing_claims,
    )

    if fraud_result.flags:
        rules.append(_warn("FRAUD", "Fraud Detection", 6,
            f"Fraud indicators detected: {'; '.join(fraud_result.flags)} (score: {fraud_result.score})"))

        if fraud_result.risk_level == "HIGH":
            cb.eligibility = min(cb.eligibility, 0.4)
            cb.documents = min(cb.documents, 0.4)
            cb.coverage = min(cb.coverage, 0.4)
        elif fraud_result.risk_level == "MEDIUM":
            reduction = 0.10 + ((fraud_result.score - 31) / 39) * 0.50
            cb.eligibility = min(cb.eligibility, 1.0 - reduction)
            cb.documents = min(cb.documents, 1.0 - reduction)
            cb.coverage = min(cb.coverage, 1.0 - reduction * 0.5)
    else:
        rules.append(_pass("FRAUD", "Fraud Detection", 6,
            f"No fraud indicators detected. Risk score: {fraud_result.score}."))

    # Fraud override: only override non-rejected claims
    if fraud_result.requires_manual_review and status != "REJECTED":
        status = "MANUAL_REVIEW"

    # ══════════════════════════════════════════════════════════════════════
    # FINALIZE DECISION
    # ══════════════════════════════════════════════════════════════════════

    if is_partial and status == "APPROVED":
        status = "PARTIAL"

    overall_conf = _compute_weighted_confidence(cb)

    # Low confidence escalation
    if overall_conf < 0.7 and status not in ("REJECTED", "MANUAL_REVIEW"):
        status = "MANUAL_REVIEW"
        rules.append(_warn("CONF_LOW", "Confidence Threshold Check", 6,
            f"Overall confidence {overall_conf * 100:.0f}% is below 70%. Escalating to manual review."))

    final_approved = financial_breakdown.approved_amount if status in ("APPROVED", "PARTIAL") else 0

    return AdjudicationDecision(
        status=status,
        claimed_amount=inp.claimed_amount,
        approved_amount=final_approved,
        copay_amount=financial_breakdown.copay_amount,
        network_discount=financial_breakdown.network_discount,
        rejection_reasons=rejection_reasons,
        rejection_codes=rejection_codes,
        confidence=overall_conf,
        confidence_breakdown=cb,
        fraud_score=fraud_result.score,
        fraud_risk=fraud_result.risk_level,
        fraud_flags=fraud_result.flags,
        rule_evaluations=rules,
        financial_breakdown=financial_breakdown,
        medical_necessity_score=med_score,
        medical_necessity_reasoning=med_reasoning,
        next_steps=_build_next_steps(status, rejection_codes),
        notes=_build_notes(status, rejection_codes, fraud_result, inp),
        processed_at=datetime.now().isoformat(),
    )
