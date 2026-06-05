import type { AdjudicationDecision } from './decision';
import type { DocumentUpload } from './extraction';

export type ClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PARTIAL'
  | 'MANUAL_REVIEW'
  | 'APPEALED';

export type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED';

export interface MemberInfo {
  memberId: string;
  memberName: string;
  memberJoinDate: string;
  relationship: 'employee' | 'spouse' | 'child' | 'parent';
}

export interface ClaimProvider {
  providerName: string;
  isNetworkProvider: boolean;
  cashlessRequest: boolean;
}

export interface Appeal {
  id: string;
  reason: string;
  submittedAt: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED';
  reviewerComments?: string;
  resolvedAt?: string;
}

export interface ClaimTimelineEvent {
  stage: string;
  status: 'completed' | 'active' | 'pending' | 'error';
  timestamp: string;
  description: string;
}

export interface Claim {
  claimId: string;
  status: ClaimStatus;
  submittedAt: string;
  updatedAt: string;
  member: MemberInfo;
  provider: ClaimProvider;
  treatmentDate: string;
  claimedAmount: number;
  previousClaimsSameDay?: number;
  documents: DocumentUpload[];
  decision?: AdjudicationDecision;
  appeals: Appeal[];
  timeline: ClaimTimelineEvent[];
}

export interface ClaimsStats {
  total: number;
  approved: number;
  rejected: number;
  partial: number;
  manualReview: number;
  pending: number;
  totalApprovedAmount: number;
  averageConfidence: number;
  fraudReviewRate: number;
  appealRate: number;
}
