# Interview Notes & Discussion Guide

This document prepares for technical interview discussion around the Plum OPD Claim Adjudication System. It covers system design rationale, trade-offs, and anticipated questions.

---

## System Design Decisions

### 1. Why FastAPI over Django / Flask?

- **Async-native**: FastAPI + Motor allows concurrent MongoDB queries without blocking threads — important for document extraction (I/O-heavy Gemini calls).
- **Auto-generated OpenAPI**: Swagger UI at `/docs` works out of the box — zero setup for API documentation.
- **Pydantic v2**: Request/response validation with rich error messages. Schema-first design catches bugs at the API boundary.
- **Performance**: FastAPI benchmarks comparable to Node.js and Go for I/O-bound workloads.

### 2. Why MongoDB over PostgreSQL?

| Factor | MongoDB | PostgreSQL |
|--------|---------|------------|
| Schema flexibility | ✅ Claims have variable nested arrays (rule_evaluations, appeals, timeline) | ❌ Requires migrations for each schema change |
| Query pattern | Mostly fetch-by-ID, few joins | SQL shines with joins |
| Embedded documents | ✅ Decision + rules + fraud all in one doc | ❌ Multiple table joins |
| Aggregation | ✅ Pipeline for dashboard stats | ❌ Complex window functions |

For a production system with strict financial reporting needs, PostgreSQL would be the better choice due to ACID compliance and audit trail requirements.

### 3. Why keep the adjudication engine in Python (not use Gemini for everything)?

- **Auditability**: Rule-based decisions are fully explainable — each rule has an ID, result, and reason stored in the database. Gemini responses are probabilistic and non-deterministic.
- **Cost**: Running Gemini on every claim adjudication would be expensive and slow. Gemini is used only for extraction (document understanding) and medical necessity (clinical judgment).
- **Testability**: 10 deterministic test cases can be asserted exactly. ML outputs can't be regression-tested as precisely.
- **Reliability**: System works fully without a Gemini API key — fallback to manual extraction and default confidence values.

### 4. Why is the adjudication engine duplicated in TypeScript (frontend)?

The TypeScript engine in `frontend/src/services/adjudicationEngine.ts` is a **fallback** for:
- Offline development when backend isn't running
- Local `storageService` claims when no MongoDB is available
- Running the original assignment test runner (`npx tsx testRunner.ts`)

The Python backend engine is the **authoritative** version used in production.

### 5. Why no authentication?

This is a **demo/internship assignment** system. Production would add:
- **JWT tokens** for API authentication
- **RBAC** with roles: `member` (submit, view own claims), `adjudicator` (manual review), `admin` (policy management, all claims)
- **OAuth2** with Google Workspace (appropriate for a B2B insurance platform)

---

## Scalability Discussion

### Current Bottlenecks

1. **Gemini API calls** are synchronous per-claim — sequential for document extraction + medical necessity = ~2–4 seconds per claim.
2. **Stats endpoint** loads all claims into memory (`find({})`) — will degrade past ~10,000 claims.
3. **Single MongoDB node** — no replica set, no sharding.

### Scaling Approach

```
Current (Demo):
  Single FastAPI process → Single MongoDB

Production (10,000+ claims/day):
  Load Balancer
  ├── FastAPI instance 1  ─┐
  ├── FastAPI instance 2  ─┤──→ MongoDB Replica Set (3 nodes)
  └── FastAPI instance 3  ─┘
          │
          ├──→ Celery Worker (async Gemini extraction)
          │         └── Redis (task queue)
          └──→ MongoDB Atlas (managed, auto-scaling)
```

- **Async Gemini**: Extract documents in a background Celery task; claim is created in PENDING state and updated when extraction completes.
- **Pagination**: Stats endpoint uses MongoDB aggregation pipeline instead of loading all documents.
- **Read replicas**: Dashboard reads go to secondary; writes go to primary.

---

## Gemini Integration Deep Dive

### What Gemini extracts from documents

Given an image of a prescription or bill:
```json
{
  "patientName": "Rajesh Kumar",
  "doctorName": "Dr. Anjali Sharma",
  "doctorRegistrationNumber": "KA/45678/2015",
  "diagnosis": "Viral fever with throat infection",
  "medicines": ["Paracetamol 650mg", "Azithromycin 500mg", "Vitamin C 500mg"],
  "procedures": [],
  "consultationAmount": 500,
  "pharmacyAmount": 380,
  "diagnosticAmount": null,
  "treatmentDate": "2024-11-01",
  "confidence": 0.92
}
```

### Reliability improvements made

1. **Structured JSON mode**: `response_mime_type: "application/json"` — Gemini returns raw JSON, not Markdown-wrapped.
2. **Retry logic**: 3 attempts with exponential backoff (1s → 2s → 4s) for transient `503` / timeout errors.
3. **Timeout**: 30-second hard timeout per attempt via `asyncio.wait_for()`.
4. **Graceful degradation**: If extraction fails → `confidence: 0.10` → adjudication confidence < 70% → MANUAL_REVIEW.
5. **Code-fence stripping**: Multi-pattern regex handles ` ```json `, ` ``` `, single backticks.

### Medical Necessity Assessment

Gemini evaluates the clinical appropriateness of a claim:
- **Input**: diagnosis + prescribed medicines + procedures
- **Prompt**: asks Gemini to act as a medical review specialist
- **Output**: `{ score: 0.87, reasoning: "Viral fever clinically justifies..." }`
- **Score < 0.5**: Flags as WARNING (reduces confidence)
- **Fallback**: score = 0.8 if API unavailable

---

## Fraud Detection Logic

Six rules are evaluated for every claim:

| Rule | Weight | Explanation |
|------|--------|-------------|
| Same-day duplicates | 40 pts | 2+ claims on same date for same member → likely billing error or fraud |
| High frequency | 25 pts | 3+ claims in 30-day rolling window → suspicious pattern |
| Round numbers | 15 pts | Exact ₹500, ₹1000, ₹5000 → common in fraudulent invoices |
| High value | 15 pts | > 80% of per-claim limit → risk of over-claiming |
| Provider repetition | 20 pts | Same provider 4+ times in 30 days → collusion risk |
| Amount outlier | 20 pts | Amount >> 2× member's historical average → statistical anomaly |

**Why not ML for fraud?** — At internship-demo scale, a scoring model would overfit to the 10 test cases. Rule-based fraud detection is explainable and auditable, which is what insurance regulators require.

---

## API Design Decisions

### Why `POST /api/explain-decision` instead of `GET /api/claims/{id}/explain`?

- `GET` with large response bodies is acceptable, but the explain endpoint takes a `claim_id` as input (not a path segment) for consistency with how the frontend calls it.
- Either design is valid — the `POST` approach makes the intent clearer (it's a compute action, not a resource fetch).

### Why return full rule evaluations in the claim response?

The interview context expects examiners to see the full decision trace — every rule ID, result, reason, and rejection code. This mirrors how real insurance systems work: complete audit trail in every claim document.

### Why `PATCH` (not `PUT`) for claim updates?

`PATCH` for partial updates (status-only, comments-only) follows REST semantics correctly. `PUT` would require resending the full claim body.

---

## Code Quality Highlights

- **Single Responsibility**: Each service file does one thing (`fraud_detector.py`, `policy_service.py`, `document_extractor.py`).
- **Type safety**: Every FastAPI endpoint uses Pydantic models. MongoDB documents are deserialized through typed models.
- **No magic strings**: Rejection codes (`MISSING_DOCUMENTS`, `WAITING_PERIOD`, etc.) are referenced as string literals consistently — would add an `Enum` in production.
- **Async throughout**: All DB calls use `await` with Motor. Gemini calls are wrapped in `asyncio.run_in_executor` for the sync SDK.
- **Test isolation**: API tests use `MagicMock` to mock MongoDB — tests don't require a running database.

---

## What I Would Do Differently in Production

1. **Add enum types** for status, doc_type, rejection codes — prevents typos.
2. **Separate `ClaimCreateRequest` from the adjudication input** — currently tightly coupled.
3. **Add structured logging** (structlog or loguru) with claim_id context in every log line.
4. **Implement claim versioning** — immutable decision records with append-only updates.
5. **Add rate limiting** on the `/api/extract` endpoint — Gemini API has per-minute quotas.
6. **Database indexes** on `claim_id`, `member.member_id`, `status`, `submitted_at`.
7. **Pre-commit hooks** with `ruff` + `mypy` for code quality enforcement.
8. **API versioning** (`/api/v1/`) for future backward compatibility.
9. **Webhook support** for claim status change notifications.
10. **S3/GCS** for document storage instead of local filesystem.

---

## Interview Question Anticipation

**Q: How would you handle concurrent claim submissions from the same member?**
> MongoDB's atomic `findAndModify` / update operations prevent race conditions on annual limit checks. In high-throughput scenarios, a distributed lock (Redis) or optimistic concurrency (version field) would prevent double-counting.

**Q: How do you ensure the adjudication decision is auditable?**
> Every `RuleEvaluationResult` is stored in the MongoDB document with: rule_id, rule_name, step number, result (PASS/FAIL/WARNING), reason, and rejection code. The `audit_service` also logs discrete events (claim_created, appeal_submitted, etc.).

**Q: What happens if MongoDB goes down mid-adjudication?**
> The adjudication engine runs completely in memory — the decision is computed before any DB write. If `insert_one` fails, the claim is lost. Production would wrap the insert in a retry with idempotency key (claim_id) to prevent duplicate submissions.

**Q: Why not use a workflow engine (Airflow, Temporal) for the adjudication pipeline?**
> The 6-step pipeline executes in ~50ms — overhead of a distributed workflow engine isn't justified. If steps needed retries, long-running human tasks, or cross-service calls, Temporal would be the right choice.

**Q: How would you add a new policy rule?**
> 1. Add the business logic to `policy_service.py`
> 2. Add the rule evaluation in the appropriate step of `adjudication_engine.py` using `_pass()`, `_fail()`, or `_warn()`
> 3. Add a test case to `test_adjudication.py`
> No other files need to change — the engine is purely additive.
