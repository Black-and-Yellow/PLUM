"""Policy service — direct port of policyService.ts.

All business logic, thresholds, and rules preserved identically.
"""

from __future__ import annotations
import re
from datetime import datetime, timedelta
from app.models.policy import PolicyTerms

# ── Singleton policy instance ───────────────────────────────────────────────
_policy = PolicyTerms()

# ── Diagnosis keywords → specific ailment waiting periods ───────────────────
SPECIFIC_AILMENT_KEYWORDS: dict[str, str] = {
    "diabetes": "diabetes",
    "type 2 diabetes": "diabetes",
    "type 1 diabetes": "diabetes",
    "diabetic": "diabetes",
    "hypertension": "hypertension",
    "high blood pressure": "hypertension",
    "joint replacement": "joint_replacement",
    "knee replacement": "joint_replacement",
    "hip replacement": "joint_replacement",
}

# ── Exclusion keyword matchers ──────────────────────────────────────────────
EXCLUSION_KEYWORDS: dict[str, list[str]] = {
    "Cosmetic procedures": ["cosmetic", "whitening", "teeth whitening", "botox", "facelift", "liposuction", "rhinoplasty"],
    "Weight loss treatments": ["weight loss", "obesity", "bariatric", "diet plan", "slimming"],
    "Infertility treatments": ["infertility", "ivf", "iui", "surrogacy"],
    "Experimental treatments": ["experimental", "clinical trial", "unproven"],
    "Self-inflicted injuries": ["self-inflicted", "self harm"],
    "Adventure sports injuries": ["adventure sports", "skydiving", "bungee"],
    "HIV/AIDS treatment": ["hiv", "aids"],
    "Alcoholism/drug abuse treatment": ["alcoholism", "drug abuse", "detox"],
}

# Pre-auth required tests
PRE_AUTH_TESTS = ["mri", "ct scan", "ct-scan", "magnetic resonance"]

# Doctor registration format: [State]/[Number]/[Year] or AYUR/[State]/[Number]/[Year]
DOCTOR_REG_REGEX = re.compile(r"^([A-Z]+/)?[A-Z]{2,4}/\d+/\d{4}$", re.IGNORECASE)


def get_policy() -> PolicyTerms:
    """Get current policy terms."""
    return _policy


def set_policy(policy: PolicyTerms) -> None:
    """Update policy terms."""
    global _policy
    _policy = policy


def get_default_policy_dict() -> dict:
    """Get default policy as a dictionary (for MongoDB seeding)."""
    return PolicyTerms().model_dump()


def is_policy_active(treatment_date: str) -> bool:
    """Check if policy was active on the treatment date."""
    effective = datetime.fromisoformat(_policy.effective_date)
    treatment = datetime.fromisoformat(treatment_date.split("T")[0])
    return treatment >= effective


def get_waiting_period_result(
    diagnosis: str, member_join_date: str, treatment_date: str
) -> dict:
    """Check waiting period eligibility. Returns dict with days_required, days_served, eligible, type, eligible_from."""
    join = datetime.fromisoformat(member_join_date.split("T")[0])
    treatment = datetime.fromisoformat(treatment_date.split("T")[0])
    days_served = (treatment - join).days
    diag_lower = diagnosis.lower()

    # Check specific ailment waiting periods first
    for keyword, ailment in SPECIFIC_AILMENT_KEYWORDS.items():
        if keyword in diag_lower:
            ailment_periods = _policy.waiting_periods.specific_ailments
            days_required = getattr(ailment_periods, ailment, 30)
            eligible_from = join + timedelta(days=days_required)
            return {
                "days_required": days_required,
                "days_served": days_served,
                "eligible": days_served >= days_required,
                "type": f"specific_ailment:{ailment}",
                "eligible_from": eligible_from.strftime("%Y-%m-%d"),
            }

    # Initial waiting period
    initial_days = _policy.waiting_periods.initial_waiting
    eligible_from = join + timedelta(days=initial_days)
    return {
        "days_required": initial_days,
        "days_served": days_served,
        "eligible": days_served >= initial_days,
        "type": "initial_waiting",
        "eligible_from": eligible_from.strftime("%Y-%m-%d"),
    }


def is_excluded(diagnosis: str, procedures: list[str], treatment: str = "") -> dict:
    """Check if treatment is excluded. Returns {excluded: bool, reason: str}."""
    diag_lower = diagnosis.lower()
    proc_text = " ".join(procedures).lower()
    treat_text = treatment.lower()
    combined = f"{diag_lower} {proc_text} {treat_text}"

    for exclusion, keywords in EXCLUSION_KEYWORDS.items():
        for kw in keywords:
            if kw in combined:
                return {"excluded": True, "reason": exclusion}
    return {"excluded": False, "reason": ""}


def get_sub_limit(category: str) -> int:
    """Get sub-limit for a coverage category."""
    cd = _policy.coverage_details
    section = getattr(cd, category, None)
    if section is None:
        return cd.per_claim_limit
    if hasattr(section, "sub_limit") and section.sub_limit:
        return section.sub_limit
    if hasattr(section, "max_amount") and section.max_amount:
        return section.max_amount
    return cd.per_claim_limit


def is_within_annual_limit(ytd_amount: float, claim_amount: float) -> bool:
    """Check if claim is within annual limit."""
    return ytd_amount + claim_amount <= _policy.coverage_details.annual_limit


def is_within_per_claim_limit(amount: float) -> bool:
    """Check if amount is within per-claim limit."""
    return amount <= _policy.coverage_details.per_claim_limit


def apply_copay(amount: float, is_network: bool) -> dict:
    """Apply co-payment. Returns {copay_amount, payable_amount}."""
    if is_network:
        return {"copay_amount": 0, "payable_amount": amount}
    copay_pct = _policy.coverage_details.consultation_fees.copay_percentage or 10
    copay_amount = round(amount * (copay_pct / 100))
    return {"copay_amount": copay_amount, "payable_amount": amount - copay_amount}


def apply_network_discount(amount: float, is_network: bool) -> dict:
    """Apply network discount. Returns {discount_amount, payable_amount}."""
    if not is_network:
        return {"discount_amount": 0, "payable_amount": amount}
    discount_pct = _policy.coverage_details.consultation_fees.network_discount or 20
    discount_amount = round(amount * (discount_pct / 100))
    return {"discount_amount": discount_amount, "payable_amount": amount - discount_amount}


def requires_pre_auth(procedures: list[str], tests: list[str]) -> bool:
    """Check if any procedure/test requires pre-authorization."""
    combined = " ".join(procedures + tests).lower()
    return any(t in combined for t in PRE_AUTH_TESTS)


def is_network_provider(provider_name: str) -> bool:
    """Check if provider is in network."""
    lower = provider_name.lower()
    return any(
        lower in h.lower() or h.lower() in lower
        for h in _policy.network_hospitals
    )


def is_valid_doctor_reg(reg_number: str) -> bool:
    """Validate doctor registration number format."""
    return bool(DOCTOR_REG_REGEX.match(reg_number.strip()))


def get_minimum_claim_amount() -> int:
    """Get minimum claim amount threshold."""
    return _policy.claim_requirements.minimum_claim_amount


def get_submission_timeline_days() -> int:
    """Get submission timeline in days."""
    return _policy.claim_requirements.submission_timeline_days


def is_late_submission(treatment_date: str, submission_date: str) -> bool:
    """Check if claim was submitted after the deadline."""
    treatment = datetime.fromisoformat(treatment_date.split("T")[0])
    submission = datetime.fromisoformat(submission_date.split("T")[0])
    diff_days = (submission - treatment).days
    return diff_days > _policy.claim_requirements.submission_timeline_days


def has_cosmetic_dental_procedure(procedures: list[str]) -> list[str]:
    """Detect cosmetic dental procedures."""
    cosmetic_keywords = ["whitening", "cosmetic", "veneer", "aesthetic", "teeth whitening"]
    return [p for p in procedures if any(k in p.lower() for k in cosmetic_keywords)]


def get_covered_dental_procedures(procedures: list[str]) -> list[str]:
    """Get covered dental procedures from list."""
    covered = _policy.coverage_details.dental.procedures_covered or []
    return [p for p in procedures if any(c.lower() in p.lower() for c in covered)]


def is_alternative_medicine_covered(treatment: str) -> bool:
    """Check if alternative medicine treatment is covered."""
    covered = _policy.coverage_details.alternative_medicine.covered_treatments or []
    lower = treatment.lower()
    return any(t.lower() in lower for t in covered)
