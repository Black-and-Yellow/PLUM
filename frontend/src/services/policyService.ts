import policyTerms from '../data/policyTerms';

const policy = policyTerms;

// Diagnosis keywords mapped to specific ailment waiting periods
const SPECIFIC_AILMENT_KEYWORDS: Record<string, keyof typeof policy.waiting_periods.specific_ailments> = {
  diabetes: 'diabetes',
  'type 2 diabetes': 'diabetes',
  'type 1 diabetes': 'diabetes',
  'diabetic': 'diabetes',
  hypertension: 'hypertension',
  'high blood pressure': 'hypertension',
  'joint replacement': 'joint_replacement',
  'knee replacement': 'joint_replacement',
  'hip replacement': 'joint_replacement',
};

// Exclusion keyword matchers
const EXCLUSION_KEYWORDS: Record<string, string[]> = {
  'Cosmetic procedures': ['cosmetic', 'whitening', 'teeth whitening', 'botox', 'facelift', 'liposuction', 'rhinoplasty'],
  'Weight loss treatments': ['weight loss', 'obesity', 'bariatric', 'diet plan', 'slimming'],
  'Infertility treatments': ['infertility', 'ivf', 'iui', 'surrogacy'],
  'Experimental treatments': ['experimental', 'clinical trial', 'unproven'],
  'Self-inflicted injuries': ['self-inflicted', 'self harm'],
  'Adventure sports injuries': ['adventure sports', 'skydiving', 'bungee'],
  'HIV/AIDS treatment': ['hiv', 'aids'],
  'Alcoholism/drug abuse treatment': ['alcoholism', 'drug abuse', 'detox'],
};

// Pre-auth required tests
const PRE_AUTH_TESTS = ['mri', 'ct scan', 'ct-scan', 'magnetic resonance'];

// Doctor registration formats: [State]/[Number]/[Year] or AYUR/[State]/[Number]/[Year]
const DOCTOR_REG_REGEX = /^([A-Z]+\/)?[A-Z]{2,4}\/\d+\/\d{4}$/i;

export const policyService = {
  getPolicy() {
    return policy;
  },

  isPolicyActive(treatmentDate: string): boolean {
    const effectiveDate = new Date(policy.effective_date);
    const treatment = new Date(treatmentDate);
    return treatment >= effectiveDate;
  },

  /**
   * Returns waiting period days remaining (0 if satisfied)
   * Returns -1 if not applicable
   */
  getWaitingPeriodResult(
    diagnosis: string,
    memberJoinDate: string,
    treatmentDate: string
  ): { daysRequired: number; daysServed: number; eligible: boolean; type: string; eligibleFrom: string } {
    const join = new Date(memberJoinDate);
    const treatment = new Date(treatmentDate);
    const daysServed = Math.floor((treatment.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
    const diagLower = diagnosis.toLowerCase();

    // Check specific ailment waiting periods first
    for (const [keyword, ailment] of Object.entries(SPECIFIC_AILMENT_KEYWORDS)) {
      if (diagLower.includes(keyword)) {
        const daysRequired = policy.waiting_periods.specific_ailments[ailment];
        const eligibleFrom = new Date(join.getTime() + daysRequired * 24 * 60 * 60 * 1000);
        return {
          daysRequired,
          daysServed,
          eligible: daysServed >= daysRequired,
          type: `specific_ailment:${ailment}`,
          eligibleFrom: eligibleFrom.toISOString().split('T')[0],
        };
      }
    }

    // Initial waiting period
    const initialDays = policy.waiting_periods.initial_waiting;
    const eligibleFrom = new Date(join.getTime() + initialDays * 24 * 60 * 60 * 1000);
    return {
      daysRequired: initialDays,
      daysServed,
      eligible: daysServed >= initialDays,
      type: 'initial_waiting',
      eligibleFrom: eligibleFrom.toISOString().split('T')[0],
    };
  },

  isExcluded(
    diagnosis: string,
    procedures: string[],
    treatment?: string
  ): { excluded: boolean; reason: string } {
    const diagLower = diagnosis.toLowerCase();
    const procText = procedures.join(' ').toLowerCase();
    const treatText = (treatment ?? '').toLowerCase();
    const combined = `${diagLower} ${procText} ${treatText}`;

    for (const [exclusion, keywords] of Object.entries(EXCLUSION_KEYWORDS)) {
      for (const kw of keywords) {
        if (combined.includes(kw)) {
          return { excluded: true, reason: exclusion };
        }
      }
    }
    return { excluded: false, reason: '' };
  },

  getSubLimit(category: string): number {
    const cd = policy.coverage_details as unknown as Record<string, { sub_limit?: number; max_amount?: number }>;
    const section = cd[category];
    if (!section) return policy.coverage_details.per_claim_limit;
    return section.sub_limit ?? section.max_amount ?? policy.coverage_details.per_claim_limit;
  },

  isWithinAnnualLimit(ytdAmount: number, claimAmount: number): boolean {
    return ytdAmount + claimAmount <= policy.coverage_details.annual_limit;
  },

  isWithinPerClaimLimit(amount: number): boolean {
    return amount <= policy.coverage_details.per_claim_limit;
  },

  /**
   * Apply copay. Default 10% for consultation.
   * For network hospitals, apply network discount instead.
   */
  applyCopay(amount: number, isNetworkProvider: boolean): { copayAmount: number; payableAmount: number } {
    if (isNetworkProvider) {
      return { copayAmount: 0, payableAmount: amount };
    }
    const copayPct = policy.coverage_details.consultation_fees.copay_percentage ?? 10;
    const copayAmount = Math.round(amount * (copayPct / 100));
    return { copayAmount, payableAmount: amount - copayAmount };
  },

  applyNetworkDiscount(amount: number, isNetworkProvider: boolean): { discountAmount: number; payableAmount: number } {
    if (!isNetworkProvider) {
      return { discountAmount: 0, payableAmount: amount };
    }
    const discountPct = policy.coverage_details.consultation_fees.network_discount ?? 20;
    const discountAmount = Math.round(amount * (discountPct / 100));
    return { discountAmount, payableAmount: amount - discountAmount };
  },

  requiresPreAuth(procedures: string[], tests: string[]): boolean {
    const combined = [...procedures, ...tests].join(' ').toLowerCase();
    return PRE_AUTH_TESTS.some(t => combined.includes(t));
  },

  isNetworkProvider(providerName: string): boolean {
    const lower = providerName.toLowerCase();
    return policy.network_hospitals.some(h => lower.includes(h.toLowerCase()) || h.toLowerCase().includes(lower));
  },

  isValidDoctorReg(regNumber: string): boolean {
    return DOCTOR_REG_REGEX.test(regNumber.trim());
  },

  getMinimumClaimAmount(): number {
    return policy.claim_requirements.minimum_claim_amount;
  },

  getSubmissionTimelineDays(): number {
    return policy.claim_requirements.submission_timeline_days;
  },

  isLateSubmission(treatmentDate: string, submissionDate: string): boolean {
    const treatment = new Date(treatmentDate);
    const submission = new Date(submissionDate);
    const diffDays = Math.floor((submission.getTime() - treatment.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > policy.claim_requirements.submission_timeline_days;
  },

  /**
   * Detect cosmetic dental procedures from procedures list
   */
  hasCosmeticDentalProcedure(procedures: string[]): string[] {
    const cosmeticKeywords = ['whitening', 'cosmetic', 'veneer', 'aesthetic', 'teeth whitening'];
    return procedures.filter(p => cosmeticKeywords.some(k => p.toLowerCase().includes(k)));
  },

  /**
   * Get covered dental procedures
   */
  getCoveredDentalProcedures(procedures: string[]): string[] {
    const covered = policy.coverage_details.dental.procedures_covered ?? [];
    return procedures.filter(p =>
      covered.some(c => p.toLowerCase().includes(c.toLowerCase()))
    );
  },

  isAlternativeMedicineCovered(treatment: string): boolean {
    const coveredTreatments = policy.coverage_details.alternative_medicine.covered_treatments ?? [];
    const lower = treatment.toLowerCase();
    return coveredTreatments.some(t => lower.includes(t.toLowerCase()));
  },
};
