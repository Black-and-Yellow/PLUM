export type DecisionStatus = 'APPROVED' | 'REJECTED' | 'PARTIAL' | 'MANUAL_REVIEW';
export type RuleResult = 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
export type FraudRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  step: number;
  result: RuleResult;
  reason: string;
  rejectionCode?: string;
  impact?: string;
}

export interface ConfidenceBreakdown {
  eligibility: number;
  documents: number;
  coverage: number;
  limits: number;
  medical: number;
}

export interface FraudResult {
  score: number;
  riskLevel: FraudRiskLevel;
  flags: string[];
  requiresManualReview: boolean;
}

export interface FinancialBreakdown {
  claimedAmount: number;
  consultationClaimed: number;
  pharmacyClaimed: number;
  diagnosticClaimed: number;
  copayAmount: number;
  copayPercentage: number;
  networkDiscount: number;
  sublimitDeductions: number;
  approvedAmount: number;
}

export interface AdjudicationDecision {
  status: DecisionStatus;
  claimedAmount: number;
  approvedAmount: number;
  copayAmount: number;
  networkDiscount: number;
  rejectionReasons: string[];
  rejectionCodes: string[];
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  fraudScore: number;
  fraudRisk: FraudRiskLevel;
  fraudFlags: string[];
  ruleEvaluations: RuleEvaluationResult[];
  financialBreakdown: FinancialBreakdown;
  medicalNecessityScore: number;
  medicalNecessityReasoning: string;
  nextSteps: string[];
  notes: string;
  processedAt: string;
}

export interface MedicalNecessityResult {
  score: number;
  reasoning: string;
}
