# Plum AI Automation Engineer Intern Assignment Submission

## 📋 Submission Details

* **Project Name**: AI-Powered OPD Claim Adjudication System
* **Candidate**: Muthuraja
* **Live Application URL**: [https://plum.muthuraja.tech](https://plum.muthuraja.tech)
* **API Interactive Swagger Docs**: [https://plum.muthuraja.tech/docs](https://plum.muthuraja.tech/docs)
* **GitHub Repository**: [https://github.com/Black-and-Yellow/PLUM](https://github.com/Black-and-Yellow/PLUM)
* **Demo Video (YouTube)**: [https://youtu.be/xQbvr_GGjD4](https://youtu.be/xQbvr_GGjD4)
* **Google Drive (Sample Documents & PDF Test Cases)**: [https://drive.google.com/drive/u/1/folders/1mG-Aduf0QJInqcqJo4d3_wscMyjFJKVi](https://drive.google.com/drive/u/1/folders/1mG-Aduf0QJInqcqJo4d3_wscMyjFJKVi)

---

## 🛠️ Tech Stack & Architecture

The system is designed with a modern, scalable full-stack architecture running inside isolated containers:

* **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + Lucide Icons (served via an Nginx container).
* **Backend**: FastAPI + Python 3.11 + Uvicorn server.
* **Database**: MongoDB 7.0 (stores claims, policies, and audit logs).
* **Reverse Proxy & Security**: Caddy reverse proxy on public ports `80` and `443` managing automatic Let's Encrypt SSL orchestration.
* **AI/LLM Engine**: Google Gemini 2.5 Flash API for visual/text document extraction and medical necessity assessment.
* **Hosting**: Oracle Cloud Infrastructure (OCI) Always Free VM standard shape.

---

## 📖 Key Documentation Links

All project documentation is located in the `docs/` folder of the repository:

1. **Architecture & Design**: Detailed database schemas and system architecture are available at [docs/architecture.md](https://github.com/Black-and-Yellow/PLUM/blob/main/docs/architecture.md).
2. **Decision Logic & Rules**: The 6-step policy engine execution path is explained at [docs/decision-flow.md](https://github.com/Black-and-Yellow/PLUM/blob/main/docs/decision-flow.md).
3. **List of Design Assumptions**: Key business rules, waiting periods, and limitations are logged at [docs/assumptions.md](https://github.com/Black-and-Yellow/PLUM/blob/main/docs/assumptions.md).

---

## 🧪 Official Test Cases Adjudication Results

The core rule engine evaluates and passes all **10 official test cases** specified in the assignment details:

| ID | Scenario / Test Case | Expected Status | Approved Amount | Core Policy Rule Evaluated |
|---|---|---|---|---|
| **TC001** | Simple Consultation (Rajesh Kumar) | ✅ **APPROVED** | ₹1,350 | Standard 10% co-payment applied; medical necessity verified. |
| **TC002** | Dental Partial (Priya Singh) | ⚠️ **PARTIAL** | ₹8,000 | Root canal approved. Teeth whitening rejected (cosmetic exclusion). |
| **TC003** | Per-Claim Limit Exceeded (Amit Verma) | ❌ **REJECTED** | ₹0 | Claim of ₹7,500 exceeds per-claim policy cap of ₹5,000. |
| **TC004** | Missing Documents (Sneha Reddy) | ❌ **REJECTED** | ₹0 | Rejection due to missing medical prescription file. |
| **TC005** | Waiting Period (Vikram Joshi) | ❌ **REJECTED** | ₹0 | Pre-existing Diabetes treated inside 90-day waiting period. |
| **TC006** | Alternative Med (Kavita Nair) | ✅ **APPROVED** | ₹3,200 | Ayurvedic consultation approved with 20% alternative med copay. |
| **TC007** | Pre-auth Required (Suresh Patil) | ❌ **REJECTED** | ₹0 | MRI scan of ₹15,000 exceeds ₹10,000 pre-auth limit and lacks approval. |
| **TC008** | High Fraud Risk (Ravi Menon) | 🔍 **MANUAL_REVIEW** | ₹0 | Triggered flag due to 3 previous claims submitted on the same day. |
| **TC009** | Excluded Service (Anita Desai) | ❌ **REJECTED** | ₹0 | Weight loss/bariatric treatment is excluded under policy terms. |
| **TC010** | Cashless Network Hospital (Deepak Shah) | ✅ **APPROVED** | ₹4,050 | Cashless request at network hospital (Apollo) approved with 10% copay. |

---

## 🚀 How to Run Locally

You can run the entire system locally using Docker Compose in one command:

```bash
# 1. Clone repo
git clone https://github.com/Black-and-Yellow/PLUM.git
cd PLUM

# 2. Configure Gemini Key (Optional)
echo "GEMINI_API_KEY=your_gemini_key_here" > backend/.env

# 3. Start containers
docker compose up -d --build
```
* Access Frontend: `http://localhost:3000`
* Access API Docs: `http://localhost:8000/docs`
