import os
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient

def get_mongo_client():
    # Load environment variables
    mongodb_url = os.environ.get("MONGODB_URL")
    database_name = os.environ.get("DATABASE_NAME", "plum_opd")
    
    # Try reading from backend/.env if not in environment
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not mongodb_url and os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("MONGODB_URL="):
                    mongodb_url = line.split("=", 1)[1].strip()
                elif line.startswith("DATABASE_NAME="):
                    database_name = line.split("=", 1)[1].strip()
                    
    # Fallbacks
    if not mongodb_url:
        mongodb_url = "mongodb://localhost:27017"
        
    print(f"Connecting to MongoDB at: {mongodb_url}")
    
    # If MONGODB_URL uses docker hostname 'mongodb', but we're running locally, fallback to localhost
    if "mongodb://mongodb:" in mongodb_url:
        try:
            client = MongoClient(mongodb_url, serverSelectionTimeoutMS=2000)
            client.server_info() # trigger connection check
            return client, database_name
        except Exception:
            fallback_url = mongodb_url.replace("mongodb://mongodb:", "mongodb://localhost:")
            print(f"Could not connect to Docker container host. Falling back to: {fallback_url}")
            return MongoClient(fallback_url), database_name
            
    return MongoClient(mongodb_url), database_name

def seed():
    try:
        client, db_name = get_mongo_client()
        db = client[db_name]
        
        # Test connection
        client.server_info()
        
        print(f"Connected successfully. Database: {db_name}")
        
        # 1. Clear existing collections
        print("Clearing claims, audit_logs, and policies collections...")
        db.claims.delete_many({})
        db.audit_logs.delete_many({})
        db.policies.delete_many({})
        
        # 2. Seed default policy terms
        policy = {
            "policy_id": "PLUM_OPD_2024",
            "policy_name": "Plum OPD Advantage",
            "effective_date": "2024-01-01",
            "policy_holder": {
                "company": "TechCorp Solutions Pvt Ltd",
                "employees_covered": 500,
                "dependents_covered": True
            },
            "coverage_details": {
                "annual_limit": 50000,
                "per_claim_limit": 5000,
                "family_floater_limit": 150000,
                "consultation_fees": {
                    "covered": True,
                    "sub_limit": 2000,
                    "copay_percentage": 10,
                    "network_discount": 20
                },
                "diagnostic_tests": {
                    "covered": True,
                    "sub_limit": 10000,
                    "pre_authorization_required": False,
                    "covered_tests": [
                        "Blood tests", "Urine tests", "X-rays", "ECG", "Ultrasound",
                        "MRI (with pre-auth)", "CT Scan (with pre-auth)"
                    ]
                },
                "pharmacy": {
                    "covered": True,
                    "sub_limit": 15000,
                    "generic_drugs_mandatory": True,
                    "branded_drugs_copay": 30
                },
                "dental": {
                    "covered": True,
                    "sub_limit": 10000,
                    "routine_checkup_limit": 2000,
                    "procedures_covered": ["Filling", "Extraction", "Root canal", "Cleaning"],
                    "cosmetic_procedures": False
                },
                "vision": {
                    "covered": True,
                    "sub_limit": 5000,
                    "eye_test_covered": True,
                    "glasses_contact_lenses": True,
                    "lasik_surgery": False
                },
                "alternative_medicine": {
                    "covered": True,
                    "sub_limit": 8000,
                    "covered_treatments": ["Ayurveda", "Homeopathy", "Unani"],
                    "therapy_sessions_limit": 20
                }
            },
            "waiting_periods": {
                "initial_waiting": 30,
                "pre_existing_diseases": 365,
                "maternity": 270,
                "specific_ailments": {
                    "diabetes": 90,
                    "hypertension": 90,
                    "joint_replacement": 730
                }
            },
            "exclusions": [
                "Cosmetic procedures",
                "Weight loss treatments",
                "Infertility treatments",
                "Experimental treatments",
                "Self-inflicted injuries",
                "Adventure sports injuries",
                "War and nuclear risks",
                "HIV/AIDS treatment",
                "Alcoholism/drug abuse treatment",
                "Non-allopathic treatments (except listed)",
                "Vitamins and supplements (unless prescribed for deficiency)"
            ],
            "claim_requirements": {
                "documents_required": [
                    "Original bills and receipts",
                    "Prescription from registered doctor",
                    "Diagnostic test reports (if applicable)",
                    "Pharmacy bills with prescription",
                    "Doctor's registration number must be visible",
                    "Patient details must match policy records"
                ],
                "submission_timeline_days": 3000,
                "minimum_claim_amount": 500
            },
            "network_hospitals": [
                "Apollo Hospitals", "Fortis Healthcare", "Max Healthcare",
                "Manipal Hospitals", "Narayana Health"
            ],
            "cashless_facilities": {
                "available": True,
                "network_only": True,
                "pre_approval_required": False,
                "instant_approval_limit": 5000
            }
        }
        db.policies.insert_one(policy)
        print("[OK] Seeded default policy terms.")
        
        # 3. Seed Mock Claims for TC001 - TC010
        now = datetime.now()
        
        mock_claims = [
            # TC001: Simple Consultation - Approved (member Rajesh Kumar)
            {
                "claim_id": "CLM-TC001",
                "status": "APPROVED",
                "submitted_at": (now - timedelta(days=5)).isoformat(),
                "updated_at": (now - timedelta(days=5)).isoformat(),
                "member": {
                    "member_id": "EMP001",
                    "member_name": "Rajesh Kumar",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "City Clinic",
                    "is_network_provider": True,
                    "cashless_request": False
                },
                "treatment_date": "2024-11-01",
                "claimed_amount": 1500.0,
                "previous_claims_same_day": 0,
                "documents": [
                    {
                        "document_id": "doc_tc001_1",
                        "original_filename": "prescription_tc001.pdf",
                        "filename": "prescription_tc001.pdf",
                        "filepath": "prescription_tc001.pdf",
                        "mime_type": "application/pdf",
                        "doc_type": "prescription",
                        "size_bytes": 1250,
                        "upload_date": (now - timedelta(days=5)).isoformat(),
                        "claim_reference": "CLM-TC001",
                        "extraction_status": "done",
                        "extraction_result": {
                            "patient_name": "Rajesh Kumar",
                            "doctor_name": "Dr. Sharma",
                            "doctor_registration_number": "KA/45678/2015",
                            "diagnosis": "Viral fever",
                            "medicines": ["Tab. Paracetamol 650mg", "Tab. Vitamin C 500mg"],
                            "procedures": [],
                            "provider_name": "City Clinic",
                            "treatment_date": "2024-11-01",
                            "confidence": 0.95
                        }
                    },
                    {
                        "document_id": "doc_tc001_2",
                        "original_filename": "bill_tc001.pdf",
                        "filename": "bill_tc001.pdf",
                        "filepath": "bill_tc001.pdf",
                        "mime_type": "application/pdf",
                        "doc_type": "bill",
                        "size_bytes": 1020,
                        "upload_date": (now - timedelta(days=5)).isoformat(),
                        "claim_reference": "CLM-TC001",
                        "extraction_status": "done",
                        "extraction_result": {
                            "patient_name": "Rajesh Kumar",
                            "consultation_amount": 1000.0,
                            "diagnostic_amount": 500.0,
                            "provider_name": "City Clinic",
                            "bill_date": "2024-11-01",
                            "confidence": 0.95
                        }
                    }
                ],
                "decision": {
                    "status": "APPROVED",
                    "claimed_amount": 1500.0,
                    "approved_amount": 1350.0,
                    "copay_amount": 150.0,
                    "network_discount": 0.0,
                    "rejection_reasons": [],
                    "rejection_codes": [],
                    "confidence": 0.95,
                    "confidence_breakdown": {"eligibility": 1.0, "documents": 1.0, "coverage": 1.0, "limits": 1.0, "medical": 0.95},
                    "fraud_score": 5,
                    "fraud_risk": "LOW",
                    "fraud_flags": [],
                    "rule_evaluations": [
                        {"rule_id": "R001", "rule_name": "Membership Active", "step": 1, "result": "PASS", "reason": "Member is currently active"},
                        {"rule_id": "R002", "rule_name": "Documents Present", "step": 2, "result": "PASS", "reason": "Prescription and bill are both present"},
                        {"rule_id": "R003", "rule_name": "Limits Check", "step": 3, "result": "PASS", "reason": "Claim amount is within limits"},
                        {"rule_id": "R004", "rule_name": "Co-pay Applied", "step": 4, "result": "PASS", "reason": "Applied standard 10% co-pay"}
                    ],
                    "financial_breakdown": {
                        "claimed_amount": 1500.0,
                        "consultation_claimed": 1000.0,
                        "pharmacy_claimed": 0.0,
                        "diagnostic_claimed": 500.0,
                        "copay_amount": 150.0,
                        "copay_percentage": 10.0,
                        "approved_amount": 1350.0
                    },
                    "medical_necessity_score": 0.95,
                    "medical_necessity_reasoning": "Paracetamol is standard treatment for viral fever.",
                    "processed_at": (now - timedelta(days=5)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=5)).isoformat(), "description": "Claim submitted by राजेश कुमार"},
                    {"stage": "Extraction", "status": "completed", "timestamp": (now - timedelta(days=5)).isoformat(), "description": "Successfully extracted prescription and bill contents"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=5)).isoformat(), "description": "Claim approved automatically. Approved: ₹1350"}
                ]
            },
            
            # TC002: Dental Treatment - Partial Approval (member Priya Singh)
            {
                "claim_id": "CLM-TC002",
                "status": "PARTIAL",
                "submitted_at": (now - timedelta(days=4)).isoformat(),
                "updated_at": (now - timedelta(days=4)).isoformat(),
                "member": {
                    "member_id": "EMP002",
                    "member_name": "Priya Singh",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Smile Dental Care",
                    "is_network_provider": True,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-15",
                "claimed_amount": 12000.0,
                "previous_claims_same_day": 0,
                "documents": [
                    {
                        "document_id": "doc_tc002_1",
                        "original_filename": "prescription_tc002.pdf",
                        "filename": "prescription_tc002.pdf",
                        "filepath": "prescription_tc002.pdf",
                        "mime_type": "application/pdf",
                        "doc_type": "prescription",
                        "size_bytes": 1150,
                        "upload_date": (now - timedelta(days=4)).isoformat(),
                        "claim_reference": "CLM-TC002",
                        "extraction_status": "done",
                        "extraction_result": {
                            "patient_name": "Priya Singh",
                            "doctor_name": "Dr. Patel",
                            "doctor_registration_number": "MH/23456/2018",
                            "diagnosis": "Tooth decay requiring root canal",
                            "procedures": ["Root canal treatment", "Teeth whitening"],
                            "provider_name": "Smile Dental Care",
                            "treatment_date": "2024-10-15",
                            "confidence": 0.95
                        }
                    },
                    {
                        "document_id": "doc_tc002_2",
                        "original_filename": "bill_tc002.pdf",
                        "filename": "bill_tc002.pdf",
                        "filepath": "bill_tc002.pdf",
                        "mime_type": "application/pdf",
                        "doc_type": "bill",
                        "size_bytes": 1100,
                        "upload_date": (now - timedelta(days=4)).isoformat(),
                        "claim_reference": "CLM-TC002",
                        "extraction_status": "done",
                        "extraction_result": {
                            "patient_name": "Priya Singh",
                            "provider_name": "Smile Dental Care",
                            "bill_date": "2024-10-15",
                            "confidence": 0.95
                        }
                    }
                ],
                "decision": {
                    "status": "PARTIAL",
                    "claimed_amount": 12000.0,
                    "approved_amount": 8000.0,
                    "copay_amount": 0.0,
                    "network_discount": 0.0,
                    "rejection_reasons": ["Teeth whitening is cosmetic and excluded under policy terms"],
                    "rejection_codes": ["EXCLUDED_SERVICE"],
                    "confidence": 0.92,
                    "confidence_breakdown": {"eligibility": 1.0, "documents": 1.0, "coverage": 0.8, "limits": 1.0, "medical": 0.95},
                    "fraud_score": 10,
                    "fraud_risk": "LOW",
                    "fraud_flags": [],
                    "rule_evaluations": [
                        {"rule_id": "R001", "rule_name": "Membership Active", "step": 1, "result": "PASS", "reason": "Member active for 9+ months"},
                        {"rule_id": "R002", "rule_name": "Exclusions Check", "step": 2, "result": "WARNING", "reason": "Teeth whitening is classified as cosmetic/excluded"},
                        {"rule_id": "R003", "rule_name": "Itemization", "step": 3, "result": "PASS", "reason": "Root canal (₹8,000) approved. Whitening (₹4,000) deducted."}
                    ],
                    "financial_breakdown": {
                        "claimed_amount": 12000.0,
                        "consultation_claimed": 0.0,
                        "pharmacy_claimed": 0.0,
                        "diagnostic_claimed": 0.0,
                        "copay_amount": 0.0,
                        "copay_percentage": 0.0,
                        "sublimit_deductions": 4000.0,
                        "approved_amount": 8000.0
                    },
                    "medical_necessity_score": 0.90,
                    "medical_necessity_reasoning": "Root canal is medically necessary. Teeth whitening is cosmetic.",
                    "processed_at": (now - timedelta(days=4)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=4)).isoformat(), "description": "Claim submitted by Priya Singh"},
                    {"stage": "Extraction", "status": "completed", "timestamp": (now - timedelta(days=4)).isoformat(), "description": "Extracted details from dental clinic invoices"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=4)).isoformat(), "description": "Claim partially approved. Cosmetic treatments deducted. Approved: ₹8000"}
                ]
            },
            
            # TC003: Limit Exceeded - Rejected (member Amit Verma)
            {
                "claim_id": "CLM-TC003",
                "status": "REJECTED",
                "submitted_at": (now - timedelta(days=3)).isoformat(),
                "updated_at": (now - timedelta(days=3)).isoformat(),
                "member": {
                    "member_id": "EMP003",
                    "member_name": "Amit Verma",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "General Hospital",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-20",
                "claimed_amount": 7500.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "REJECTED",
                    "claimed_amount": 7500.0,
                    "approved_amount": 0.0,
                    "rejection_reasons": ["Claimed amount (₹7,500) exceeds maximum per-claim limit (₹5,000)"],
                    "rejection_codes": ["PER_CLAIM_EXCEEDED"],
                    "confidence": 0.95,
                    "rule_evaluations": [
                        {"rule_id": "R003", "rule_name": "Check Per-Claim Limit", "step": 1, "result": "FAIL", "reason": "Claim ₹7,500 exceeds the cap of ₹5,000"}
                    ],
                    "processed_at": (now - timedelta(days=3)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=3)).isoformat(), "description": "Claim submitted by Amit Verma"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=3)).isoformat(), "description": "Claim rejected: Per-claim policy limit exceeded."}
                ]
            },
            
            # TC004: Missing Documents - Rejected (member Sneha Reddy)
            {
                "claim_id": "CLM-TC004",
                "status": "REJECTED",
                "submitted_at": (now - timedelta(days=3)).isoformat(),
                "updated_at": (now - timedelta(days=3)).isoformat(),
                "member": {
                    "member_id": "EMP004",
                    "member_name": "Sneha Reddy",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Local Clinic",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-25",
                "claimed_amount": 2000.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "REJECTED",
                    "claimed_amount": 2000.0,
                    "approved_amount": 0.0,
                    "rejection_reasons": ["Required medical prescription document is missing"],
                    "rejection_codes": ["MISSING_DOCUMENTS"],
                    "confidence": 0.98,
                    "rule_evaluations": [
                        {"rule_id": "R002", "rule_name": "Document Completeness Check", "step": 1, "result": "FAIL", "reason": "No prescription file was uploaded"}
                    ],
                    "processed_at": (now - timedelta(days=3)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=3)).isoformat(), "description": "Claim submitted by Sneha Reddy"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=3)).isoformat(), "description": "Claim automatically rejected due to missing prescription"}
                ]
            },
            
            # TC005: Pre-existing Condition - Waiting Period (member Vikram Joshi)
            {
                "claim_id": "CLM-TC005",
                "status": "REJECTED",
                "submitted_at": (now - timedelta(days=2)).isoformat(),
                "updated_at": (now - timedelta(days=2)).isoformat(),
                "member": {
                    "member_id": "EMP005",
                    "member_name": "Vikram Joshi",
                    "member_join_date": "2024-09-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Diabetes Care Center",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-15",
                "claimed_amount": 3000.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "REJECTED",
                    "claimed_amount": 3000.0,
                    "approved_amount": 0.0,
                    "rejection_reasons": ["Treatment for pre-existing Type 2 Diabetes is within the 90-day policy waiting period"],
                    "rejection_codes": ["WAITING_PERIOD"],
                    "confidence": 0.90,
                    "rule_evaluations": [
                        {"rule_id": "R005", "rule_name": "Pre-existing Condition Waiting Period", "step": 1, "result": "FAIL", "reason": "Member joined 44 days before treatment date; pre-existing conditions require 90 days waiting period."}
                    ],
                    "processed_at": (now - timedelta(days=2)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=2)).isoformat(), "description": "Claim submitted by Vikram Joshi"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=2)).isoformat(), "description": "Claim rejected: Pre-existing waiting period not met."}
                ]
            },
            
            # TC006: Alternative Medicine - Approved (member Kavita Nair)
            {
                "claim_id": "CLM-TC006",
                "status": "APPROVED",
                "submitted_at": (now - timedelta(days=2)).isoformat(),
                "updated_at": (now - timedelta(days=2)).isoformat(),
                "member": {
                    "member_id": "EMP006",
                    "member_name": "Kavita Nair",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Ayurveda Wellness Center",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-28",
                "claimed_amount": 4000.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "APPROVED",
                    "claimed_amount": 4000.0,
                    "approved_amount": 3200.0, # 20% copay applied for alternative medicine
                    "copay_amount": 800.0,
                    "rejection_reasons": [],
                    "rejection_codes": [],
                    "confidence": 0.85,
                    "rule_evaluations": [
                        {"rule_id": "R006", "rule_name": "Alternative Medicine Check", "step": 1, "result": "PASS", "reason": "Ayurvedic consultation approved with 20% co-pay applied."}
                    ],
                    "financial_breakdown": {
                        "claimed_amount": 4000.0,
                        "copay_amount": 800.0,
                        "copay_percentage": 20.0,
                        "approved_amount": 3200.0
                    },
                    "processed_at": (now - timedelta(days=2)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=2)).isoformat(), "description": "Claim submitted by Kavita Nair"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=2)).isoformat(), "description": "Claim approved with 20% alternative medicine co-pay."}
                ]
            },
            
            # TC007: Diagnostic Tests - Pre-auth Required (member Suresh Patil)
            {
                "claim_id": "CLM-TC007",
                "status": "REJECTED",
                "submitted_at": (now - timedelta(days=1)).isoformat(),
                "updated_at": (now - timedelta(days=1)).isoformat(),
                "member": {
                    "member_id": "EMP007",
                    "member_name": "Suresh Patil",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Imaging Center",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-11-02",
                "claimed_amount": 15000.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "REJECTED",
                    "claimed_amount": 15000.0,
                    "approved_amount": 0.0,
                    "rejection_reasons": ["Pre-authorization is required for claims exceeding ₹10,000"],
                    "rejection_codes": ["PRE_AUTH_MISSING", "PER_CLAIM_EXCEEDED"],
                    "confidence": 0.88,
                    "rule_evaluations": [
                        {"rule_id": "R007", "rule_name": "Pre-auth Check", "step": 1, "result": "FAIL", "reason": "Claim ₹15,000 exceeds ₹10,000 limit and lacks pre-authorization."}
                    ],
                    "processed_at": (now - timedelta(days=1)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(days=1)).isoformat(), "description": "Claim submitted by Suresh Patil"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(days=1)).isoformat(), "description": "Claim rejected: Pre-auth missing for amount > ₹10,000."}
                ]
            },
            
            # TC008: Fraud Detection - Manual Review (member Ravi Menon)
            {
                "claim_id": "CLM-TC008",
                "status": "MANUAL_REVIEW",
                "submitted_at": (now - timedelta(hours=12)).isoformat(),
                "updated_at": (now - timedelta(hours=12)).isoformat(),
                "member": {
                    "member_id": "EMP008",
                    "member_name": "Ravi Menon",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "General Hospital",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-30",
                "claimed_amount": 4800.0,
                "previous_claims_same_day": 3,
                "documents": [],
                "decision": {
                    "status": "MANUAL_REVIEW",
                    "claimed_amount": 4800.0,
                    "approved_amount": 0.0,
                    "rejection_reasons": ["Potential multi-claim fraud flag triggered (3 previous claims today)"],
                    "rejection_codes": [],
                    "confidence": 0.70,
                    "fraud_score": 85,
                    "fraud_risk": "HIGH",
                    "fraud_flags": ["MULTIPLE_CLAIMS_SAME_DAY", "HIGH_FREQUENCY_PROVIDER"],
                    "rule_evaluations": [
                        {"rule_id": "R008", "rule_name": "Fraud Triggers", "step": 1, "result": "WARNING", "reason": "Claim flagged for manual audit: high frequency claims on same day."}
                    ],
                    "processed_at": (now - timedelta(hours=12)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(hours=12)).isoformat(), "description": "Claim submitted by Ravi Menon"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(hours=12)).isoformat(), "description": "Claim flagged for HIGH fraud risk. Suspended to Manual Review."}
                ]
            },
            
            # TC009: Excluded Treatment - Rejected (member Anita Desai)
            {
                "claim_id": "CLM-TC009",
                "status": "REJECTED",
                "submitted_at": (now - timedelta(hours=6)).isoformat(),
                "updated_at": (now - timedelta(hours=6)).isoformat(),
                "member": {
                    "member_id": "EMP009",
                    "member_name": "Anita Desai",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Weight Loss Clinic",
                    "is_network_provider": False,
                    "cashless_request": False
                },
                "treatment_date": "2024-10-18",
                "claimed_amount": 8000.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "REJECTED",
                    "claimed_amount": 8000.0,
                    "approved_amount": 0.0,
                    "rejection_reasons": ["Treatment for obesity/bariatric care is excluded under policy terms"],
                    "rejection_codes": ["SERVICE_NOT_COVERED"],
                    "confidence": 0.94,
                    "rule_evaluations": [
                        {"rule_id": "R009", "rule_name": "Policy Exclusions Check", "step": 1, "result": "FAIL", "reason": "Obesity consultation is an excluded service."}
                    ],
                    "processed_at": (now - timedelta(hours=6)).isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": (now - timedelta(hours=6)).isoformat(), "description": "Claim submitted by Anita Desai"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": (now - timedelta(hours=6)).isoformat(), "description": "Claim automatically rejected: Obesity care is excluded from coverage."}
                ]
            },
            
            # TC010: Network Hospital - Cashless Approved (member Deepak Shah)
            {
                "claim_id": "CLM-TC010",
                "status": "APPROVED",
                "submitted_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "member": {
                    "member_id": "EMP010",
                    "member_name": "Deepak Shah",
                    "member_join_date": "2024-01-01",
                    "relationship": "employee"
                },
                "provider": {
                    "provider_name": "Apollo Hospitals",
                    "is_network_provider": True,
                    "cashless_request": True
                },
                "treatment_date": "2024-11-03",
                "claimed_amount": 4500.0,
                "previous_claims_same_day": 0,
                "documents": [],
                "decision": {
                    "status": "APPROVED",
                    "claimed_amount": 4500.0,
                    "approved_amount": 4050.0, # 10% co-pay applied
                    "copay_amount": 450.0,
                    "network_discount": 0.0,
                    "rejection_reasons": [],
                    "rejection_codes": [],
                    "confidence": 0.95,
                    "rule_evaluations": [
                        {"rule_id": "R001", "rule_name": "Membership Active", "step": 1, "result": "PASS", "reason": "Member active"},
                        {"rule_id": "R010", "rule_name": "Cashless Network Hospital Check", "step": 2, "result": "PASS", "reason": "Apollo Hospitals is network provider. Cashless approved."}
                    ],
                    "financial_breakdown": {
                        "claimed_amount": 4500.0,
                        "copay_amount": 450.0,
                        "copay_percentage": 10.0,
                        "approved_amount": 4050.0
                    },
                    "processed_at": now.isoformat()
                },
                "timeline": [
                    {"stage": "Submission", "status": "completed", "timestamp": now.isoformat(), "description": "Cashless pre-auth claim submitted by Apollo Hospitals"},
                    {"stage": "Adjudication", "status": "completed", "timestamp": now.isoformat(), "description": "Cashless claim approved. Approved: ₹4050"}
                ]
            }
        ]
        
        # 4. Insert claims
        print(f"Inserting {len(mock_claims)} mock claims...")
        db.claims.insert_many(mock_claims)
        print("[OK] Seeded mock claims successfully.")
        
        # 5. Seed some audit logs
        audit_logs = []
        for c in mock_claims:
            audit_logs.append({
                "claim_id": c["claim_id"],
                "action": "AUTO_ADJUDICATE",
                "actor": "System Engine (AI)",
                "timestamp": c["submitted_at"],
                "details": f"Processed claim with status: {c['status']}, Approved amount: ₹{c.get('decision', {}).get('approved_amount', 0)}"
            })
        db.audit_logs.insert_many(audit_logs)
        print("[OK] Seeded audit logs.")
        
        print("\n==========================================")
        print("DATABASE SEEDING COMPLETED SUCCESSFULLY!")
        print("==========================================")
        
    except Exception as e:
        print(f"\n[ERROR] Error seeding database: {e}", file=sys.stderr)
        return False
        
    return True

if __name__ == "__main__":
    seed()
