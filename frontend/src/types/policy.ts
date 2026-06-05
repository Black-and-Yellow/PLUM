export interface PolicyHolder {
  company: string;
  employees_covered: number;
  dependents_covered: boolean;
}

export interface SubLimitConfig {
  covered: boolean;
  sub_limit: number;
  copay_percentage?: number;
  network_discount?: number;
  pre_authorization_required?: boolean;
  covered_tests?: string[];
  generic_drugs_mandatory?: boolean;
  branded_drugs_copay?: number;
  routine_checkup_limit?: number;
  procedures_covered?: string[];
  cosmetic_procedures?: boolean;
  eye_test_covered?: boolean;
  glasses_contact_lenses?: boolean;
  lasik_surgery?: boolean;
  covered_treatments?: string[];
  therapy_sessions_limit?: number;
}

export interface CoverageDetails {
  annual_limit: number;
  per_claim_limit: number;
  family_floater_limit: number;
  consultation_fees: SubLimitConfig;
  diagnostic_tests: SubLimitConfig;
  pharmacy: SubLimitConfig;
  dental: SubLimitConfig;
  vision: SubLimitConfig;
  alternative_medicine: SubLimitConfig;
}

export interface SpecificAilmentWaiting {
  diabetes: number;
  hypertension: number;
  joint_replacement: number;
}

export interface WaitingPeriods {
  initial_waiting: number;
  pre_existing_diseases: number;
  maternity: number;
  specific_ailments: SpecificAilmentWaiting;
}

export interface ClaimRequirements {
  documents_required: string[];
  submission_timeline_days: number;
  minimum_claim_amount: number;
}

export interface CashlessFacilities {
  available: boolean;
  network_only: boolean;
  pre_approval_required: boolean;
  instant_approval_limit: number;
}

export interface PolicyTerms {
  policy_id: string;
  policy_name: string;
  effective_date: string;
  policy_holder: PolicyHolder;
  coverage_details: CoverageDetails;
  waiting_periods: WaitingPeriods;
  exclusions: string[];
  claim_requirements: ClaimRequirements;
  network_hospitals: string[];
  cashless_facilities: CashlessFacilities;
}

export type ServiceCategory =
  | 'consultation_fees'
  | 'diagnostic_tests'
  | 'pharmacy'
  | 'dental'
  | 'vision'
  | 'alternative_medicine';
