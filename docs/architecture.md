# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │   Frontend    │    │     Backend       │    │   MongoDB    │  │
│  │  React + TS   │───▶│  FastAPI (Python) │───▶│   (Mongo 7)  │  │
│  │  Vite + TW    │    │   Port 8000       │    │  Port 27017  │  │
│  │  Port 3000    │    │                   │    │              │  │
│  │  (Nginx)      │    │   ┌─────────────┐ │    │  Collections:│  │
│  └──────────────┘    │   │ Gemini API  │ │    │  - claims    │  │
│                       │   │ (2.5 Flash) │ │    │  - policies  │  │
│                       │   └──────┬──────┘ │    │  - audit_logs│  │
│                       └──────────┼────────┘    └──────────────┘  │
│                                  │                               │
│                                  ▼                               │
│                       ┌──────────────────┐                       │
│                       │ Google Gemini AI  │                       │
│                       │  (External API)   │                       │
│                       └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend (React + TypeScript + Vite)

| Component | Purpose |
|-----------|---------|
| `Dashboard` | KPI metrics, claim list, activity feed |
| `SubmitClaim` | 3-step claim submission wizard |
| `ClaimDetails` | Detailed view with rule evaluations |
| `PolicyAdmin` | View and configure policy terms |
| `Settings` | Application settings and backend status |
| `apiService.ts` | REST client for backend communication |
| `storageService.ts` | localStorage fallback layer |

### Backend (FastAPI + Python 3.11)

| Module | Purpose |
|--------|---------|
| `adjudication_engine.py` | 6-step rule engine (642 lines of TS → Python) |
| `policy_service.py` | Policy terms validation and lookups |
| `fraud_detector.py` | 6-rule fraud scoring system |
| `document_extractor.py` | Gemini Vision document OCR |
| `audit_service.py` | Audit trail logging |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health check |
| `POST` | `/api/claims` | Create + adjudicate claim |
| `GET` | `/api/claims` | List claims (filterable) |
| `GET` | `/api/claims/{id}` | Get claim details |
| `PATCH` | `/api/claims/{id}` | Update claim status |
| `POST` | `/api/claims/{id}/appeal` | Submit appeal |
| `GET` | `/api/stats` | Dashboard statistics |
| `POST` | `/api/extract` | Gemini document extraction |
| `POST` | `/api/medical-necessity` | Medical necessity assessment |
| `POST` | `/api/adjudicate` | Standalone adjudication |
| `GET` | `/api/policies` | Get policy terms |
| `PUT` | `/api/policies` | Update policy terms |

### Database (MongoDB)

| Collection | Content |
|------------|---------|
| `claims` | Claim data, decisions, documents, appeals |
| `policies` | Policy terms configuration |
| `audit_logs` | All system events with timestamps |

## Data Flow

```
User Upload → Frontend → POST /api/claims → FastAPI Backend
                                               │
                                               ├── Gemini Vision (extraction)
                                               ├── Gemini LLM (medical necessity)
                                               ├── Adjudication Engine (6 steps)
                                               ├── Fraud Detector (6 rules)
                                               ├── MongoDB (persist)
                                               └── Return decision → Frontend
```

## Key Design Decisions

1. **Graceful Degradation**: Frontend works with or without the backend (localStorage fallback)
2. **API Key Security**: Gemini API keys are only stored on the backend, never exposed to the browser
3. **Monolithic Backend**: Single FastAPI service (no microservices) per assignment constraints
4. **Exact Logic Port**: Adjudication engine is a line-by-line port from TypeScript to Python to ensure identical decisions
5. **Schema-First**: Pydantic models ensure API contract consistency between frontend and backend
