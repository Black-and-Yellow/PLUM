/**
 * Test runner for all 10 test cases from test_cases.json
 * Run with: npx tsx src/services/__tests__/testRunner.ts
 */

import { adjudicateClaim, type AdjudicationInput } from '../adjudicationEngine';

interface TestCase {
  case_id: string;
  case_name: string;
  input: AdjudicationInput;
  expected: {
    decision: string;
    approved_amount?: number;
    rejection_codes?: string[];
    confidence_min?: number;
    confidence_max?: number;
  };
  tolerance?: number;
}

const TEST_CASES: TestCase[] = [
  // TC001: Simple Consultation - Approved
  {
    case_id: 'TC001',
    case_name: 'Simple Consultation - Approved',
    input: {
      memberId: 'EMP001',
      memberName: 'Rajesh Kumar',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-11-01',
      submittedAt: '2024-11-15',
      claimedAmount: 1500,
      providerName: 'City Clinic',
      cashlessRequest: false,
      extractedPatientName: 'Rajesh Kumar',
      extractedDoctorName: 'Dr. Sharma',
      extractedDoctorReg: 'KA/45678/2015',
      extractedDiagnosis: 'Viral fever',
      extractedMedicines: ['Paracetamol 650mg', 'Vitamin C'],
      extractedProcedures: [],
      consultationAmount: 1000,
      pharmacyAmount: 0,
      diagnosticAmount: 500,
      treatmentDateFromDoc: '2024-11-01',
      billDateFromDoc: '2024-11-01',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'APPROVED', approved_amount: 1350, confidence_min: 0.9 },
    tolerance: 5,
  },

  // TC002: Dental Treatment - Partial Approval
  {
    case_id: 'TC002',
    case_name: 'Dental Treatment - Partial Approval',
    input: {
      memberId: 'EMP002',
      memberName: 'Priya Singh',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-10-15',
      submittedAt: '2024-10-25',
      claimedAmount: 12000,
      providerName: 'Dental Clinic',
      cashlessRequest: false,
      extractedPatientName: 'Priya Singh',
      extractedDoctorName: 'Dr. Patel',
      extractedDoctorReg: 'MH/23456/2018',
      extractedDiagnosis: 'Tooth decay requiring root canal',
      extractedMedicines: [],
      extractedProcedures: ['Root canal treatment', 'Teeth whitening'],
      consultationAmount: 0,
      pharmacyAmount: 0,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-10-15',
      billDateFromDoc: '2024-10-15',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
      // Itemized amounts from bill (root_canal=8000, teeth_whitening=4000)
      itemizedAmounts: { 'teeth whitening': 4000, 'root canal treatment': 8000 },
    },
    expected: { decision: 'PARTIAL', approved_amount: 8000, confidence_min: 0.85 },
    tolerance: 200,
  },

  // TC003: Limit Exceeded - Rejected
  {
    case_id: 'TC003',
    case_name: 'Limit Exceeded - Rejected',
    input: {
      memberId: 'EMP003',
      memberName: 'Amit Verma',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-10-20',
      submittedAt: '2024-10-30',
      claimedAmount: 7500,
      providerName: 'General Hospital',
      cashlessRequest: false,
      extractedPatientName: 'Amit Verma',
      extractedDoctorName: 'Dr. Gupta',
      extractedDoctorReg: 'DL/34567/2016',
      extractedDiagnosis: 'Gastroenteritis',
      extractedMedicines: ['Antibiotics', 'Probiotics'],
      extractedProcedures: [],
      consultationAmount: 2000,
      pharmacyAmount: 5500,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-10-20',
      billDateFromDoc: '2024-10-20',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'REJECTED', rejection_codes: ['PER_CLAIM_EXCEEDED'], confidence_min: 0.9 },
  },

  // TC004: Missing Documents - Rejected
  {
    case_id: 'TC004',
    case_name: 'Missing Documents - Rejected',
    input: {
      memberId: 'EMP004',
      memberName: 'Sneha Reddy',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-10-25',
      submittedAt: '2024-11-01',
      claimedAmount: 2000,
      providerName: 'Local Clinic',
      cashlessRequest: false,
      extractedPatientName: null,
      extractedDoctorName: null,
      extractedDoctorReg: null,
      extractedDiagnosis: null,
      extractedMedicines: [],
      extractedProcedures: [],
      consultationAmount: 1500,
      pharmacyAmount: 500,
      diagnosticAmount: 0,
      treatmentDateFromDoc: null,
      billDateFromDoc: '2024-10-25',
      hasPrescription: false,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'REJECTED', rejection_codes: ['MISSING_DOCUMENTS'], confidence_min: 0.95 },
  },

  // TC005: Pre-existing Condition - Waiting Period
  {
    case_id: 'TC005',
    case_name: 'Pre-existing Condition - Waiting Period',
    input: {
      memberId: 'EMP005',
      memberName: 'Vikram Joshi',
      memberJoinDate: '2024-09-01',
      treatmentDate: '2024-10-15',
      submittedAt: '2024-10-25',
      claimedAmount: 3000,
      providerName: 'Diabetes Care Center',
      cashlessRequest: false,
      extractedPatientName: 'Vikram Joshi',
      extractedDoctorName: 'Dr. Mehta',
      extractedDoctorReg: 'GJ/56789/2014',
      extractedDiagnosis: 'Type 2 Diabetes',
      extractedMedicines: ['Metformin', 'Glimepiride'],
      extractedProcedures: [],
      consultationAmount: 1000,
      pharmacyAmount: 2000,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-10-15',
      billDateFromDoc: '2024-10-15',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'REJECTED', rejection_codes: ['WAITING_PERIOD'], confidence_min: 0.9 },
  },

  // TC006: Alternative Medicine - Approved
  {
    case_id: 'TC006',
    case_name: 'Alternative Medicine - Approved',
    input: {
      memberId: 'EMP006',
      memberName: 'Kavita Nair',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-10-28',
      submittedAt: '2024-11-05',
      claimedAmount: 4000,
      providerName: 'Ayurveda Wellness Center',
      cashlessRequest: false,
      extractedPatientName: 'Kavita Nair',
      extractedDoctorName: 'Vaidya Krishnan',
      extractedDoctorReg: 'AYUR/KL/2345/2019',
      extractedDiagnosis: 'Chronic joint pain',
      extractedMedicines: [],
      extractedProcedures: ['Panchakarma therapy', 'Ayurvedic consultation'],
      consultationAmount: 1000,
      pharmacyAmount: 0,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-10-28',
      billDateFromDoc: '2024-10-28',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'APPROVED', approved_amount: 3600, confidence_min: 0.8 },
    tolerance: 500,
  },

  // TC007: Diagnostic Tests - Pre-auth Required
  {
    case_id: 'TC007',
    case_name: 'Diagnostic Tests - Pre-auth Required',
    input: {
      memberId: 'EMP007',
      memberName: 'Suresh Patil',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-11-02',
      submittedAt: '2024-11-10',
      claimedAmount: 15000,
      providerName: 'Imaging Center',
      cashlessRequest: false,
      extractedPatientName: 'Suresh Patil',
      extractedDoctorName: 'Dr. Rao',
      extractedDoctorReg: 'AP/67890/2017',
      extractedDiagnosis: 'Suspected lumbar disc herniation',
      extractedMedicines: [],
      extractedProcedures: ['MRI Lumbar Spine'],
      consultationAmount: 0,
      pharmacyAmount: 0,
      diagnosticAmount: 15000,
      treatmentDateFromDoc: '2024-11-02',
      billDateFromDoc: '2024-11-02',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'REJECTED', rejection_codes: ['PER_CLAIM_EXCEEDED', 'PRE_AUTH_MISSING'], confidence_min: 0.85 },
  },

  // TC008: Fraud Detection - Manual Review
  {
    case_id: 'TC008',
    case_name: 'Fraud Detection - Manual Review',
    input: {
      memberId: 'EMP008',
      memberName: 'Ravi Menon',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-10-30',
      submittedAt: '2024-11-05',
      claimedAmount: 4800,
      providerName: 'General Hospital',
      cashlessRequest: false,
      extractedPatientName: 'Ravi Menon',
      extractedDoctorName: 'Dr. Khan',
      extractedDoctorReg: 'UP/45678/2016',
      extractedDiagnosis: 'Migraine',
      extractedMedicines: ['Sumatriptan', 'Propranolol'],
      extractedProcedures: [],
      consultationAmount: 2000,
      pharmacyAmount: 2800,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-10-30',
      billDateFromDoc: '2024-10-30',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 3,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'MANUAL_REVIEW', confidence_max: 0.8 },
  },

  // TC009: Excluded Treatment - Rejected
  {
    case_id: 'TC009',
    case_name: 'Excluded Treatment - Rejected',
    input: {
      memberId: 'EMP009',
      memberName: 'Anita Desai',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-10-18',
      submittedAt: '2024-10-28',
      claimedAmount: 8000,
      providerName: 'Weight Loss Clinic',
      cashlessRequest: false,
      extractedPatientName: 'Anita Desai',
      extractedDoctorName: 'Dr. Banerjee',
      extractedDoctorReg: 'WB/34567/2015',
      extractedDiagnosis: 'Obesity - BMI 35',
      extractedMedicines: [],
      extractedProcedures: ['Bariatric consultation', 'Diet plan'],
      consultationAmount: 3000,
      pharmacyAmount: 0,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-10-18',
      billDateFromDoc: '2024-10-18',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'REJECTED', rejection_codes: ['PER_CLAIM_EXCEEDED', 'SERVICE_NOT_COVERED'], confidence_min: 0.85 },
  },

  // TC010: Network Hospital - Cashless Approved
  {
    case_id: 'TC010',
    case_name: 'Network Hospital - Cashless Approved',
    input: {
      memberId: 'EMP010',
      memberName: 'Deepak Shah',
      memberJoinDate: '2024-01-01',
      treatmentDate: '2024-11-03',
      submittedAt: '2024-11-10',
      claimedAmount: 4500,
      providerName: 'Apollo Hospitals',
      cashlessRequest: true,
      extractedPatientName: 'Deepak Shah',
      extractedDoctorName: 'Dr. Iyer',
      extractedDoctorReg: 'TN/56789/2013',
      extractedDiagnosis: 'Acute bronchitis',
      extractedMedicines: ['Antibiotics', 'Bronchodilators'],
      extractedProcedures: [],
      consultationAmount: 1500,
      pharmacyAmount: 3000,
      diagnosticAmount: 0,
      treatmentDateFromDoc: '2024-11-03',
      billDateFromDoc: '2024-11-03',
      hasPrescription: true,
      hasBill: true,
      previousClaimsSameDay: 0,
      ytdApprovedAmount: 0,
    },
    expected: { decision: 'APPROVED', approved_amount: 3600, confidence_min: 0.85 },
    tolerance: 5,
  },
];

// ── Run Tests ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

console.log('\n' + '═'.repeat(60));
console.log('  OPD Claims Adjudication — Test Runner');
console.log('═'.repeat(60));

for (const tc of TEST_CASES) {
  const result = adjudicateClaim(tc.input);
  const issues: string[] = [];

  // Check decision status
  if (result.status !== tc.expected.decision) {
    issues.push(`Decision: expected "${tc.expected.decision}", got "${result.status}"`);
  }

  // Check approved amount (if applicable)
  if (tc.expected.approved_amount !== undefined) {
    const tolerance = tc.tolerance ?? 0;
    const diff = Math.abs(result.approvedAmount - tc.expected.approved_amount);
    if (diff > tolerance) {
      issues.push(`Approved amount: expected ${tc.expected.approved_amount}, got ${result.approvedAmount} (diff: ${diff})`);
    }
  }

  // Check rejection codes (subset match)
  if (tc.expected.rejection_codes) {
    for (const code of tc.expected.rejection_codes) {
      if (!result.rejectionCodes.includes(code)) {
        issues.push(`Missing rejection code: "${code}" (got: [${result.rejectionCodes.join(', ')}])`);
      }
    }
  }

  // Check confidence
  if (tc.expected.confidence_min !== undefined && result.confidence < tc.expected.confidence_min) {
    issues.push(`Confidence too low: expected ≥${tc.expected.confidence_min}, got ${result.confidence}`);
  }
  if (tc.expected.confidence_max !== undefined && result.confidence > tc.expected.confidence_max) {
    issues.push(`Confidence too high: expected ≤${tc.expected.confidence_max}, got ${result.confidence}`);
  }

  if (issues.length === 0) {
    console.log(`✅ ${tc.case_id}: ${tc.case_name}`);
    console.log(`   Status: ${result.status} | Approved: ₹${result.approvedAmount} | Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    passed++;
  } else {
    console.log(`❌ ${tc.case_id}: ${tc.case_name}`);
    issues.forEach(i => console.log(`   ⚠ ${i}`));
    console.log(`   Status: ${result.status} | Approved: ₹${result.approvedAmount} | Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`   Codes: [${result.rejectionCodes.join(', ')}]`);
    failed++;
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`  Results: ${passed}/${TEST_CASES.length} passed, ${failed} failed`);
console.log('─'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
