import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Shield, BarChart2, FileText,
  TrendingUp, AlertCircle, MessageSquare, RefreshCw, Download, Eye, Paperclip
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { StatusBadge } from '../components/StatusBadge';
import { DecisionExplanationCard } from '../components/DecisionExplanationCard';
import * as apiService from '../services/apiService';
import type { Claim } from '../types/claim';
import type { RuleEvaluationResult } from '../types/decision';

interface ClaimDocumentMeta {
  document_id: string;
  original_filename: string;
  filename: string;
  filepath: string;
  mime_type: string;
  doc_type: string;
  size_bytes: number;
  upload_date: string;
  claim_reference: string;
  download_url: string;
  extraction_status: string;
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 85 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={100} className="confidence-ring" viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>
          {pct}%
        </text>
      </svg>
      <div className="text-xs mt-1 text-muted-foreground">Confidence</div>
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleEvaluationResult }) {
  const [open, setOpen] = useState(false);

  const icons = {
    PASS: <CheckCircle size={15} style={{ color: '#4ade80' }} />,
    FAIL: <XCircle size={15} style={{ color: '#f87171' }} />,
    WARNING: <AlertTriangle size={15} style={{ color: '#fbbf24' }} />,
    SKIP: <Clock size={15} style={{ color: '#8080a8' }} />,
  };
  const colors = { PASS: '#4ade80', FAIL: '#f87171', WARNING: '#fbbf24', SKIP: '#8080a8' };

  return (
    <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}>
        {icons[rule.result]}
        <span className="flex-1 text-sm" style={{ color: colors[rule.result] }}>
          {rule.ruleName}
        </span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{
          background: `${colors[rule.result]}15`, color: colors[rule.result]
        }}>
          Step {rule.step}
        </span>
        {open ? <ChevronUp size={14} style={{ color: '#565680' }} /> : <ChevronDown size={14} style={{ color: '#565680' }} />}
      </div>
      {open && (
        <div className="px-4 pb-3 ml-6">
          <p className="text-xs" style={{ color: '#8080a8' }}>{rule.reason}</p>
          {rule.rejectionCode && (
            <span className="inline-block mt-1.5 text-xs font-mono px-2 py-0.5 rounded-lg badge-rejected">
              {rule.rejectionCode}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AppealModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-card p-6 max-w-md w-full glow-brand animate-fade-in">
        <h3 className="font-semibold text-white mb-1">File an Appeal</h3>
        <p className="text-sm mb-4" style={{ color: '#8080a8' }}>
          Provide your appeal reasoning. You have 30 days to appeal.
        </p>
        <textarea
          className="input-field h-32 resize-none"
          placeholder="Explain why you believe this decision should be reconsidered..."
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => reason.trim() && onSubmit(reason)}
            className="btn-primary flex-1"
            style={!reason.trim() ? { opacity: 0.5 } : {}}>
            Submit Appeal
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentTypeChip({ docType }: { docType: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    prescription: { label: 'Prescription', color: '#818cf8' },
    bill: { label: 'Bill / Invoice', color: '#34d399' },
    diagnostic_report: { label: 'Diagnostic Report', color: '#f59e0b' },
    other: { label: 'Other', color: '#94a3b8' },
  };
  const { label, color } = labels[docType] ?? labels.other;
  return (
    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}20`, color }}>
      {label}
    </span>
  );
}

export function ClaimDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [documents, setDocuments] = useState<ClaimDocumentMeta[]>([]);
  const [showAppeal, setShowAppeal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isBackend, setIsBackend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewerComments, setReviewerComments] = useState('');

  useEffect(() => {
    async function loadClaim() {
      if (!id) return;
      setLoading(true);
      try {
        const backendClaim = await apiService.getClaim(id);
        setClaim(backendClaim);
        setIsBackend(true);
        if (backendClaim.decision?.notes) {
          setReviewerComments(backendClaim.decision.notes);
        }
        // Load persisted documents
        try {
          const docsRes = await fetch(`/api/claims/${id}/documents`);
          if (docsRes.ok) {
            const docsData = await docsRes.json();
            setDocuments(docsData.documents ?? []);
          }
        } catch {
          // Documents are optional — ignore errors
        }
      } catch (err) {
        console.warn('Backend claim fetch failed, falling back to local storage', err);
        const found = storageService.getClaims().find(c => c.claimId === id);
        setClaim(found ?? null);
        setIsBackend(false);
      } finally {
        setLoading(false);
      }
    }
    loadClaim();
  }, [id]);

  const handleAppeal = async (reason: string) => {
    if (!claim) return;
    setActionLoading(true);
    try {
      if (isBackend) {
        const updated = await apiService.submitAppeal(claim.claimId, reason);
        setClaim(updated);
      } else {
        const updated: Claim = {
          ...claim,
          status: 'APPEALED',
          updatedAt: new Date().toISOString(),
          appeals: [...(claim.appeals ?? []), {
            id: Date.now().toString(),
            reason,
            submittedAt: new Date().toISOString(),
            status: 'PENDING',
          }],
        };
        storageService.saveClaim(updated);
        setClaim(updated);
      }
      setShowAppeal(false);
    } catch (err) {
      console.error('Failed to submit appeal', err);
      alert('Failed to submit appeal: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualDecision = async (newStatus: 'APPROVED' | 'REJECTED') => {
    if (!claim) return;
    setActionLoading(true);
    try {
      if (isBackend) {
        const updated = await apiService.updateClaim(claim.claimId, {
          status: newStatus,
          reviewer_comments: reviewerComments.trim() || `Manually ${newStatus.toLowerCase()} by claims officer.`,
        });
        setClaim(updated);
      } else {
        const updated: Claim = {
          ...claim,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          decision: claim.decision ? {
            ...claim.decision,
            status: newStatus,
            notes: reviewerComments.trim() || `Manually ${newStatus.toLowerCase()} by claims officer.`,
          } : undefined,
        };
        storageService.saveClaim(updated);
        setClaim(updated);
      }
    } catch (err) {
      console.error('Failed to update claim status', err);
      alert('Failed to update claim status: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
        <div className="text-sm text-muted-foreground">Loading claim details...</div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <FileText size={40} style={{ color: '#3d3d60' }} className="mb-3" />
        <div className="text-lg font-medium" style={{ color: '#565680' }}>Claim not found</div>
        <button onClick={() => navigate('/')} className="btn-ghost mt-4 flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const decision = claim.decision;
  const canAppeal = ['REJECTED', 'PARTIAL'].includes(claim.status) && !(claim.appeals?.length);

  return (
    <div className="space-y-6 animate-fade-in max-w-[1280px] w-full">
      {showAppeal && (
        <AppealModal
          onClose={() => setShowAppeal(false)}
          onSubmit={handleAppeal}
        />
      )}

      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-[13px] font-medium hover:bg-muted transition-colors cursor-pointer text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">{claim.member.memberName}</h1>
            <StatusBadge status={claim.status} size="lg" />
          </div>
          <div className="text-[12.5px] text-muted-foreground mt-0.5">
            <span className="font-mono text-xs">{claim.claimId}</span>
            {' · '}Submitted {formatDate(claim.submittedAt)}
          </div>
        </div>
        {canAppeal && (
          <button
            onClick={() => setShowAppeal(true)}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-[13px] font-medium hover:bg-muted transition-colors cursor-pointer text-warning"
          >
            <MessageSquare size={15} /> Appeal Decision
          </button>
        )}
      </div>

      {/* Decision Banner */}
      {decision && (
        <div
          className={`rounded-2xl p-5 border ${
            claim.status === 'APPROVED' ? 'bg-success/10 border-success/20' :
            claim.status === 'REJECTED' ? 'bg-destructive/10 border-destructive/20' :
            claim.status === 'PARTIAL' ? 'bg-warning/10 border-warning/20' :
            'bg-info/10 border-info/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {claim.status === 'APPROVED' && `${formatCurrency(decision.approvedAmount)} Approved`}
                {claim.status === 'PARTIAL' && `${formatCurrency(decision.approvedAmount)} Partially Approved`}
                {claim.status === 'REJECTED' && 'Claim Rejected'}
                {claim.status === 'MANUAL_REVIEW' && 'Flagged for Manual Review'}
                {claim.status === 'APPEALED' && 'Appeal Submitted — Under Review'}
              </div>
              <div className="text-[13px] mt-1 text-muted-foreground">
                Claimed: {formatCurrency(claim.claimedAmount)}
                {decision.copayAmount > 0 && ` · Copay: ${formatCurrency(decision.copayAmount)}`}
                {decision.networkDiscount > 0 && ` · Network Discount: ${formatCurrency(decision.networkDiscount)}`}
              </div>
            </div>
            <ConfidenceRing value={decision.confidence} />
          </div>
        </div>
      )}

      {/* AI Decision Explanation */}
      {decision && (
        <DecisionExplanationCard claimId={claim.claimId} isBackend={isBackend} />
      )}

      {/* Manual Review Actions Panel */}
      {['MANUAL_REVIEW', 'APPEALED'].includes(claim.status) && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <h3 className="font-semibold text-foreground">Claims Officer Review Panel</h3>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground block">Reviewer Notes / Decision Justification</label>
            <textarea
              className="w-full h-24 rounded-md border border-border bg-surface p-3 text-[13px] text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none"
              placeholder="Enter notes explaining the approval, partial approval, or rejection decision..."
              value={reviewerComments}
              onChange={e => setReviewerComments(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => handleManualDecision('REJECTED')}
              disabled={actionLoading}
              className="h-9 px-4 rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-[13px] font-medium hover:bg-destructive/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Reject Claim'}
            </button>
            <button
              onClick={() => handleManualDecision('APPROVED')}
              disabled={actionLoading}
              className="h-9 px-4 rounded-md bg-success text-white text-[13px] font-medium hover:bg-success/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Approve Claim'}
            </button>
          </div>
        </div>
      )}


      {/* Rejection reasons */}
      {decision && decision.rejectionReasons.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-destructive" />
            <h3 className="font-semibold text-foreground">Rejection Reasons</h3>
          </div>
          <ul className="space-y-2">
            {decision.rejectionReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground">
                <span className="text-destructive">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fraud */}
      {decision && decision.fraudFlags.length > 0 && (
        <div className="rounded-xl border border-warning/20 bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-warning" />
            <h3 className="font-semibold text-foreground">Fraud Indicators</h3>
            <StatusBadge status={decision.fraudRisk as 'LOW' | 'MEDIUM' | 'HIGH'} size="sm" />
          </div>
          <ul className="space-y-1">
            {decision.fraudFlags.map((f, i) => (
              <li key={i} className="text-[13px] text-warning">⚠ {f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Financial + Confidence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Financial Breakdown */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Financial Breakdown</h3>
          </div>
          {decision && (
            <div className="space-y-3">
              {[
                ['Claimed Amount', formatCurrency(decision.financialBreakdown.claimedAmount), ''],
                decision.financialBreakdown.sublimitDeductions > 0
                  ? ['Excluded (Cosmetic)', `−${formatCurrency(decision.financialBreakdown.sublimitDeductions)}`, 'text-destructive']
                  : null,
                decision.copayAmount > 0
                  ? ['Co-payment (10%)', `−${formatCurrency(decision.copayAmount)}`, 'text-warning']
                  : null,
                decision.networkDiscount > 0
                  ? ['Network Discount (20%)', `−${formatCurrency(decision.networkDiscount)}`, 'text-success']
                  : null,
                ['Approved Amount', formatCurrency(decision.approvedAmount), 'text-success font-bold text-base'],
              ].filter((x): x is string[] => x !== null).map(([label, value, colorClass], i) => (
                <div key={i} className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${colorClass || 'text-foreground'}`}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confidence Breakdown */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Confidence Breakdown</h3>
          </div>
          {decision && Object.entries(decision.confidenceBreakdown).map(([key, val]) => {
            const pct = Math.round((val as number) * 100);
            const colorClass = pct >= 85 ? 'bg-success' : pct >= 70 ? 'bg-warning' : 'bg-destructive';
            const textColorClass = pct >= 85 ? 'text-success' : pct >= 70 ? 'text-warning' : 'text-destructive';
            return (
              <div key={key} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="capitalize text-muted-foreground">{key}</span>
                  <span className={`font-medium ${textColorClass}`}>{pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Steps */}
      {decision && decision.nextSteps.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Next Steps</h3>
          </div>
          <ul className="space-y-2">
            {decision.nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground">
                <CheckCircle size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rule evaluations (expandable) */}
      {decision && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-muted/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-muted-foreground" />
              <span className="font-semibold text-foreground">
                Adjudication Rules ({decision.ruleEvaluations.length} evaluated)
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showRules ? 'rotate-180' : ''}`} />
          </button>
          {showRules && (
            <div className="border-t border-border">
              {decision.ruleEvaluations.map((rule, i) => (
                <RuleRow key={i} rule={rule} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Uploaded Documents */}
      {documents.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Paperclip size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Uploaded Documents</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted/70 transition-colors"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <FileText size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[13px] text-foreground truncate">
                    {doc.original_filename}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <DocumentTypeChip docType={doc.doc_type} />
                    <span className="text-[11px] text-muted-foreground">
                      {formatFileSize(doc.size_bytes)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(doc.upload_date).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {doc.extraction_status === 'done' && (
                      <span className="text-[11px] text-success">✓ Extracted</span>
                    )}
                    {doc.extraction_status === 'error' && (
                      <span className="text-[11px] text-destructive">⚠ Extract failed</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.mime_type.startsWith('image/') && (
                    <a
                      href={`http://localhost:8000${doc.download_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface hover:bg-muted transition-colors"
                      title="Preview"
                    >
                      <Eye size={14} className="text-muted-foreground" />
                    </a>
                  )}
                  <a
                    href={`http://localhost:8000${doc.download_url}`}
                    download={doc.original_filename}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface hover:bg-muted transition-colors"
                    title="Download"
                  >
                    <Download size={14} className="text-muted-foreground" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold text-foreground mb-4">Claim Timeline</h3>
        <div className="space-y-4 relative pl-1.5">
          {/* vertical line indicator */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border"></div>
          {(claim.timeline ?? []).map((event, i) => (
            <div key={i} className="flex gap-4 relative pl-8">
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center bg-surface border-2 border-muted-foreground/30">
                <div className="h-1.5 w-1.5 rounded-full bg-success"></div>
              </div>
              <div>
                <div className="font-semibold text-[13.5px] text-foreground leading-none">{event.stage}</div>
                <div className="text-[12px] text-muted-foreground mt-1">{event.description}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(event.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
