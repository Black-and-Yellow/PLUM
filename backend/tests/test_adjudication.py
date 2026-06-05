"""Adjudication engine tests — TC001 through TC010.

Direct port of testRunner.ts with identical inputs and expected outputs.
"""

import pytest
from app.services.adjudication_engine import AdjudicationInput, adjudicate_claim
from app.models.decision import MedicalNecessityResult


# ── Helper ─────────────────────────────────────────────────────────────────────

def _make_input(**kwargs) -> AdjudicationInput:
    defaults = dict(
        member_id="",
        member_name="",
        member_join_date="2024-01-01",
        treatment_date="2024-11-01",
        submitted_at="2024-11-15",
        claimed_amount=0,
        provider_name="",
        cashless_request=False,
        extracted_patient_name=None,
        extracted_doctor_name=None,
        extracted_doctor_reg=None,
        extracted_diagnosis=None,
        extracted_medicines=[],
        extracted_procedures=[],
        consultation_amount=0,
        pharmacy_amount=0,
        diagnostic_amount=0,
        treatment_date_from_doc=None,
        bill_date_from_doc=None,
        has_prescription=True,
        has_bill=True,
        previous_claims_same_day=0,
        medical_necessity_result=None,
        ytd_approved_amount=0,
        itemized_amounts=None,
        existing_claims=None,
    )
    defaults.update(kwargs)
    return AdjudicationInput(**defaults)


# ── TC001: Simple Consultation - Approved ──────────────────────────────────────

def test_tc001_simple_consultation_approved():
    inp = _make_input(
        member_id="EMP001",
        member_name="Rajesh Kumar",
        treatment_date="2024-11-01",
        submitted_at="2024-11-15",
        claimed_amount=1500,
        provider_name="City Clinic",
        extracted_patient_name="Rajesh Kumar",
        extracted_doctor_name="Dr. Sharma",
        extracted_doctor_reg="KA/45678/2015",
        extracted_diagnosis="Viral fever",
        extracted_medicines=["Paracetamol 650mg", "Vitamin C"],
        extracted_procedures=[],
        consultation_amount=1000,
        diagnostic_amount=500,
        treatment_date_from_doc="2024-11-01",
        bill_date_from_doc="2024-11-01",
    )
    result = adjudicate_claim(inp)
    assert result.status == "APPROVED"
    assert abs(result.approved_amount - 1350) <= 5
    assert result.confidence >= 0.9


# ── TC002: Dental Treatment - Partial Approval ────────────────────────────────

def test_tc002_dental_partial():
    inp = _make_input(
        member_id="EMP002",
        member_name="Priya Singh",
        treatment_date="2024-10-15",
        submitted_at="2024-10-25",
        claimed_amount=12000,
        provider_name="Dental Clinic",
        extracted_patient_name="Priya Singh",
        extracted_doctor_name="Dr. Patel",
        extracted_doctor_reg="MH/23456/2018",
        extracted_diagnosis="Tooth decay requiring root canal",
        extracted_procedures=["Root canal treatment", "Teeth whitening"],
        treatment_date_from_doc="2024-10-15",
        bill_date_from_doc="2024-10-15",
        itemized_amounts={"teeth whitening": 4000, "root canal treatment": 8000},
    )
    result = adjudicate_claim(inp)
    assert result.status == "PARTIAL"
    assert abs(result.approved_amount - 8000) <= 200
    assert result.confidence >= 0.85


# ── TC003: Limit Exceeded - Rejected ──────────────────────────────────────────

def test_tc003_limit_exceeded():
    inp = _make_input(
        member_id="EMP003",
        member_name="Amit Verma",
        treatment_date="2024-10-20",
        submitted_at="2024-10-30",
        claimed_amount=7500,
        provider_name="General Hospital",
        extracted_patient_name="Amit Verma",
        extracted_doctor_name="Dr. Gupta",
        extracted_doctor_reg="DL/34567/2016",
        extracted_diagnosis="Gastroenteritis",
        extracted_medicines=["Antibiotics", "Probiotics"],
        consultation_amount=2000,
        pharmacy_amount=5500,
        treatment_date_from_doc="2024-10-20",
        bill_date_from_doc="2024-10-20",
    )
    result = adjudicate_claim(inp)
    assert result.status == "REJECTED"
    assert "PER_CLAIM_EXCEEDED" in result.rejection_codes
    assert result.confidence >= 0.9


# ── TC004: Missing Documents - Rejected ───────────────────────────────────────

def test_tc004_missing_documents():
    inp = _make_input(
        member_id="EMP004",
        member_name="Sneha Reddy",
        treatment_date="2024-10-25",
        submitted_at="2024-11-01",
        claimed_amount=2000,
        provider_name="Local Clinic",
        has_prescription=False,
        has_bill=True,
        extracted_patient_name=None,
        extracted_doctor_name=None,
        extracted_doctor_reg=None,
        extracted_diagnosis=None,
        consultation_amount=1500,
        pharmacy_amount=500,
        bill_date_from_doc="2024-10-25",
    )
    result = adjudicate_claim(inp)
    assert result.status == "REJECTED"
    assert "MISSING_DOCUMENTS" in result.rejection_codes
    assert result.confidence >= 0.95


# ── TC005: Pre-existing Condition - Waiting Period ────────────────────────────

def test_tc005_waiting_period():
    inp = _make_input(
        member_id="EMP005",
        member_name="Vikram Joshi",
        member_join_date="2024-09-01",
        treatment_date="2024-10-15",
        submitted_at="2024-10-25",
        claimed_amount=3000,
        provider_name="Diabetes Care Center",
        extracted_patient_name="Vikram Joshi",
        extracted_doctor_name="Dr. Mehta",
        extracted_doctor_reg="GJ/56789/2014",
        extracted_diagnosis="Type 2 Diabetes",
        extracted_medicines=["Metformin", "Glimepiride"],
        consultation_amount=1000,
        pharmacy_amount=2000,
        treatment_date_from_doc="2024-10-15",
        bill_date_from_doc="2024-10-15",
    )
    result = adjudicate_claim(inp)
    assert result.status == "REJECTED"
    assert "WAITING_PERIOD" in result.rejection_codes
    assert result.confidence >= 0.9


# ── TC006: Alternative Medicine - Approved ────────────────────────────────────

def test_tc006_alternative_medicine():
    inp = _make_input(
        member_id="EMP006",
        member_name="Kavita Nair",
        treatment_date="2024-10-28",
        submitted_at="2024-11-05",
        claimed_amount=4000,
        provider_name="Ayurveda Wellness Center",
        extracted_patient_name="Kavita Nair",
        extracted_doctor_name="Vaidya Krishnan",
        extracted_doctor_reg="AYUR/KL/2345/2019",
        extracted_diagnosis="Chronic joint pain",
        extracted_procedures=["Panchakarma therapy", "Ayurvedic consultation"],
        consultation_amount=1000,
        treatment_date_from_doc="2024-10-28",
        bill_date_from_doc="2024-10-28",
    )
    result = adjudicate_claim(inp)
    assert result.status == "APPROVED"
    assert abs(result.approved_amount - 3600) <= 500
    assert result.confidence >= 0.8


# ── TC007: Diagnostic Tests - Pre-auth Required ──────────────────────────────

def test_tc007_pre_auth_required():
    inp = _make_input(
        member_id="EMP007",
        member_name="Suresh Patil",
        treatment_date="2024-11-02",
        submitted_at="2024-11-10",
        claimed_amount=15000,
        provider_name="Imaging Center",
        extracted_patient_name="Suresh Patil",
        extracted_doctor_name="Dr. Rao",
        extracted_doctor_reg="AP/67890/2017",
        extracted_diagnosis="Suspected lumbar disc herniation",
        extracted_procedures=["MRI Lumbar Spine"],
        diagnostic_amount=15000,
        treatment_date_from_doc="2024-11-02",
        bill_date_from_doc="2024-11-02",
    )
    result = adjudicate_claim(inp)
    assert result.status == "REJECTED"
    assert "PER_CLAIM_EXCEEDED" in result.rejection_codes
    assert "PRE_AUTH_MISSING" in result.rejection_codes
    assert result.confidence >= 0.85


# ── TC008: Fraud Detection - Manual Review ────────────────────────────────────

def test_tc008_fraud_manual_review():
    inp = _make_input(
        member_id="EMP008",
        member_name="Ravi Menon",
        treatment_date="2024-10-30",
        submitted_at="2024-11-05",
        claimed_amount=4800,
        provider_name="General Hospital",
        extracted_patient_name="Ravi Menon",
        extracted_doctor_name="Dr. Khan",
        extracted_doctor_reg="UP/45678/2016",
        extracted_diagnosis="Migraine",
        extracted_medicines=["Sumatriptan", "Propranolol"],
        consultation_amount=2000,
        pharmacy_amount=2800,
        treatment_date_from_doc="2024-10-30",
        bill_date_from_doc="2024-10-30",
        previous_claims_same_day=3,
    )
    result = adjudicate_claim(inp)
    assert result.status == "MANUAL_REVIEW"
    assert result.confidence <= 0.8


# ── TC009: Excluded Treatment - Rejected ──────────────────────────────────────

def test_tc009_excluded_treatment():
    inp = _make_input(
        member_id="EMP009",
        member_name="Anita Desai",
        treatment_date="2024-10-18",
        submitted_at="2024-10-28",
        claimed_amount=8000,
        provider_name="Weight Loss Clinic",
        extracted_patient_name="Anita Desai",
        extracted_doctor_name="Dr. Banerjee",
        extracted_doctor_reg="WB/34567/2015",
        extracted_diagnosis="Obesity - BMI 35",
        extracted_procedures=["Bariatric consultation", "Diet plan"],
        consultation_amount=3000,
        treatment_date_from_doc="2024-10-18",
        bill_date_from_doc="2024-10-18",
    )
    result = adjudicate_claim(inp)
    assert result.status == "REJECTED"
    assert "PER_CLAIM_EXCEEDED" in result.rejection_codes or "SERVICE_NOT_COVERED" in result.rejection_codes
    assert result.confidence >= 0.85


# ── TC010: Network Hospital - Cashless Approved ──────────────────────────────

def test_tc010_network_cashless():
    inp = _make_input(
        member_id="EMP010",
        member_name="Deepak Shah",
        treatment_date="2024-11-03",
        submitted_at="2024-11-10",
        claimed_amount=4500,
        provider_name="Apollo Hospitals",
        cashless_request=True,
        extracted_patient_name="Deepak Shah",
        extracted_doctor_name="Dr. Iyer",
        extracted_doctor_reg="TN/56789/2013",
        extracted_diagnosis="Acute bronchitis",
        extracted_medicines=["Antibiotics", "Bronchodilators"],
        consultation_amount=1500,
        pharmacy_amount=3000,
        treatment_date_from_doc="2024-11-03",
        bill_date_from_doc="2024-11-03",
    )
    result = adjudicate_claim(inp)
    assert result.status == "APPROVED"
    assert abs(result.approved_amount - 3600) <= 5
    assert result.confidence >= 0.85
