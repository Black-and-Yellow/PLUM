# Adjudication Decision Flow

This document describes the complete decision logic of the Plum OPD claim adjudication engine. Every claim submitted to `POST /api/claims` or `POST /api/adjudicate` passes through this flow.

---

## High-Level Flow

```
                     ┌─────────────────────┐
                     │   CLAIM SUBMITTED   │
                     └──────────┬──────────┘
                                │
                    ┌───────────▼───────────┐
                    │  STEP 1: ELIGIBILITY  │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
        Policy               Waiting             Member
        Active?              Period OK?          Present?
            │                   │                   │
           NO                  NO                  NO
            │                   │                   │
            └────────────── REJECTED ───────────────┘
                                │
                               YES (all pass)
                                │
                    ┌───────────▼───────────┐
                    │ STEP 2: DOCUMENT      │
                    │       VALIDATION      │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
      Prescription         Bill            Doctor Reg
      Present?            Present?          Valid?
            │                   │                   │
           NO                  NO            WARNING only
            │                   │              (−0.15 conf)
            └────────── REJECTED ───┘
                                │
                               YES
                                │
                    ┌───────────▼───────────┐
                    │  STEP 3: COVERAGE     │
                    │      VERIFICATION     │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
       Excluded?           Pre-auth         Alt Medicine
       (cosmetic,          Required?         Covered?
        weight loss)           │                   │
            │                  NO                  NO
           YES                 │                   │
         ┌─┴──────┐      REJECTED             REJECTED
         │ Partial│
         │ only?  │
         │  YES   │
         │ → PARTIAL          YES                 YES
         └────────┘            │                   │
                               │                   │
                    ┌──────────▼───────────────────┐
                    │  STEP 4: FINANCIAL LIMITS    │
                    └───────────┬──────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
     Below Min           Per-Claim              Annual Limit
     (< ₹200)?          > ₹5,000?              Exceeded?
          │                     │                     │
         YES                   YES                  YES
          │                     │                     │
          └───────────── REJECTED ───────────────────┘
                                │
                               OK
                                │
                     Apply Financials:
                     ┌──────────┴──────────────┐
                     │                         │
              Network Provider?          Non-Network?
                     │                         │
              20% discount             10% co-payment
                     │                         │
                     └──────────┬──────────────┘
                                │
                    ┌───────────▼───────────┐
                    │ STEP 5: MEDICAL       │
                    │       NECESSITY       │
                    │  (Gemini optional)    │
                    └───────────┬───────────┘
                                │
                   Score ≥ 0.5? → PASS (confidence adjusted)
                   Score < 0.5? → WARNING (flag only)
                                │
                    ┌───────────▼───────────┐
                    │  STEP 6: FRAUD        │
                    │       DETECTION       │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
           LOW risk          MEDIUM            HIGH risk
              │              risk                  │
             OK                │              MANUAL_REVIEW
                        Confidence         (override if not
                        reduced             already REJECTED)
                                │
                    ┌───────────▼───────────┐
                    │  OVERALL CONFIDENCE   │
                    │  CALCULATION          │
                    └───────────┬───────────┘
                                │
                    Confidence < 70%?
                    → MANUAL_REVIEW (override)
                                │
                    ┌───────────▼───────────────────────────┐
                    │          FINAL DECISION               │
                    │                                       │
                    │  APPROVED       — all rules pass      │
                    │  PARTIAL        — cosmetic excluded   │
                    │  REJECTED       — hard rule fails     │
                    │  MANUAL_REVIEW  — fraud / low conf    │
                    └───────────────────────────────────────┘
```

---

## Step-by-Step Rule Details

### Step 1 — Eligibility Verification

| Rule ID | Rule Name | Pass Condition | Fail Code |
|---------|-----------|----------------|-----------|
| ELIG_POLICY | Policy Active Check | Treatment date within policy period | POLICY_INACTIVE |
| ELIG_WAIT | Waiting Period Check | Days since join > required waiting days | WAITING_PERIOD |
| ELIG_MEMBER | Member Verification | member_id and member_name present | MEMBER_NOT_COVERED |
| ELIG_LATE | Submission Timeline | Submitted within 30 days of treatment | LATE_SUBMISSION |

**Waiting period rules:**
- Initial waiting period: **30 days** from join date
- Pre-existing conditions (diabetes, hypertension, etc.): **90 days**
- Maternity: **180 days**

---

### Step 2 — Document Validation

| Rule ID | Rule Name | Pass Condition | Effect on Failure |
|---------|-----------|----------------|------------------|
| DOC_PRESC | Prescription Present | `has_prescription = true` | REJECTED (MISSING_DOCUMENTS) |
| DOC_BILL | Bill Present | `has_bill = true` | REJECTED (MISSING_DOCUMENTS) |
| DOC_REG | Doctor Registration | Reg. number in expected format | REJECTED if missing; WARNING if format non-standard |
| DOC_DATE | Date Consistency | Doc date == claimed treatment date | WARNING (−0.25 confidence) |
| DOC_PATIENT | Patient Name | Extracted name ≈ member name | WARNING (−0.30 confidence) |

---

### Step 3 — Coverage Verification

| Rule ID | Rule Name | Logic |
|---------|-----------|-------|
| COV_EXCL | Exclusion Check | Diagnosis/procedure in exclusion list → REJECTED; cosmetic + covered → PARTIAL |
| COV_PREAUTH | Pre-Authorization | MRI or CT Scan in procedures without prior auth → REJECTED (PRE_AUTH_MISSING) |
| COV_ALTMED | Alternative Medicine | Ayurveda/Homeopathy → check policy flag; if covered → PASS |

**Excluded treatments (from policy):**
- Cosmetic procedures (teeth whitening, rhinoplasty, etc.)
- Weight loss / obesity treatment
- Fertility treatments
- Experimental/investigational procedures

---

### Step 4 — Financial Calculations

| Rule ID | Rule Name | Threshold |
|---------|-----------|-----------|
| FIN_MIN | Minimum Claim | ₹200 |
| FIN_PERCLAIM | Per-Claim Limit | ₹5,000 (₹10,000 dental sub-limit) |
| FIN_ANNUAL | Annual Limit | ₹25,000 per policy year |
| FIN_NETWORK | Network Discount | 20% discount if network provider or cashless |
| FIN_COPAY | Co-payment | 10% patient co-pay if non-network |

**Partial approval calculation (dental):**
When cosmetic + covered dental procedures coexist:
```
cosmetic_share = cosmetic_count / (cosmetic_count + covered_count)
deduction = claimed_amount × cosmetic_share
approved = claimed_amount - deduction
```

---

### Step 5 — Medical Necessity

| Score Range | Classification | Action |
|-------------|----------------|--------|
| 0.9 – 1.0 | Clearly necessary | Full confidence |
| 0.7 – 0.9 | Likely necessary | Slight confidence reduction |
| 0.5 – 0.7 | Questionable | WARNING on rule |
| < 0.5 | Not necessary | WARNING, confidence reduction |

If Gemini API is not configured: score defaults to **1.0** (no penalty).

---

### Step 6 — Fraud Detection

| Flag | Trigger Condition | Score Impact |
|------|------------------|-------------|
| SAME_DAY_DUPLICATE | 2+ claims same day same member | +40 points |
| HIGH_FREQUENCY | 3+ claims in rolling 30 days | +25 points |
| ROUND_NUMBER | Amount is suspiciously round | +15 points |
| HIGH_VALUE | Amount > 80% of per-claim limit | +15 points |
| PROVIDER_REPEAT | Same provider 4+ times in 30 days | +20 points |
| AMOUNT_OUTLIER | Amount >> 2× average for member | +20 points |

**Risk thresholds:**
- Score 0–30: LOW — no action
- Score 31–69: MEDIUM — confidence reduced
- Score 70+: HIGH — MANUAL_REVIEW (if not already REJECTED)

---

## Confidence Score Formula

```python
weighted_confidence = (
    eligibility × 0.30 +
    documents   × 0.30 +
    coverage    × 0.20 +
    limits      × 0.10 +
    medical     × 0.10
)
```

- Each dimension starts at **1.0** (full confidence)
- Hard failures set dimension to **0.98** (high-confidence rejection)
- Warnings reduce dimension by the documented amount
- **If overall < 0.70 → status = MANUAL_REVIEW**

---

## Status Transition Diagram

```
                    ┌──────────┐
        ┌──────────▶│ SUBMITTED│
        │           └────┬─────┘
        │                │ adjudication runs
        │           ┌────▼─────────────────────────────┐
        │           │                                  │
        │    ┌──────▼──────┐              ┌────────────▼────┐
        │    │  APPROVED   │              │    REJECTED     │
        │    │  (or PARTIAL│              │                 │
        │    └──────┬──────┘              └───────┬─────────┘
        │           │                             │
        │           │ user appeals                │ user appeals
        │           ▼                             ▼
        │    ┌──────────────┐           ┌──────────────────┐
        │    │   APPEALED   │           │    APPEALED      │
        │    └──────┬───────┘           └────────┬─────────┘
        │           │                             │
        └───────────┘    officer reviews          │
                    │                             │
                    ▼                             ▼
               APPROVED                       REJECTED
                (final)                       (final)

        ┌──────────────────┐
        │  MANUAL_REVIEW   │  ──▶  officer decides  ──▶  APPROVED / REJECTED
        └──────────────────┘
```
