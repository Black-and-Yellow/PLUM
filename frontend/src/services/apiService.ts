/**
 * API service for communicating with the FastAPI backend.
 * Falls back to localStorage (storageService) when backend is unavailable.
 */

import type { Claim, ClaimsStats } from '../types/claim';
import type { ExtractionResult } from '../types/extraction';
import type { AdjudicationDecision, MedicalNecessityResult } from '../types/decision';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Internal fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Conversion helpers (snake_case ↔ camelCase) ──────────────────────────────

function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

function camelToSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
      acc[snakeKey] = camelToSnake(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// ── Health Check ─────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
  mongodb: string;
  geminiConfigured: boolean;
}

export async function checkHealth(): Promise<HealthStatus> {
  const data = await apiFetch<any>('/health');
  return snakeToCamel(data) as HealthStatus;
}

export async function isBackendAvailable(): Promise<boolean> {
  try {
    await checkHealth();
    return true;
  } catch {
    return false;
  }
}

// ── Claims ───────────────────────────────────────────────────────────────────

export async function createClaim(data: Record<string, any>): Promise<Claim> {
  const res = await apiFetch<any>('/claims', {
    method: 'POST',
    body: JSON.stringify(camelToSnake(data)),
  });
  return snakeToCamel(res.claim) as Claim;
}

export async function getClaims(params?: {
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<{ claims: Claim[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.skip) searchParams.set('skip', String(params.skip));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  const res = await apiFetch<any>(`/claims${qs ? `?${qs}` : ''}`);
  return {
    claims: (res.claims || []).map((c: any) => snakeToCamel(c) as Claim),
    total: res.total || 0,
  };
}

export async function getClaim(claimId: string): Promise<Claim> {
  const res = await apiFetch<any>(`/claims/${claimId}`);
  return snakeToCamel(res.claim) as Claim;
}

export async function updateClaim(claimId: string, updates: Record<string, any>): Promise<Claim> {
  const res = await apiFetch<any>(`/claims/${claimId}`, {
    method: 'PATCH',
    body: JSON.stringify(camelToSnake(updates)),
  });
  return snakeToCamel(res.claim) as Claim;
}

export async function submitAppeal(claimId: string, reason: string): Promise<Claim> {
  const res = await apiFetch<any>(`/claims/${claimId}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return snakeToCamel(res.claim) as Claim;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<ClaimsStats> {
  const res = await apiFetch<any>('/stats');
  return snakeToCamel(res.stats) as ClaimsStats;
}

// ── Extraction ───────────────────────────────────────────────────────────────

export async function extractDocument(file: File, docType: string): Promise<ExtractionResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);

  const url = `${API_BASE}/extract`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Extraction failed' }));
    throw new Error(err.detail || 'Extraction failed');
  }
  const data = await res.json();
  return snakeToCamel(data.extraction) as ExtractionResult;
}

export async function assessMedicalNecessity(
  diagnosis: string,
  medicines: string[],
  procedures: string[],
): Promise<MedicalNecessityResult> {
  const res = await apiFetch<any>('/medical-necessity', {
    method: 'POST',
    body: JSON.stringify({ diagnosis, medicines, procedures }),
  });
  return snakeToCamel(res.result) as MedicalNecessityResult;
}

// ── Adjudication ─────────────────────────────────────────────────────────────

export async function adjudicate(input: Record<string, any>): Promise<AdjudicationDecision> {
  const res = await apiFetch<any>('/adjudicate', {
    method: 'POST',
    body: JSON.stringify(camelToSnake(input)),
  });
  return snakeToCamel(res.decision) as AdjudicationDecision;
}

// ── Policy ───────────────────────────────────────────────────────────────────

export async function getPolicy(): Promise<any> {
  return apiFetch<any>('/policies');
}

export async function updatePolicy(policy: any): Promise<any> {
  return apiFetch<any>('/policies', {
    method: 'PUT',
    body: JSON.stringify(camelToSnake(policy)),
  });
}
