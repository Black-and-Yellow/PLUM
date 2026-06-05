# Plum OPD Claim Adjudication Tool

AI-powered OPD insurance claim adjudication system with Gemini Vision document extraction, rule-based decision engine, fraud detection, and full-stack deployment.

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Document Extraction** | Gemini 2.5 Flash Vision extracts structured data from medical bills and prescriptions |
| ⚡ **Automated Adjudication** | 6-step rule engine evaluates eligibility, documents, coverage, limits, medical necessity, and fraud |
| 🔍 **Fraud Detection** | 6-rule scoring system with same-day, high-frequency, and suspicious pattern checks |
| 📊 **Real-time Dashboard** | KPI cards, claims table, activity feed, and trend analysis |
| 🏥 **Medical Necessity** | Gemini LLM assesses whether treatments are medically justified |
| 📋 **Policy Administration** | View and configure coverage limits, exclusions, and waiting periods |
| 🐳 **Docker Deployment** | One-command deployment with `docker compose up` |
| 🧪 **Comprehensive Tests** | 10 test cases covering all adjudication outcomes |

## Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   Frontend   │───▶│     Backend      │───▶│   MongoDB    │
│  React + TS  │    │  FastAPI (Python) │    │   (Mongo 7)  │
│  Port 3000   │    │   Port 8000      │    │  Port 27017  │
└──────────────┘    └────────┬─────────┘    └──────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Google Gemini   │
                    │  2.5 Flash API   │
                    └──────────────────┘
```

For detailed architecture, see [`docs/architecture.md`](docs/architecture.md).

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd Plum

# Configure Gemini API key (optional — system works without it)
echo "GEMINI_API_KEY=your_key_here" >> backend/.env

# Start all services
docker compose up --build -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# MongoDB: localhost:27017
```

### Option 2: Local Development

#### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB 7+ running locally on port 27017

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set MONGODB_URL=mongodb://localhost:27017

# Start the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
# Install dependencies
npm install

# Start dev server (auto-proxies /api to backend)
npm run dev
```

## Test Cases

The adjudication engine covers **10 test cases** matching the assignment specification:

| ID | Case | Expected Decision | Expected Amount |
|----|------|-------------------|-----------------|
| TC001 | Simple Consultation | ✅ APPROVED | ₹1,350 |
| TC002 | Dental (Root Canal + Whitening) | ⚠️ PARTIAL | ₹8,000 |
| TC003 | Limit Exceeded (₹7,500) | ❌ REJECTED | ₹0 |
| TC004 | Missing Documents | ❌ REJECTED | ₹0 |
| TC005 | Pre-existing (Diabetes, 45 days) | ❌ REJECTED | ₹0 |
| TC006 | Alternative Medicine (Ayurveda) | ✅ APPROVED | ₹3,600 |
| TC007 | MRI without Pre-auth | ❌ REJECTED | ₹0 |
| TC008 | Fraud (3 same-day claims) | 🔍 MANUAL_REVIEW | — |
| TC009 | Excluded (Weight Loss) | ❌ REJECTED | ₹0 |
| TC010 | Network Hospital Cashless | ✅ APPROVED | ₹3,600 |

### Running Tests

```bash
# Python backend tests (TC001–TC010 + API tests)
cd backend
pip install -r requirements.txt
pytest tests/ -v

# TypeScript tests (original test runner)
npx tsx src/services/__tests__/testRunner.ts
```

## API Documentation

Interactive API docs are available when the backend is running:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/claims` | Create + adjudicate a claim |
| `GET` | `/api/claims` | List all claims |
| `GET` | `/api/claims/{id}` | Get claim details |
| `POST` | `/api/adjudicate` | Standalone adjudication |
| `POST` | `/api/extract` | Gemini document extraction |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/health` | System health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | `plum_opd` | Database name |
| `GEMINI_API_KEY` | *(empty)* | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name |
| `UPLOAD_DIR` | `./uploads` | Document upload directory |

## Project Structure

```
Plum/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # REST API endpoints
│   │   ├── core/              # Configuration
│   │   ├── database/          # MongoDB connection
│   │   ├── models/            # Pydantic data models
│   │   ├── schemas/           # Request/response schemas
│   │   ├── services/          # Business logic
│   │   │   ├── adjudication_engine.py  # 6-step rule engine
│   │   │   ├── fraud_detector.py       # Fraud scoring
│   │   │   ├── policy_service.py       # Policy validation
│   │   │   └── document_extractor.py   # Gemini extraction
│   │   └── main.py            # FastAPI app entry point
│   ├── tests/                 # pytest test suites
│   ├── Dockerfile
│   └── requirements.txt
├── src/                       # React frontend
│   ├── pages/                 # Dashboard, SubmitClaim, etc.
│   ├── components/            # Reusable UI components
│   ├── services/              # API client & local services
│   └── types/                 # TypeScript interfaces
├── frontend/                  # Frontend Docker config
│   ├── Dockerfile
│   └── nginx.conf
├── docs/                      # Documentation
│   ├── architecture.md
│   ├── decision-flow.md
│   └── assumptions.md
├── question/                  # Assignment reference files
│   ├── policy_terms.json
│   ├── adjudication_rules.md
│   └── test_cases.json
├── docker-compose.yml         # Full stack orchestration
└── README.md                  # This file
```

## Adjudication Pipeline

The engine processes claims through 6 sequential steps:

1. **Eligibility** — Policy active, waiting period, member verification, submission deadline
2. **Documents** — Prescription, bill, doctor registration, date and name consistency
3. **Coverage** — Exclusion check, pre-authorization, alternative medicine
4. **Limits** — Minimum amount, per-claim limit, annual limit, copay/network discount
5. **Medical Necessity** — Gemini LLM assessment (optional, defaults to full confidence)
6. **Fraud Detection** — Same-day claims, frequency, value patterns, provider repetition

For the detailed decision flowchart, see [`docs/decision-flow.md`](docs/decision-flow.md).

## Assumptions

Key assumptions are documented in [`docs/assumptions.md`](docs/assumptions.md). Notable ones:

- Single policy (`PLUM_OPD_2024`) assumed
- No user authentication
- MongoDB runs without auth
- Gemini API is optional (system works without it)
- Documents must be in English

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, Python 3.11, Pydantic v2 |
| Database | MongoDB 7 (Motor async driver) |
| AI/ML | Google Gemini 2.5 Flash (Vision + LLM) |
| Testing | pytest, pytest-asyncio, httpx |
| Deployment | Docker, Docker Compose, Nginx |
