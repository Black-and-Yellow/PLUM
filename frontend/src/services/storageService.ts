import type { Claim, Appeal, ClaimsStats } from '../types/claim';

const KEYS = {
  CLAIMS: 'opd_claims',
  APPEALS: 'opd_appeals',
  SETTINGS: 'opd_settings',
  API_KEY: 'gemini_api_key',
} as const;

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultMemberId: string;
  defaultMemberJoinDate: string;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  defaultMemberId: '',
  defaultMemberJoinDate: '2024-01-01',
};

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[storageService] Failed to write key "${key}":`, e);
  }
}

export const storageService = {
  // ─── Claims ───────────────────────────────────────────────────────────

  saveClaim(claim: Claim): void {
    const claims = this.getClaims();
    const idx = claims.findIndex(c => c.claimId === claim.claimId);
    if (idx >= 0) {
      claims[idx] = claim;
    } else {
      claims.unshift(claim);
    }
    safeSet(KEYS.CLAIMS, claims);
  },

  getClaim(claimId: string): Claim | null {
    const claims = this.getClaims();
    return claims.find(c => c.claimId === claimId) ?? null;
  },

  getClaims(): Claim[] {
    return safeGet<Claim[]>(KEYS.CLAIMS) ?? [];
  },

  updateClaim(claimId: string, updates: Partial<Claim>): Claim | null {
    const claims = this.getClaims();
    const idx = claims.findIndex(c => c.claimId === claimId);
    if (idx < 0) return null;
    claims[idx] = { ...claims[idx], ...updates, updatedAt: new Date().toISOString() };
    safeSet(KEYS.CLAIMS, claims);
    return claims[idx];
  },

  deleteClaim(claimId: string): void {
    const claims = this.getClaims().filter(c => c.claimId !== claimId);
    safeSet(KEYS.CLAIMS, claims);
  },

  getClaimsStats(): ClaimsStats {
    const claims = this.getClaims();
    const approved = claims.filter(c => c.status === 'APPROVED');
    const rejected = claims.filter(c => c.status === 'REJECTED');
    const partial = claims.filter(c => c.status === 'PARTIAL');
    const manualReview = claims.filter(c => c.status === 'MANUAL_REVIEW');
    const pending = claims.filter(c => ['DRAFT', 'SUBMITTED', 'PROCESSING'].includes(c.status));
    const appealed = claims.filter(c => c.status === 'APPEALED');

    const totalApprovedAmount = [...approved, ...partial].reduce(
      (sum, c) => sum + (c.decision?.approvedAmount ?? 0),
      0
    );

    const decidedClaims = claims.filter(c => c.decision);
    const averageConfidence =
      decidedClaims.length > 0
        ? decidedClaims.reduce((sum, c) => sum + (c.decision?.confidence ?? 0), 0) / decidedClaims.length
        : 0;

    const fraudReviewed = claims.filter(c => c.decision && c.decision.fraudRisk !== 'LOW');
    const fraudReviewRate = claims.length > 0 ? fraudReviewed.length / claims.length : 0;
    const appealRate = claims.length > 0 ? appealed.length / claims.length : 0;

    return {
      total: claims.length,
      approved: approved.length,
      rejected: rejected.length,
      partial: partial.length,
      manualReview: manualReview.length,
      pending: pending.length,
      totalApprovedAmount,
      averageConfidence,
      fraudReviewRate,
      appealRate,
    };
  },

  // ─── Appeals ──────────────────────────────────────────────────────────

  saveAppeal(_appeal: Appeal): void {
    // Appeals are stored embedded in claims via saveClaim
    console.warn('[storageService] Use saveClaim with updated appeals array instead of saveAppeal');
  },

  getAppeals(): Appeal[] {
    return safeGet<Appeal[]>(KEYS.APPEALS) ?? [];
  },

  getAppealsByClaimId(claimId: string): Appeal[] {
    const claim = this.getClaim(claimId);
    return claim?.appeals ?? [];
  },

  // ─── Settings ─────────────────────────────────────────────────────────

  saveSettings(settings: Partial<AppSettings>): void {
    const current = this.getSettings();
    safeSet(KEYS.SETTINGS, { ...current, ...settings });
  },

  getSettings(): AppSettings {
    return safeGet<AppSettings>(KEYS.SETTINGS) ?? defaultSettings;
  },

  // ─── API Key ──────────────────────────────────────────────────────────

  saveApiKey(key: string): void {
    localStorage.setItem(KEYS.API_KEY, key);
  },

  getApiKey(): string | null {
    const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim().length > 0) {
      return envKey;
    }
    return localStorage.getItem(KEYS.API_KEY);
  },

  clearApiKey(): void {
    localStorage.removeItem(KEYS.API_KEY);
  },

  hasApiKey(): boolean {
    const key = this.getApiKey();
    return key !== null && key.trim().length > 0;
  },

  // ─── Utilities ────────────────────────────────────────────────────────

  clearAll(): void {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  },
};
