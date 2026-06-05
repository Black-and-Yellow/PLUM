# System Architecture

## Overview

The Plum OPD Claim Adjudication Tool follows a **clean three-tier architecture** — React frontend, FastAPI backend, MongoDB database — with an optional Google Gemini integration for AI-powered document extraction and medical necessity assessment.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend (Port 3000)                        │   │
│  │                                                                      │   │
│  │  Dashboard    SubmitClaim    ClaimDetails    PolicyAdmin    Settings  │   │
│  │      │             │              │               │            │     │   │
│  │      └─────────────┴──────────────┴───────────────┴────────────┘    │   │
│  │                              │                                       │   │
│  │                    apiService.ts (REST client)                       │   │
│  │                    storageService.ts (localStorage fallback)         │   │
│  └──────────────────────────────┬───────────────────────────────────────┘   │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │  HTTP REST API  (/api/*)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                   FastAPI Backend (Port 8000)                        │   │
│  │                                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ /claims  │ │/adjudic- │ │/extract  │ │/explain- │ │/policies │  │   │
│  │  │   CRUD   │ │  ate     │ │          │ │ decision │ │          │  │   │
│  │  └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┘  │   │
│  │        │           │             │             │                      │   │
│  │  ┌─────▼───────────▼─────────────▼─────────────▼───────────────┐    │   │
│  │  │                     Service Layer                             │    │   │
│  │  │                                                               │    │   │
│  │  │  adjudication_engine.py   — 6-step rule evaluation           │    │   │
│  │  │  fraud_detector.py        — 6-rule fraud scoring             │    │   │
│  │  │  document_extractor.py    — Gemini Vision + retry            │    │   │
│  │  │  decision_explainer.py    — human-readable explanations      │    │   │
│  │  │  policy_service.py        — coverage rules and limits        │    │   │
│  │  │  audit_service.py         — event audit logging              │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────┬───────────────────┘
                                │                          │
                                ▼                          ▼
┌──────────────────────┐  ┌─────────────────────────────────────────────────────┐
│    DATA LAYER        │  │                 EXTERNAL SERVICES                    │
│                      │  │                                                      │
│  MongoDB 7           │  │  Google Gemini 2.5 Flash                            │
│  Motor async driver  │  │                                                      │
│  Port 27017          │  │  ┌─────────────────┐  ┌────────────────────────┐   │
│                      │  │  │ Vision API      │  │ Text/LLM API           │   │
│  Collections:        │  │  │ Image → JSON    │  │ Medical necessity eval  │   │
│  • claims            │  │  │ (prescription,  │  │ Diagnosis vs. treatment │   │
│  • policies          │  │  │  bills, reports)│  │ score: 0.0 – 1.0       │   │
│  • audit_logs        │  │  └─────────────────┘  └────────────────────────┘   │
│                      │  │                                                      │
└──────────────────────┘  └─────────────────────────────────────────────────────┘
```

---

## Request Flow — Claim Submission

```
User fills form → SubmitClaim.tsx
       │
       │  POST /api/claims  (JSON payload)
       ▼
claims.py (FastAPI router)
       │
       ├─→ document_extractor.py → Gemini API (if GEMINI_API_KEY set)
       │      └─ assess_medical_necessity(diagnosis, medicines, procedures)
       │
       ├─→ db.claims.find() → fetch existing claims (fraud historical context)
       │
       ├─→ adjudication_engine.adjudicate_claim(input)
       │      ├─ Step 1: policy_service (policy active, waiting period, member)
       │      ├─ Step 2: document validation (prescription, bill, doctor reg)
       │      ├─ Step 3: policy_service (exclusions, pre-auth, alt medicine)
       │      ├─ Step 4: financial (min/max limits, copay/network discount)
       │      ├─ Step 5: medical necessity (Gemini score or default 1.0)
       │      └─ Step 6: fraud_detector.analyze_fraud()
       │
       ├─→ db.claims.insert_one(claim_doc)
       │
       └─→ audit_service.log_event("claim_created", ...)
              │
              ▼
       Response: ClaimResponse (full claim + decision JSON)
```

---

## Data Models

### Claim (MongoDB document)

```python
{
  "claim_id": "CLM-XXXXXX-XXXX",
  "status": "APPROVED | PARTIAL | REJECTED | MANUAL_REVIEW | APPEALED",
  "submitted_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "member": { "member_id", "member_name", "member_join_date", "relationship" },
  "provider": { "provider_name", "is_network_provider", "cashless_request" },
  "treatment_date": "ISO-8601",
  "claimed_amount": 1500.0,
  "documents": [ClaimDocument],       # uploaded file metadata
  "decision": AdjudicationDecision,   # full 6-step result
  "appeals": [Appeal],
  "timeline": [ClaimTimelineEvent]
}
```

### AdjudicationDecision

```python
{
  "status": "APPROVED",
  "claimed_amount": 1500.0,
  "approved_amount": 1350.0,
  "copay_amount": 150.0,
  "network_discount": 0.0,
  "confidence": 0.88,
  "confidence_breakdown": { "eligibility": 1.0, "documents": 1.0, ... },
  "fraud_score": 0,
  "fraud_risk": "LOW",
  "fraud_flags": [],
  "rule_evaluations": [RuleEvaluationResult, ...],   # one per rule checked
  "financial_breakdown": FinancialBreakdown,
  "medical_necessity_score": 0.9,
  "rejection_reasons": [],
  "rejection_codes": [],
  "next_steps": ["Reimbursement within 5-7 business days."],
  "notes": "",
  "processed_at": "ISO-8601"
}
```

---

## Confidence Score Calculation

Each dimension is scored 0.0–1.0, weighted, and combined:

| Dimension | Weight | Reduced When |
|-----------|--------|--------------|
| Eligibility | 30% | Policy inactive, waiting period, member missing, late submission |
| Documents | 30% | Missing prescription/bill, invalid doctor reg, date mismatch |
| Coverage | 20% | Excluded treatment, pre-auth missing |
| Limits | 10% | Below minimum, per-claim or annual limit exceeded |
| Medical | 10% | Gemini medical necessity score < 0.8 |

**Overall confidence < 70% → escalates to `MANUAL_REVIEW`** regardless of rule outcomes.

---

## Gemini Integration

### Document Extraction (Vision API)

- Model: `gemini-2.5-flash`
- Input: base64-encoded image/PDF
- Output: structured JSON (patientName, diagnosis, medicines, amounts, etc.)
- Reliability features:
  - `response_mime_type: "application/json"` (structured output mode)
  - 3 retry attempts with exponential backoff (1s → 2s → 4s)
  - 30-second timeout per attempt
  - Robust code-fence stripping (handles ```json``` wrappers)
  - On failure: returns `confidence: 0.1` → claim routes to MANUAL_REVIEW

### Medical Necessity (Text/LLM API)

- Input: diagnosis + medicines + procedures (text)
- Output: `{ score: 0–1, reasoning: "..." }`
- Fallback: score = 0.8 if API unavailable or parse fails

---

## Docker Deployment

```yaml
Services:
  mongodb:   mongo:7          → port 27017  (volume: mongo_data)
  backend:   python:3.11      → port 8000   (volume: uploads_data)
  frontend:  nginx:alpine     → port 3000

Build order: mongodb → backend (health-checked) → frontend (health-checked)
```

### Healthchecks

- MongoDB: `mongosh --eval "db.adminCommand('ping')"`
- Backend: `curl -f http://localhost:8000/api/health`
- Frontend: `wget --spider http://localhost/`

---

## Security Considerations (Production Gaps)

| Area | Current State | Production Recommendation |
|------|--------------|--------------------------|
| Authentication | None | JWT + OAuth2 |
| Authorization | None | RBAC (adjudicator / admin / member roles) |
| CORS | `allow_origins=["*"]` | Whitelist specific origins |
| MongoDB | No auth | Username/password + TLS |
| File uploads | MIME check + 10MB limit | Virus scan + S3/GCS storage |
| Gemini key | Plain env var | Secret manager (Vault / AWS Secrets) |
| HTTPS | Not configured | TLS termination at load balancer |
