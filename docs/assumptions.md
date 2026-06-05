# Assumptions

## Policy Assumptions

1. **Single Policy**: The system operates with a single policy (`PLUM_OPD_2024`). Multi-policy support is not implemented.
2. **Static Policy Terms**: Policy terms are loaded from `policy_terms.json` at startup and seeded into MongoDB. Changes via the API update the in-memory policy for the current session.
3. **Effective Date**: The policy is considered active for any treatment date on or after `2024-01-01`.
4. **Copay Application**: 10% copay is applied only to non-network, non-dental claims. Dental partial claims use the sub-limit system without copay.
5. **Network Discount**: 20% discount is applied to network provider or cashless claims.

## Member Assumptions

1. **No Member Database**: Members are not pre-registered. Any `member_id` + `member_name` combination is accepted as valid.
2. **Join Date Trust**: The `member_join_date` provided in the claim is trusted for waiting period calculations.
3. **No Authentication**: The system does not authenticate users. Any user can submit claims for any member.

## Document Assumptions

1. **Document Types**: Only two document types are processed: prescriptions and bills. Diagnostic reports are accepted but not separately validated.
2. **Extraction Quality**: Gemini Vision extraction may not be 100% accurate. The system uses confidence scores to indicate extraction quality.
3. **Doctor Registration Format**: `[State]/[Number]/[Year]` or `AYUR/[State]/[Number]/[Year]` — non-standard formats generate a warning but do not cause rejection.
4. **Date Matching**: Minor date discrepancies between documents and claimed date generate warnings, not rejections.
5. **Name Matching**: First-name-based fuzzy matching is used for patient verification. Exact match is not required.

## Financial Assumptions

1. **Currency**: All amounts are in Indian Rupees (INR).
2. **Per-Claim Limit**: ₹5,000 for general claims. Dental partial claims use the dental sub-limit (₹10,000).
3. **Annual Limit**: ₹50,000 per year. YTD usage is provided by the caller (defaults to 0).
4. **Minimum Claim**: Claims below ₹500 are rejected.
5. **No Prorated Limits**: Sub-limits are not prorated by month or quarter.

## Fraud Detection Assumptions

1. **Historical Data**: Fraud detection queries existing claims in MongoDB for historical patterns.
2. **Same-Day Threshold**: 2+ claims on the same day triggers a fraud flag.
3. **Manual Review Trigger**: Fraud score ≥ 50 (MEDIUM) or risk level HIGH triggers mandatory manual review.
4. **No Real-Time Monitoring**: Fraud detection is performed at adjudication time, not continuously.

## Technical Assumptions

1. **MongoDB without Auth**: MongoDB runs without authentication for MVP simplicity.
2. **Local File Storage**: Uploaded documents are stored on the local filesystem (`./uploads/`), not in cloud storage.
3. **Single Instance**: The backend runs as a single instance. No horizontal scaling or load balancing is configured.
4. **Gemini API Optional**: The system functions without a Gemini API key — extraction is skipped, and medical necessity defaults to full confidence (1.0).
5. **No Rate Limiting**: API endpoints are not rate-limited.
6. **No Audit Retention**: Audit logs are kept indefinitely in MongoDB without automatic cleanup.

## Scope Limitations

1. **No OCR Preprocessing**: Documents are sent directly to Gemini Vision without preprocessing (deskewing, contrast enhancement, etc.).
2. **No Regional Language Support**: The system expects documents in English.
3. **No Document Forgery Detection**: The system does not analyze documents for tampering or modification.
4. **No Email/SMS Notifications**: Users are not notified of claim decisions via external channels.
5. **No Deployment CI/CD**: Docker Compose is provided for local deployment; no CI/CD pipeline is configured.
