"""Decision Explainer Service.

Converts a raw AdjudicationDecision into a human-readable, structured
explanation suitable for display in the UI and discussion in interviews.

Design goals:
- Works without Gemini (pure rule-based explanation from decision data)
- Optionally enhances with Gemini for natural-language narrative
- Never crashes: always returns a usable explanation
"""

from __future__ import annotations
from typing import Optional

from app.models.decision import AdjudicationDecision


# ── Status display helpers ───────────────────────────────────────────────────

_STATUS_LABELS = {
    "APPROVED": "✅ Claim Approved",
    "PARTIAL": "⚠️ Claim Partially Approved",
    "REJECTED": "❌ Claim Rejected",
    "MANUAL_REVIEW": "🔍 Referred for Manual Review",
    "APPEALED": "📋 Appeal Under Review",
}

_STEP_NAMES = {
    1: "Eligibility Verification",
    2: "Document Validation",
    3: "Coverage Verification",
    4: "Financial Calculations",
    5: "Medical Necessity Review",
    6: "Fraud Detection",
}


def _result_icon(result: str) -> str:
    return {"PASS": "✓", "FAIL": "✗", "WARNING": "⚠", "SKIP": "—"}.get(result, "•")


def explain_decision(decision: AdjudicationDecision, claim_id: str = "") -> dict:
    """Generate a structured, human-readable explanation for an adjudication decision.

    Returns a dict with:
    - title: short summary line
    - status: decision status string
    - summary: one-paragraph narrative
    - steps: list of step-level explanation dicts
    - key_factors: bullet list of the most important factors
    - financial_summary: plain-English financial breakdown
    - recommendation: what the claimant should do next
    """
    status = decision.status
    title = _STATUS_LABELS.get(status, f"Decision: {status}")

    # ── Build step-level summaries ───────────────────────────────────────────
    steps_by_num: dict[int, list] = {}
    for rule in decision.rule_evaluations:
        n = rule.step
        steps_by_num.setdefault(n, []).append(rule)

    step_explanations = []
    for step_num in sorted(steps_by_num.keys()):
        rules = steps_by_num[step_num]
        step_name = _STEP_NAMES.get(step_num, f"Step {step_num}")
        passes = sum(1 for r in rules if r.result == "PASS")
        fails = sum(1 for r in rules if r.result == "FAIL")
        warns = sum(1 for r in rules if r.result == "WARNING")

        if fails > 0:
            step_status = "FAIL"
        elif warns > 0:
            step_status = "WARNING"
        else:
            step_status = "PASS"

        checks = [
            {
                "icon": _result_icon(r.result),
                "name": r.rule_name,
                "result": r.result,
                "reason": r.reason,
                "code": r.rejection_code,
            }
            for r in rules
        ]

        step_explanations.append({
            "step": step_num,
            "name": step_name,
            "status": step_status,
            "passes": passes,
            "fails": fails,
            "warnings": warns,
            "checks": checks,
        })

    # ── Key factors ──────────────────────────────────────────────────────────
    key_factors = []

    failed_rules = [r for r in decision.rule_evaluations if r.result == "FAIL"]
    warn_rules = [r for r in decision.rule_evaluations if r.result == "WARNING"]

    if status == "APPROVED":
        key_factors.append("Policy is active on the treatment date.")
        key_factors.append("All required documents (prescription + bill) were submitted.")
        key_factors.append("Treatment is covered under the policy.")
        key_factors.append(f"Claim amount ₹{decision.claimed_amount:,.0f} is within coverage limits.")
        if decision.fraud_flags:
            key_factors.append(f"Fraud risk: {decision.fraud_risk} — no manual review required.")
        else:
            key_factors.append("No fraud indicators detected.")
        if decision.medical_necessity_score and decision.medical_necessity_score >= 0.7:
            key_factors.append("Treatment is medically necessary.")

    elif status == "PARTIAL":
        key_factors.append("Claim is partially approved — some items are excluded.")
        for r in warn_rules:
            if "cosmetic" in r.reason.lower() or "exclusion" in r.reason.lower():
                key_factors.append(f"Excluded items: {r.reason}")
        key_factors.append(f"Approved amount: ₹{decision.approved_amount:,.0f}")

    elif status == "REJECTED":
        for r in failed_rules:
            key_factors.append(f"✗ {r.rule_name}: {r.reason}")
        if decision.rejection_codes:
            key_factors.append(f"Rejection code(s): {', '.join(decision.rejection_codes)}")

    elif status == "MANUAL_REVIEW":
        if decision.fraud_flags:
            key_factors.append(f"Fraud indicators: {', '.join(decision.fraud_flags)}")
        conf_pct = round(decision.confidence * 100)
        if conf_pct < 70:
            key_factors.append(f"Confidence score ({conf_pct}%) is below the 70% auto-approval threshold.")
        key_factors.append("A claims officer will review this case within 2–3 business days.")

    # ── Financial summary ────────────────────────────────────────────────────
    fb = decision.financial_breakdown
    financial_lines = [f"Claimed amount: ₹{fb.claimed_amount:,.0f}"]

    if fb.sublimit_deductions and fb.sublimit_deductions > 0:
        financial_lines.append(f"Excluded (non-covered items): −₹{fb.sublimit_deductions:,.0f}")

    if fb.copay_amount and fb.copay_amount > 0:
        financial_lines.append(
            f"Co-payment ({fb.copay_percentage}%): −₹{fb.copay_amount:,.0f}"
        )

    if fb.network_discount and fb.network_discount > 0:
        financial_lines.append(f"Network provider discount (20%): −₹{fb.network_discount:,.0f}")

    if status in ("APPROVED", "PARTIAL"):
        financial_lines.append(f"Approved amount: ₹{decision.approved_amount:,.0f}")
    else:
        financial_lines.append("Approved amount: ₹0 (claim not approved)")

    # ── Summary narrative ────────────────────────────────────────────────────
    conf_pct = round(decision.confidence * 100)
    if status == "APPROVED":
        summary = (
            f"This claim has been approved with a confidence score of {conf_pct}%. "
            f"The adjudication engine evaluated {len(decision.rule_evaluations)} rules across "
            f"6 steps covering eligibility, documents, coverage, financial limits, medical necessity, "
            f"and fraud detection. All critical checks passed."
        )
    elif status == "PARTIAL":
        summary = (
            f"This claim has been partially approved. Certain procedures or treatments "
            f"fall outside policy coverage and have been excluded from reimbursement. "
            f"The confidence score is {conf_pct}%."
        )
    elif status == "REJECTED":
        reasons_str = "; ".join(decision.rejection_reasons[:3]) if decision.rejection_reasons else "policy rules"
        summary = (
            f"This claim has been rejected due to: {reasons_str}. "
            f"You may appeal this decision within 30 days by submitting supporting documentation."
        )
    elif status == "MANUAL_REVIEW":
        summary = (
            f"This claim has been escalated for manual review. "
            f"The system confidence score ({conf_pct}%) did not meet the 70% threshold for "
            f"automated approval, or fraud indicators were detected. "
            f"A claims officer will make the final decision within 2–3 business days."
        )
    else:
        summary = f"Claim status: {status}. Confidence: {conf_pct}%."

    # ── Recommendation ───────────────────────────────────────────────────────
    if decision.next_steps:
        recommendation = decision.next_steps[0]
    elif status == "APPROVED":
        recommendation = "No action needed. Reimbursement will be processed within 5–7 business days."
    elif status == "REJECTED":
        recommendation = "Review the rejection reasons above and consider filing an appeal within 30 days."
    else:
        recommendation = "No immediate action required."

    return {
        "claim_id": claim_id,
        "title": title,
        "status": status,
        "confidence_percent": conf_pct,
        "summary": summary,
        "steps": step_explanations,
        "key_factors": key_factors,
        "financial_summary": financial_lines,
        "recommendation": recommendation,
        "fraud_risk": decision.fraud_risk,
        "fraud_flags": decision.fraud_flags,
        "next_steps": decision.next_steps,
    }
