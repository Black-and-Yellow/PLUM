"""Fraud detection service — direct port of fraudDetector.ts.

All thresholds and scoring preserved identically.
"""

from __future__ import annotations
from app.models.decision import FraudResult

SAME_DAY_CLAIM_THRESHOLD = 2
HIGH_FREQUENCY_DAYS = 30
HIGH_FREQUENCY_COUNT = 5
HIGH_VALUE_THRESHOLD = 25000
SUSPICIOUS_AMOUNT_PATTERN = 4999  # Just below per-claim limit


def compute_risk_level(score: int) -> str:
    """Compute fraud risk level from score."""
    if score <= 30:
        return "LOW"
    if score <= 70:
        return "MEDIUM"
    return "HIGH"


def analyze_fraud(
    member_id: str,
    treatment_date: str,
    claim_amount: float,
    provider_name: str,
    diagnosis: str,
    previous_claims_same_day: int = 0,
    existing_claims: list[dict] | None = None,
) -> FraudResult:
    """Analyze claim for fraud indicators.

    Args:
        existing_claims: list of claim dicts from MongoDB for historical checks.
                         Each should have member.member_id, treatment_date, provider.provider_name
    """
    flags: list[str] = []
    score = 0
    all_claims = existing_claims or []

    # ── Rule 1: Same-day multiple claims (from explicit input) ─────────
    if previous_claims_same_day >= SAME_DAY_CLAIM_THRESHOLD:
        flags.append(
            f"Multiple claims on same day ({previous_claims_same_day} previous claims on {treatment_date})"
        )
        score += 35

    # ── Rule 1b: Historical same-day lookup ────────────────────────────
    same_day_claims = [
        c for c in all_claims
        if c.get("member", {}).get("member_id") == member_id
        and c.get("treatment_date") == treatment_date
    ]
    if len(same_day_claims) >= SAME_DAY_CLAIM_THRESHOLD and previous_claims_same_day == 0:
        flags.append(
            f"Multiple claims on same day ({len(same_day_claims)} found in records)"
        )
        score += 25

    # ── Rule 2: High-frequency claims ──────────────────────────────────
    from datetime import datetime, timedelta
    try:
        treat_dt = datetime.fromisoformat(treatment_date.split("T")[0])
    except ValueError:
        treat_dt = datetime.now()

    window_start = treat_dt - timedelta(days=HIGH_FREQUENCY_DAYS)

    recent_claims = []
    for c in all_claims:
        if c.get("member", {}).get("member_id") != member_id:
            continue
        try:
            d = datetime.fromisoformat(c.get("treatment_date", "").split("T")[0])
        except ValueError:
            continue
        if window_start <= d <= treat_dt:
            recent_claims.append(c)

    if len(recent_claims) >= HIGH_FREQUENCY_COUNT:
        flags.append(
            f"Excessive claim frequency: {len(recent_claims)} claims in {HIGH_FREQUENCY_DAYS} days"
        )
        score += 25

    # ── Rule 3: High-value claim ───────────────────────────────────────
    if claim_amount > HIGH_VALUE_THRESHOLD:
        flags.append(f"High-value claim: ₹{claim_amount:,.0f}")
        score += 15

    # ── Rule 4: Suspicious amount pattern (just below limit) ──────────
    if SUSPICIOUS_AMOUNT_PATTERN <= claim_amount < 5000:
        flags.append("Suspicious amount pattern: claim just below per-claim limit")
        score += 10

    # ── Rule 5: Repeated provider pattern ──────────────────────────────
    provider_claims = [
        c for c in recent_claims
        if c.get("provider", {}).get("provider_name", "").lower() == provider_name.lower()
    ]
    if len(provider_claims) >= 3:
        flags.append(
            f"Repeated provider: {provider_name} ({len(provider_claims)} recent claims)"
        )
        score += 15

    # ── Rule 6: Unusual pattern detection (3+ same-day) ────────────────
    if previous_claims_same_day >= 3:
        flags.append("Unusual pattern detected: 3+ claims on same treatment date")
        score = min(score + 20, 100)

    clamped_score = min(score, 100)
    risk_level = compute_risk_level(clamped_score)

    return FraudResult(
        score=clamped_score,
        risk_level=risk_level,
        flags=flags,
        requires_manual_review=(
            risk_level == "HIGH" or (risk_level == "MEDIUM" and clamped_score >= 50)
        ),
    )
