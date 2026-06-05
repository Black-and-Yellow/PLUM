# AI Automation Engineer Intern Assignment
## OPD Claim Adjudication Tool

### Company Context
Plum is revolutionizing employee healthcare & insurance benefits for Indian businesses. We protect 5,000+ companies and 1M+ lives, with a goal to reach 10M lives by 2025. As part of our AI Pod initiative, we're building intelligent automation tools to transform manual processes across all teams.

### Problem Statement
Create an AI-powered tool that automates the adjudication (approval/rejection decision) of Outpatient Department (OPD) insurance claims. 

When users visit doctors for consultations or treatments not requiring hospitalization, they submit reimbursement claims with bills, prescriptions, and supporting documents. Currently, claims teams manually review each document against policy terms to make approval decisions. Your task is to build an intelligent system that automates this process.

### Assignment Objectives
Build a full-stack application that:
1. **Consumes user inputs** - Accepts and processes medical documents (bills, prescriptions, reports)
2. **Validates against policy terms** - Checks if the claim meets policy conditions
3. **Extracts and stores data fields** - Identifies and structures key information from documents
4. **Makes adjudication decisions** - Compares extracted data against policy rules to approve/reject claims with clear reasoning

### Technical Requirements

#### Core Functionality
- **Document Processing**: Extract text/data from uploaded images/PDFs of medical documents
- **AI/LLM Integration**: Use LLMs for document understanding and information extraction
- **Decision Engine**: Implement rule-based logic combined with AI reasoning
- **Data Storage**: Store claims, extracted fields, and decisions in a structured format
- **User Interface**: Clean, intuitive interface for claim submission and status viewing

#### Technology Stack (Recommended)
- **Frontend**: React/Next.js with TypeScript
- **Backend**: Node.js or Python (FastAPI/Flask)
- **AI/LLM**: OpenAI API, Claude API, or open-source models (Llama, Mistral)
- **Database**: PostgreSQL, MongoDB, or Supabase
- **Document Processing**: OCR tools (Tesseract, cloud OCR APIs) if needed
- **Deployment**: Vercel, Railway, or any cloud platform

### Deliverables

1. **Working Application**
   - Deployed application (provide URL)
   - Source code repository (GitHub/GitLab)
   - Clear README with setup instructions

2. **Documentation**
   - Architecture diagram
   - API documentation
   - Decision logic flowchart
   - List of assumptions made

3. **Demo Video** (5-10 minutes)
   - Walk through the user flow
   - Explain your technical approach
   - Demonstrate 2-3 test cases (approved/rejected claims)
   - Discuss potential improvements

### Evaluation Criteria

| Criteria | Weight | What We're Looking For |
|----------|---------|------------------------|
| **Problem Understanding** | 20% | How well you've understood the claims adjudication process and edge cases |
| **AI Integration** | 25% | Effective use of LLMs for document processing and decision support |
| **Code Quality** | 20% | Clean, maintainable code with proper error handling |
| **User Experience** | 15% | Intuitive interface, clear feedback, smooth workflow |
| **System Design** | 10% | Scalable architecture, appropriate technology choices |
| **Innovation** | 10% | Creative approaches, additional features, or optimizations |

### Bonus Points
- Implementing confidence scores for AI decisions
- Adding an appeals/manual review workflow
- Creating an admin dashboard for policy configuration
- Building evaluation metrics for AI accuracy
- Using advanced techniques (RAG, few-shot prompting, fine-tuning)
- Deploying with proper CI/CD pipeline

### Timeline
- **Duration**: 5-7 days from receipt of assignment
- **Submission**: Email your deliverables to [hiring manager email]
- **Follow-up**: Be prepared to discuss your solution in a 45-minute technical interview

### Resources Provided
1. Sample medical documents (see `sample_documents` folder)
2. Policy terms document (see `policy_terms.json`)
3. Claim adjudication rules (see `adjudication_rules.md`)
4. Test cases with expected outcomes (see `test_cases.json`)

### Important Notes
- Focus on building a working MVP rather than a perfect solution
- Document your assumptions clearly
- Prioritize core functionality over additional features
- Feel free to use AI tools (Cursor, Copilot) for development - we want to see how you work with AI
- If you're stuck, make reasonable assumptions and document them

### Questions?
If you need clarification on any aspect of the assignment, please email us within the first 24 hours. We're looking for someone who can work independently but knows when to ask for help.

---

**Good luck! We're excited to see what you build.**