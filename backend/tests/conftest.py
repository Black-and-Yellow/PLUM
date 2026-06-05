"""Pytest fixtures for backend tests."""

import pytest


@pytest.fixture
def sample_claim_data():
    """Sample claim creation data."""
    return {
        "member_id": "EMP001",
        "member_name": "Rajesh Kumar",
        "member_join_date": "2024-01-01",
        "relationship": "employee",
        "treatment_date": "2024-11-01",
        "provider_name": "City Clinic",
        "cashless_request": False,
        "claimed_amount": 1500,
        "previous_claims_same_day": 0,
        "extracted_patient_name": "Rajesh Kumar",
        "extracted_doctor_name": "Dr. Sharma",
        "extracted_doctor_reg": "KA/45678/2015",
        "extracted_diagnosis": "Viral fever",
        "extracted_medicines": ["Paracetamol 650mg", "Vitamin C"],
        "extracted_procedures": [],
        "consultation_amount": 1000,
        "pharmacy_amount": 0,
        "diagnostic_amount": 500,
        "treatment_date_from_doc": "2024-11-01",
        "bill_date_from_doc": "2024-11-01",
        "has_prescription": True,
        "has_bill": True,
        "ytd_approved_amount": 0,
    }
