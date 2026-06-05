# Claim Adjudication Decision Flow

## Overview

Every OPD claim passes through a deterministic 6-step pipeline. Each step produces rule evaluation results that contribute to the final decision.

## Decision Flowchart

```
                    ┌──────────────────┐
                    │  Upload Documents │
                    │  (Bill + Rx)      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   AI Extraction   │
                    │  (Gemini Vision)  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
         Patient Name   Doctor Reg    Diagnosis
         Medicines      Amounts       Dates
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
              ╔══════════════════════════════╗
              ║  STEP 1: ELIGIBILITY CHECK   ║
              ╠══════════════════════════════╣
              ║  □ Policy active?            ║
              ║  □ Waiting period satisfied? ║
              ║  □ Member verified?          ║
              ║  □ Submitted within 30 days? ║
              ╚══════════════╤═══════════════╝
                             │
                    FAIL ────┤──── PASS
                    │                │
                    ▼                ▼
              REJECTED     ╔══════════════════════╗
                           ║ STEP 2: DOCUMENTS    ║
                           ╠══════════════════════╣
                           ║ □ Prescription?      ║
                           ║ □ Bill present?      ║
                           ║ □ Doctor reg valid?  ║
                           ║ □ Dates consistent?  ║
                           ║ □ Patient name match?║
                           ╚══════════╤═══════════╝
                                      │
                             FAIL ────┤──── PASS
                             │                │
                             ▼                ▼
                       REJECTED     ╔════════════════════╗
                                    ║ STEP 3: COVERAGE   ║
                                    ╠════════════════════╣
                                    ║ □ Not excluded?    ║
                                    ║ □ Pre-auth OK?     ║
                                    ║ □ Alt-med covered? ║
                                    ╚════════╤═══════════╝
                                             │
                                    FAIL ────┤──── PASS/PARTIAL
                                    │                │
                                    ▼                ▼
                              REJECTED     ╔═══════════════════╗
                                           ║ STEP 4: LIMITS    ║
                                           ╠═══════════════════╣
                                           ║ □ Min ₹500?       ║
                                           ║ □ Per-claim ₹5K?  ║
                                           ║ □ Annual ₹50K?    ║
                                           ║ □ Apply copay/    ║
                                           ║   network discount║
                                           ╚═══════╤═══════════╝
                                                    │
                                           FAIL ────┤──── PASS
                                           │                │
                                           ▼                ▼
                                     REJECTED     ╔═════════════════╗
                                                  ║ STEP 5: MEDICAL ║
                                                  ║ NECESSITY       ║
                                                  ╠═════════════════╣
                                                  ║ □ Gemini LLM    ║
                                                  ║   assessment    ║
                                                  ║ □ Score ≥ 0.5?  ║
                                                  ╚═══════╤═════════╝
                                                          │
                                                          ▼
                                                ╔═════════════════╗
                                                ║ STEP 6: FRAUD   ║
                                                ║ DETECTION       ║
                                                ╠═════════════════╣
                                                ║ □ Same-day ≥ 2? ║
                                                ║ □ High freq?    ║
                                                ║ □ High value?   ║
                                                ║ □ Suspicious $? ║
                                                ║ □ Repeated prov?║
                                                ║ □ 3+ same-day?  ║
                                                ╚═══════╤═════════╝
                                                        │
                                           ┌────────────┼────────────┐
                                           │            │            │
                                           ▼            ▼            ▼
                                     MANUAL_REVIEW  APPROVED    PARTIAL
                                     (fraud/low     (all pass)  (mixed
                                      confidence)               coverage)
```

## Decision Matrix

| Decision | Condition |
|----------|-----------|
| **APPROVED** | All 6 steps pass, confidence ≥ 70% |
| **REJECTED** | Any hard rule fails (eligibility, documents, coverage, limits) |
| **PARTIAL** | Some items covered, some excluded (e.g., dental + cosmetic) |
| **MANUAL_REVIEW** | Fraud flags detected, or confidence < 70% |

## Confidence Scoring

Weighted average of 5 dimensions:

| Dimension | Weight | High When |
|-----------|--------|-----------|
| Eligibility | 30% | Clear policy match or definitive rejection |
| Documents | 30% | All documents valid and verified |
| Coverage | 20% | Treatment clearly covered or excluded |
| Limits | 10% | Amount within limits |
| Medical | 10% | Gemini confirms medical necessity |

## Rejection Codes

| Code | Category | Trigger |
|------|----------|---------|
| `POLICY_INACTIVE` | Eligibility | Policy not active on treatment date |
| `WAITING_PERIOD` | Eligibility | Condition-specific or initial waiting period |
| `MEMBER_NOT_COVERED` | Eligibility | Member ID/name missing |
| `LATE_SUBMISSION` | Eligibility | >30 days after treatment |
| `MISSING_DOCUMENTS` | Documents | Prescription or bill missing |
| `DOCTOR_REG_INVALID` | Documents | Doctor reg number missing |
| `SERVICE_NOT_COVERED` | Coverage | Treatment in exclusions list |
| `PRE_AUTH_MISSING` | Coverage | MRI/CT without pre-authorization |
| `PER_CLAIM_EXCEEDED` | Limits | Amount > ₹5,000 per-claim limit |
| `ANNUAL_LIMIT_EXCEEDED` | Limits | YTD + claim > ₹50,000 |
| `BELOW_MIN_AMOUNT` | Limits | Claim < ₹500 minimum |
