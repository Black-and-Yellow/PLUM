import type { FraudResult, FraudRiskLevel } from '../types/decision';
import { storageService } from './storageService';

const SAME_DAY_CLAIM_THRESHOLD = 2;
const HIGH_FREQUENCY_DAYS = 30;
const HIGH_FREQUENCY_COUNT = 5;
const HIGH_VALUE_THRESHOLD = 25000;
const SUSPICIOUS_AMOUNT_PATTERN = 4999; // Just below per-claim limit

interface FraudInput {
  memberId: string;
  treatmentDate: string;
  claimAmount: number;
  providerName: string;
  diagnosis: string;
  previousClaimsSameDay?: number;
  documents?: Array<{ base64?: string }>;
}

function computeRiskLevel(score: number): FraudRiskLevel {
  if (score <= 30) return 'LOW';
  if (score <= 70) return 'MEDIUM';
  return 'HIGH';
}

export const fraudDetector = {
  analyze(input: FraudInput): FraudResult {
    const flags: string[] = [];
    let score = 0;

    // ── Rule 1: Same-day multiple claims ──────────────────────────────
    // Uses explicitly provided count (from form) plus historical lookup
    const sameDayCount = input.previousClaimsSameDay ?? 0;
    if (sameDayCount >= SAME_DAY_CLAIM_THRESHOLD) {
      flags.push(`Multiple claims on same day (${sameDayCount} previous claims on ${input.treatmentDate})`);
      score += 35;
    }

    // ── Rule 1b: Historical same-day lookup ───────────────────────────
    const allClaimsForMember = storageService.getClaims().filter(
      c => c.member.memberId === input.memberId && c.treatmentDate === input.treatmentDate
    );
    if (allClaimsForMember.length >= SAME_DAY_CLAIM_THRESHOLD && sameDayCount === 0) {
      flags.push(`Multiple claims on same day (${allClaimsForMember.length} found in records)`);
      score += 25;
    }

    // ── Rule 2: High-frequency claims ────────────────────────────────
    const allClaims = storageService.getClaims();
    const treatmentDate = new Date(input.treatmentDate);
    const windowStart = new Date(treatmentDate);
    windowStart.setDate(windowStart.getDate() - HIGH_FREQUENCY_DAYS);

    const recentClaims = allClaims.filter(c => {
      if (c.member.memberId !== input.memberId) return false;
      const d = new Date(c.treatmentDate);
      return d >= windowStart && d <= treatmentDate;
    });

    if (recentClaims.length >= HIGH_FREQUENCY_COUNT) {
      flags.push(`Excessive claim frequency: ${recentClaims.length} claims in ${HIGH_FREQUENCY_DAYS} days`);
      score += 25;
    }

    // ── Rule 3: High-value claim ──────────────────────────────────────
    if (input.claimAmount > HIGH_VALUE_THRESHOLD) {
      flags.push(`High-value claim: ₹${input.claimAmount.toLocaleString('en-IN')}`);
      score += 15;
    }

    // ── Rule 4: Suspicious amount pattern (just below limit) ──────────
    if (
      input.claimAmount >= SUSPICIOUS_AMOUNT_PATTERN &&
      input.claimAmount < 5000
    ) {
      flags.push('Suspicious amount pattern: claim just below per-claim limit');
      score += 10;
    }

    // ── Rule 5: Repeated provider pattern ────────────────────────────
    const providerClaims = recentClaims.filter(c => {
      const prov = c.provider.providerName.toLowerCase();
      return prov === input.providerName.toLowerCase();
    });
    if (providerClaims.length >= 3) {
      flags.push(`Repeated provider: ${input.providerName} (${providerClaims.length} recent claims)`);
      score += 15;
    }

    // ── Rule 6: Unusual pattern detection (same-day threshold) ───────
    if (sameDayCount >= 3) {
      flags.push('Unusual pattern detected: 3+ claims on same treatment date');
      score = Math.min(score + 20, 100);
    }

    const clampedScore = Math.min(score, 100);
    const riskLevel = computeRiskLevel(clampedScore);

    return {
      score: clampedScore,
      riskLevel,
      flags,
      // Require manual review for HIGH risk or MEDIUM with score >= 50
      requiresManualReview: riskLevel === 'HIGH' || (riskLevel === 'MEDIUM' && clampedScore >= 50),
    };
  },
};
