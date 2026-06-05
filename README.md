# Plum OPD Claim Adjudication Tool

> **Plum AI Automation Engineer Internship Assignment** — Full-Stack Submission

An AI-powered, rule-based OPD insurance claim adjudication system built with **React + TypeScript** on the frontend and **FastAPI + Python** on the backend, integrated with **Google Gemini 2.5 Flash** for document extraction and medical necessity assessment.

---

## Features at a Glance

| Feature | Description |
|---------|-------------|
| 🤖 **AI Document Extraction** | Gemini Vision reads prescriptions & bills; extracts patient name, diagnosis, doctor reg. number, medicines, amounts |
| ⚡ **6-Step Adjudication Engine** | Eligibility → Documents → Coverage → Financial → Medical Necessity → Fraud |
| 🔍 **Fraud Detection** | 6-rule scoring (same-day claims, frequency, value patterns, provider repetition) |
| 💡 **Decision Explainability** | `POST /api/explain-decision` returns step-by-step human-readable explanations |
| 📁 **Document Persistence** | Uploaded files stored with full metadata (filename, MIME, size, timestamp, download URL) |
| 📊 **Real-time Dashboard** | KPI cards, claims table with search/filter, activity feed, trend analysis |
| 🏥 **Medical Necessity Review** | Gemini LLM assesses whether treatments are medically justified |
| 📋 **Policy Administration** | View and configure coverage limits, exclusions, waiting periods |
| 📣 **Appeals Workflow** | Submit, track, and resolve appeals with reviewer comments |
| 🔧 **Manual Review Workflow** | Claims officer panel for MANUAL_REVIEW and APPEALED claims |
| 🐳 **Docker Deployment** | One-command deployment with `docker compose up --build -d` |
| 🧪 **Comprehensive Tests** | 15 tests — 10 adjudication TCs + 5 API integration tests, all passing |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                             │
│              React 19 + TypeScript + Vite + TailwindCSS         │
│                      Port 3000 (Docker: Nginx)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP / REST API
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                             │
│                    Python 3.11 / uvicorn                        │
│                         Port 8000                               │
│                                                                 │
│   ┌────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│   │ Adjudica-  │  │ Document         │  │ Decision          │  │
│   │ tion Engine│  │ Extractor        │  │ Explainer         │  │
│   │ (6 steps)  │  │ (Gemini Vision)  │  │ (Rule-based)      │  │
│   └────────────┘  └──────────────────┘  └───────────────────┘  │
│   ┌────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│   │ Fraud      │  │ Policy Service   │  │ Audit Service     │  │
│   │ Detector   │  │ (Rules + Limits) │  │ (Event Logging)   │  │
│   └────────────┘  └──────────────────┘  └───────────────────┘  │
└──────────┬──────────────────┬──────────────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────────────────┐
│   MongoDB 7      │  │         Google Gemini 2.5 Flash          │
│   Port 27017     │  │  Vision (extraction) + LLM (necessity)   │
│   Motor async    │  │  JSON mode + retry + 30s timeout         │
└──────────────────┘  └──────────────────────────────────────────┘
```

For detailed architecture documentation, see [`docs/architecture.md`](docs/architecture.md).

---

## Quick Start

### Option 1: Docker Compose (Recommended — one command)

```bash
# 1. Clone
git clone https://github.com/Black-and-Yellow/PLUM.git
cd PLUM

# 2. Add your Gemini API key (optional — system works without it)
echo "GEMINI_API_KEY=your_key_here" > backend/.env

# 3. Start everything
docker compose up --build -d

# 4. Open the app
#    Frontend:  http://localhost:3000
#    Swagger:   http://localhost:8000/docs
#    MongoDB:   localhost:27017
```

> **First run takes ~2 minutes** while Docker pulls images and builds containers.

### Option 2: Local Development

#### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB 7 running on `localhost:27017`

#### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set GEMINI_API_KEY if you have one

# Start server (auto-reloads on file change)
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
# Open: http://localhost:5173
```

---

## Test Cases

The adjudication engine is tested against **10 official assignment test cases**:

| ID | Scenario | Expected Decision | Expected Amount | Status |
|----|----------|-------------------|-----------------|--------|
| TC001 | Simple Consultation — Viral Fever | ✅ APPROVED | ₹1,350 | ✅ Pass |
| TC002 | Dental — Root Canal + Whitening (partial) | ⚠️ PARTIAL | ₹8,000 | ✅ Pass |
| TC003 | Per-claim Limit Exceeded (₹7,500 claim) | ❌ REJECTED | ₹0 | ✅ Pass |
| TC004 | Missing Documents — No prescription | ❌ REJECTED | ₹0 | ✅ Pass |
| TC005 | Pre-existing Condition Waiting Period | ❌ REJECTED | ₹0 | ✅ Pass |
| TC006 | Alternative Medicine (Ayurveda) — Covered | ✅ APPROVED | ₹3,600 | ✅ Pass |
| TC007 | MRI without Pre-authorization | ❌ REJECTED | ₹0 | ✅ Pass |
| TC008 | Fraud — 3 same-day claims | 🔍 MANUAL_REVIEW | — | ✅ Pass |
| TC009 | Excluded Treatment — Weight Loss | ❌ REJECTED | ₹0 | ✅ Pass |
| TC010 | Network Hospital Cashless — 20% discount | ✅ APPROVED | ₹3,600 | ✅ Pass |

### Running Tests

```bash
cd backend
pytest tests/ -v
# 15 passed in ~2s
```

---

## API Reference

Interactive docs: **http://localhost:8000/docs** (Swagger UI) | **http://localhost:8000/redoc**

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health (MongoDB + Gemini status) |
| `POST` | `/api/claims` | Create and adjudicate a claim |
| `GET` | `/api/claims` | List claims (filter by status, search) |
| `GET` | `/api/claims/{id}` | Get full claim details |
| `PATCH` | `/api/claims/{id}` | Update status / add reviewer comments |
| `POST` | `/api/claims/{id}/appeal` | Submit an appeal |
| `POST` | `/api/claims/{id}/documents` | Upload a document (PDF/image) |
| `GET` | `/api/claims/{id}/documents` | List uploaded documents |
| `POST` | `/api/adjudicate` | Standalone adjudication (no persistence) |
| `POST` | `/api/extract` | Gemini document extraction |
| `POST` | `/api/explain-decision` | Human-readable decision explanation |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/policies` | Get active policy terms |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | `plum_opd` | MongoDB database name |
| `GEMINI_API_KEY` | *(empty)* | Google Gemini API key — get from [aistudio.google.com](https://aistudio.google.com) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model variant |
| `UPLOAD_DIR` | `./uploads` | Document upload directory |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `VITE_GEMINI_API_KEY` | Gemini key for client-side extraction (dev mode) |
| `VITE_GEMINI_MODEL` | Model name override |

---

## Project Structure

```
PLUM/
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/               # Dashboard, SubmitClaim, ClaimDetails, PolicyAdmin, Settings
│   │   ├── components/          # Layout, Sidebar, StatusBadge, DecisionExplanationCard
│   │   ├── services/            # apiService, adjudicationEngine, documentExtractor, storageService
│   │   └── types/               # TypeScript interfaces (Claim, Decision, Policy, Extraction)
│   ├── Dockerfile               # Multi-stage: Node build → Nginx serve
│   ├── nginx.conf               # SPA routing + /api proxy config
│   └── package.json
│
├── backend/                     # FastAPI + Python
│   ├── app/
│   │   ├── api/                 # REST endpoints (claims, adjudication, extraction, explain, policies)
│   │   ├── services/
│   │   │   ├── adjudication_engine.py   # 6-step rule engine (605 lines)
│   │   │   ├── decision_explainer.py    # Human-readable explanation generator
│   │   │   ├── fraud_detector.py        # 6-rule fraud scoring
│   │   │   ├── document_extractor.py    # Gemini Vision + retry + JSON mode
│   │   │   ├── policy_service.py        # Coverage rules, limits, waiting periods
│   │   │   └── audit_service.py         # Event audit logging
│   │   ├── models/              # Pydantic data models (Claim, Decision, Policy)
│   │   ├── schemas/             # Request/response schemas
│   │   ├── database/            # Motor async MongoDB client
│   │   ├── core/                # Configuration (pydantic-settings)
│   │   ├── utils/               # Shared utilities
│   │   └── main.py              # FastAPI app entry point
│   ├── tests/                   # pytest — 15 tests (10 TC + 5 API)
│   ├── uploads/                 # Document storage (gitignored, volume-mounted in Docker)
│   ├── scripts/                 # Operational scripts
│   ├── Dockerfile
│   └── requirements.txt
│
├── docs/                        # Technical documentation
│   ├── architecture.md          # System design + component diagram
│   ├── decision-flow.md         # 6-step adjudication flowchart
│   ├── assumptions.md           # Design assumptions and trade-offs
│   ├── interview-notes.md       # Interview discussion guide
│   └── screenshots/
│
├── assignment-assets/           # Original assignment reference files
│   ├── plum_intern_assignment.md
│   ├── policy_terms.json
│   ├── adjudication_rules.md
│   ├── test_cases.json
│   └── sample_documents_guide.md
│
├── docker-compose.yml           # Full-stack orchestration (MongoDB + Backend + Frontend)
├── FINAL_REVIEW.md              # Submission review and self-assessment
├── README.md                    # This file
├── .env.example                 # Root environment template
└── .gitignore
```

---

## Adjudication Pipeline

Claims are processed through **6 sequential steps**:

```
SUBMIT CLAIM
     │
     ▼
Step 1: ELIGIBILITY
  ├─ Policy active on treatment date?
  ├─ Waiting period satisfied?
  ├─ Member ID + name present?
  └─ Submitted within 30-day deadline?
     │
     ▼
Step 2: DOCUMENT VALIDATION
  ├─ Prescription submitted?
  ├─ Medical bill submitted?
  ├─ Doctor registration number valid?
  ├─ Treatment dates consistent?
  └─ Patient name matches member?
     │
     ▼
Step 3: COVERAGE VERIFICATION
  ├─ Diagnosis/treatment excluded?
  ├─ Pre-authorization required (MRI/CT)?
  └─ Alternative medicine covered?
     │
     ▼
Step 4: FINANCIAL CALCULATIONS
  ├─ Above minimum claim (₹200)?
  ├─ Within per-claim limit (₹5,000)?
  ├─ Within annual limit (₹25,000)?
  └─ Apply copay (10%) or network discount (20%)
     │
     ▼
Step 5: MEDICAL NECESSITY
  └─ Gemini LLM: diagnosis vs. medicines vs. procedures
     │
     ▼
Step 6: FRAUD DETECTION
  ├─ Same-day duplicate claims?
  ├─ High claim frequency (>3/month)?
  ├─ Suspicious amount patterns?
  └─ Provider repetition?
     │
     ▼
DECISION: APPROVED / PARTIAL / REJECTED / MANUAL_REVIEW
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19 |
| Frontend | TypeScript | 6.x |
| Frontend | Vite | 8.x |
| Frontend | Tailwind CSS | 4.x |
| Backend | FastAPI | 0.115+ |
| Backend | Python | 3.11+ |
| Backend | Pydantic v2 | 2.x |
| Database | MongoDB | 7 |
| DB Driver | Motor (async) | 3.x |
| AI/ML | Google Gemini 2.5 Flash | API |
| Testing | pytest + httpx | 8.x |
| Deployment | Docker + Docker Compose | |
| Web Server | Nginx | alpine |

---

## Key Design Decisions

1. **Backend adjudication over frontend** — Rule engine runs server-side in Python for auditability, persistence, and testability. Frontend has a local fallback engine for offline development.

2. **Gemini is optional** — System works fully without an API key. Medical necessity defaults to 0.8 confidence; document extraction shows raw fields.

3. **MongoDB over SQL** — Claims have variable nested structures (appeals, rule evaluations, document lists) that map naturally to documents.

4. **No auth by design** — Single-tenant demo system. Production would add JWT + RBAC.

5. **Structured JSON mode** — Gemini is asked for `response_mime_type: application/json` to reduce parse failures. Retry logic (3 attempts, exponential backoff) handles transient API errors.

---

## Assumptions

See [`docs/assumptions.md`](docs/assumptions.md) for full details. Key assumptions:

- Single policy (`PLUM_OPD_2024`) for all members
- No user authentication required
- MongoDB runs without auth credentials
- All medical documents are in English
- Treatment amounts are in INR

---

## Contributing

This is an internship assignment submission. For questions or discussion, see [`docs/interview-notes.md`](docs/interview-notes.md).
