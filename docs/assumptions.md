# Design Assumptions

This document records the key assumptions made during system design and implementation. These are intended to be discussed during the interview and revised in a production setting.

---

## Business Logic Assumptions

### Policy

| Assumption | Rationale |
|------------|-----------|
| Single policy (`PLUM_OPD_2024`) for all members | Assignment specifies one policy; multi-tenant would add policy_id to every claim |
| Policy is always active (no expiry simulation) | Demo system; production would check `policy.effective_date` and `policy.expiry_date` |
| Annual limit resets per policy year (not calendar year) | Standard insurance practice; policy year starts from join date |
| Per-claim limit applies after copay deduction | Conservative interpretation; some policies apply limits before copay |

### Waiting Periods

| Condition | Waiting Period | Source |
|-----------|---------------|--------|
| Initial (all conditions) | 30 days | `policy_terms.json` |
| Pre-existing conditions | 90 days | `policy_terms.json` — diabetes, hypertension, asthma, heart disease, cancer |
| Maternity | 180 days | `policy_terms.json` |
| Dental (basic) | 30 days | Assumed covered under general OPD |

### Financial

| Assumption | Value | Rationale |
|------------|-------|-----------|
| Minimum claim amount | ₹200 | Below this, administrative cost > benefit |
| Per-claim limit | ₹5,000 | From `policy_terms.json` |
| Annual limit | ₹25,000 | From `policy_terms.json` |
| Network provider discount | 20% | From `policy_terms.json` |
| Non-network copay | 10% | From `policy_terms.json` |
| Dental sub-limit | ₹10,000/year | From `policy_terms.json` |

### Doctor Registration

- Accepted format: `[STATE]/[NUMBER]/[YEAR]` (e.g., `KA/45678/2015`)
- Non-standard formats trigger a WARNING (−0.15 confidence) rather than rejection
- Assumption: India Medical Council registration format is uniform across states

### Fraud Detection

- Thresholds (same-day count, frequency windows, round-number detection) are heuristics based on common insurance fraud patterns — not calibrated on real data.
- In production, these would be ML-model scores calibrated on historical claim data.

---

## Technical Assumptions

### Database

| Assumption | Detail |
|------------|--------|
| MongoDB without authentication | Demo system; production needs username/password + TLS |
| No database indexes defined | Acceptable at demo scale (<1000 claims); production needs indexes on `claim_id`, `member.member_id`, `status` |
| All data in single MongoDB instance | No replica set; acceptable for demo |

### Gemini API

| Assumption | Detail |
|------------|--------|
| API is optional | System runs fully without GEMINI_API_KEY; medical necessity defaults to 1.0 |
| `gemini-2.5-flash` is always available | If the model is deprecated, update `GEMINI_MODEL` env var |
| Documents are in English | Gemini's English performance is strongest; multilingual documents may extract poorly |
| Images ≤ 10MB | File size limit enforced at upload endpoint |
| Supported MIME types | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |

### Frontend

| Assumption | Detail |
|------------|--------|
| Backend is always at `localhost:8000` | Vite proxy handles `/api/*` in dev; Nginx handles it in Docker |
| localStorage fallback for offline dev | `storageService.ts` provides local state when backend is unavailable |
| No real-time updates | Claim status is refreshed on page navigation, not via WebSockets |

### Security

| Assumption | Detail |
|------------|--------|
| No authentication required | Single-user demo; production needs JWT + RBAC |
| CORS allows all origins | `allow_origins=["*"]` for dev ease; restrict in production |
| File uploads go to local disk | Adequate for demo; production should use S3/GCS |

---

## Coverage Interpretation Decisions

These situations were ambiguous in the assignment specification and required judgment calls:

### Dental Treatment (TC002)

**Situation**: A claim includes both `Root Canal` (covered) and `Teeth Whitening` (cosmetic, excluded).

**Decision**: Issue a PARTIAL approval rather than rejecting the entire claim. The approved amount excludes the cosmetic portion, calculated by:
1. Using `itemized_amounts` if provided
2. Otherwise: proportional split by count of covered vs. excluded procedures

**Rationale**: Rejecting a partially valid claim entirely would be unfair to the claimant.

### Alternative Medicine (TC006)

**Situation**: Policy terms list Ayurveda as covered under "Alternative Medicine" but don't explicitly specify it.

**Decision**: Check `is_alternative_medicine_covered("Ayurveda")` in `policy_service.py`, which returns `True` based on the loaded policy.

### Doctor Registration Format (non-standard)

**Situation**: Some prescriptions have registration numbers in format `12345/KA/2015` (different order).

**Decision**: Accept with WARNING (−0.15 confidence) rather than hard reject. A human reviewer can verify.

### Late Submission Edge Case

**Situation**: Treatment date is today, submission is also today. Is this late?

**Decision**: 0 days elapsed < 30 days limit → NOT late. The 30-day window is inclusive of the treatment date.

---

## Known Limitations

1. **No member database** — Member verification only checks that `member_id` and `member_name` are non-empty. A real system would verify against an HR/member database.

2. **No provider network database** — Network provider check uses a hardcoded list in `policy_service.py`. Production would query a provider directory API.

3. **No duplicate claim detection** — Two identical claims (same member, same date, same amount) can both be submitted. A deduplication check on `(member_id, treatment_date, claimed_amount)` would prevent this.

4. **No email/SMS notifications** — Status changes don't trigger notifications. Production would integrate with a notification service.

5. **Annual limit is approximate** — The YTD approved amount is passed in by the frontend from local storage in fallback mode. In backend mode, it's fetched from existing approved claims — this is correct for claims in the system but doesn't account for claims made before using this system.

6. **Gemini extraction is best-effort** — For very low-quality images or handwritten documents, extraction confidence may be below 0.5. The claim would go to MANUAL_REVIEW for a human to verify the extracted fields.
