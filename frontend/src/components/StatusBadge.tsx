import type { DecisionStatus } from '../types/decision';
import type { ClaimStatus } from '../types/claim';

type BadgeStatus = DecisionStatus | ClaimStatus | 'LOW' | 'MEDIUM' | 'HIGH';

const CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  APPROVED: { label: 'Approved', bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', dot: 'bg-success' },
  REJECTED: { label: 'Rejected', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', dot: 'bg-destructive' },
  PARTIAL: { label: 'Partial', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', dot: 'bg-warning' },
  MANUAL_REVIEW: { label: 'Pending Review', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', dot: 'bg-warning' },
  SUBMITTED: { label: 'Submitted', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' },
  PROCESSING: { label: 'Processing', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' },
  DRAFT: { label: 'Draft', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' },
  APPEALED: { label: 'Appealed', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', dot: 'bg-warning' },
  LOW: { label: 'Low Risk', bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', dot: 'bg-success' },
  MEDIUM: { label: 'Medium Risk', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', dot: 'bg-warning' },
  HIGH: { label: 'High Risk', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', dot: 'bg-destructive' },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = CONFIG[status] ?? {
    label: status,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    dot: 'bg-muted-foreground'
  };

  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : size === 'lg' ? 'text-[12px] px-2.5 py-1' : 'text-[11px] px-1.5 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded font-medium border ${sizeClass} ${config.bg} ${config.text} ${config.border}`}>
      <span className={`h-1 w-1 rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
}
