"""Policy terms model and default data matching policy_terms.json."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class PolicyHolder(BaseModel):
    company: str = "TechCorp Solutions Pvt Ltd"
    employees_covered: int = 500
    dependents_covered: bool = True


class SubLimitConfig(BaseModel):
    covered: bool = True
    sub_limit: int = 0
    copay_percentage: Optional[int] = None
    network_discount: Optional[int] = None
    pre_authorization_required: Optional[bool] = None
    covered_tests: Optional[list[str]] = None
    generic_drugs_mandatory: Optional[bool] = None
    branded_drugs_copay: Optional[int] = None
    routine_checkup_limit: Optional[int] = None
    procedures_covered: Optional[list[str]] = None
    cosmetic_procedures: Optional[bool] = None
    eye_test_covered: Optional[bool] = None
    glasses_contact_lenses: Optional[bool] = None
    lasik_surgery: Optional[bool] = None
    covered_treatments: Optional[list[str]] = None
    therapy_sessions_limit: Optional[int] = None
    # Allow extra fields so max_amount etc. work
    max_amount: Optional[int] = None


class CoverageDetails(BaseModel):
    annual_limit: int = 50000
    per_claim_limit: int = 5000
    family_floater_limit: int = 150000
    consultation_fees: SubLimitConfig = Field(default_factory=lambda: SubLimitConfig(
        covered=True, sub_limit=2000, copay_percentage=10, network_discount=20
    ))
    diagnostic_tests: SubLimitConfig = Field(default_factory=lambda: SubLimitConfig(
        covered=True, sub_limit=10000, pre_authorization_required=False,
        covered_tests=["Blood tests", "Urine tests", "X-rays", "ECG", "Ultrasound",
                        "MRI (with pre-auth)", "CT Scan (with pre-auth)"]
    ))
    pharmacy: SubLimitConfig = Field(default_factory=lambda: SubLimitConfig(
        covered=True, sub_limit=15000, generic_drugs_mandatory=True, branded_drugs_copay=30
    ))
    dental: SubLimitConfig = Field(default_factory=lambda: SubLimitConfig(
        covered=True, sub_limit=10000, routine_checkup_limit=2000,
        procedures_covered=["Filling", "Extraction", "Root canal", "Cleaning"],
        cosmetic_procedures=False
    ))
    vision: SubLimitConfig = Field(default_factory=lambda: SubLimitConfig(
        covered=True, sub_limit=5000, eye_test_covered=True,
        glasses_contact_lenses=True, lasik_surgery=False
    ))
    alternative_medicine: SubLimitConfig = Field(default_factory=lambda: SubLimitConfig(
        covered=True, sub_limit=8000,
        covered_treatments=["Ayurveda", "Homeopathy", "Unani"],
        therapy_sessions_limit=20
    ))


class SpecificAilments(BaseModel):
    diabetes: int = 90
    hypertension: int = 90
    joint_replacement: int = 730


class WaitingPeriods(BaseModel):
    initial_waiting: int = 30
    pre_existing_diseases: int = 365
    maternity: int = 270
    specific_ailments: SpecificAilments = Field(default_factory=SpecificAilments)


class ClaimRequirements(BaseModel):
    documents_required: list[str] = Field(default_factory=lambda: [
        "Original bills and receipts",
        "Prescription from registered doctor",
        "Diagnostic test reports (if applicable)",
        "Pharmacy bills with prescription",
        "Doctor's registration number must be visible",
        "Patient details must match policy records",
    ])
    submission_timeline_days: int = 30
    minimum_claim_amount: int = 500


class CashlessFacilities(BaseModel):
    available: bool = True
    network_only: bool = True
    pre_approval_required: bool = False
    instant_approval_limit: int = 5000


class PolicyTerms(BaseModel):
    policy_id: str = "PLUM_OPD_2024"
    policy_name: str = "Plum OPD Advantage"
    effective_date: str = "2024-01-01"
    policy_holder: PolicyHolder = Field(default_factory=PolicyHolder)
    coverage_details: CoverageDetails = Field(default_factory=CoverageDetails)
    waiting_periods: WaitingPeriods = Field(default_factory=WaitingPeriods)
    exclusions: list[str] = Field(default_factory=lambda: [
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
        "Vitamins and supplements (unless prescribed for deficiency)",
    ])
    claim_requirements: ClaimRequirements = Field(default_factory=ClaimRequirements)
    network_hospitals: list[str] = Field(default_factory=lambda: [
        "Apollo Hospitals", "Fortis Healthcare", "Max Healthcare",
        "Manipal Hospitals", "Narayana Health",
    ])
    cashless_facilities: CashlessFacilities = Field(default_factory=CashlessFacilities)
