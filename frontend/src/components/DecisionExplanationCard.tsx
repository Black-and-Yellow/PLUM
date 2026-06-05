/**
 * DecisionExplanationCard — Phase 3: AI Decision Explainability
 *
 * Displays a human-readable, step-by-step explanation of the adjudication
 * decision for a given claim. Fetches from POST /api/explain-decision.
 */

import { useState, useEffect } from 'react';
import {
  Lightbulb, ChevronDown, ChevronUp, CheckCircle,
  XCircle, AlertTriangle, Minus, RefreshCw, DollarSign
} from 'lucide-react';

interface StepCheck {
  icon: string;
  name: string;
  result: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  reason: string;
  code?: string;
}

interface StepExplanation {
  step: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  passes: number;
  fails: number;
  warnings: number;
  checks: StepCheck[];
}

interface DecisionExplanation {
  claim_id: string;
  title: string;
  status: string;
  confidence_percent: number;
  summary: string;
  steps: StepExplanation[];
  key_factors: string[];
  financial_summary: string[];
  recommendation: string;
  fraud_risk: string;
  fraud_flags: string[];
  next_steps: string[];
}

function ResultIcon({ result }: { result: string }) {
  switch (result) {
    case 'PASS':    return <CheckCircle size={13} className="text-success shrink-0" />;
    case 'FAIL':    return <XCircle size={13} className="text-destructive shrink-0" />;
    case 'WARNING': return <AlertTriangle size={13} className="text-warning shrink-0" />;
    default:        return <Minus size={13} className="text-muted-foreground shrink-0" />;
  }
}

function StepBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; classes: string }> = {
    PASS:    { label: 'PASS',    classes: 'bg-success/15 text-success' },
    FAIL:    { label: 'FAIL',    classes: 'bg-destructive/15 text-destructive' },
    WARNING: { label: 'WARN',    classes: 'bg-warning/15 text-warning' },
  };
  const cfg = configs[status] ?? configs.WARNING;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function StepRow({ step }: { step: StepExplanation }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-2">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/50 transition-colors cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-[11px] font-mono text-muted-foreground w-12 shrink-0">
          Step {step.step}
        </span>
        <span className="flex-1 text-[13px] font-medium text-foreground">{step.name}</span>
        <StepBadge status={step.status} />
        <span className="text-[11px] text-muted-foreground">
          {step.passes}✓ {step.fails > 0 ? `${step.fails}✗ ` : ''}{step.warnings > 0 ? `${step.warnings}⚠` : ''}
        </span>
        {open
          ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
          : <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-border bg-surface-muted/30 px-4 py-3 space-y-2.5">
          {step.checks.map((check, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <ResultIcon result={check.result} />
              <div className="flex-1">
                <div className="text-[12.5px] font-medium text-foreground">{check.name}</div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">{check.reason}</div>
                {check.code && (
                  <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                    {check.code}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DecisionExplanationCardProps {
  claimId: string;
  isBackend: boolean;
}

export function DecisionExplanationCard({ claimId, isBackend }: DecisionExplanationCardProps) {
  const [explanation, setExplanation] = useState<DecisionExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!isBackend || !claimId) return;

    async function fetchExplanation() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/explain-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claim_id: claimId }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data: DecisionExplanation = await res.json();
        setExplanation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load explanation');
      } finally {
        setLoading(false);
      }
    }

    fetchExplanation();
  }, [claimId, isBackend]);

  // Don't render if not connected to backend
  if (!isBackend) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground">AI Decision Explanation</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw size={14} className="animate-spin" />
          Generating explanation...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground">AI Decision Explanation</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          Could not load explanation: {error}
        </div>
      </div>
    );
  }

  if (!explanation) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-surface overflow-hidden"
      style={{ boxShadow: '0 0 0 1px rgba(129,140,248,0.1), 0 4px 16px rgba(129,140,248,0.06)' }}>

      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-surface-muted/40 transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Lightbulb size={16} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-foreground text-[14px]">AI Decision Explanation</div>
          <div className="text-[12px] text-muted-foreground">{explanation.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
            {explanation.confidence_percent}% confidence
          </span>
          {expanded
            ? <ChevronUp size={16} className="text-muted-foreground" />
            : <ChevronDown size={16} className="text-muted-foreground" />
          }
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 p-5 space-y-5">

          {/* Summary */}
          <div>
            <p className="text-[13px] text-foreground/85 leading-relaxed">{explanation.summary}</p>
          </div>

          {/* Key Factors */}
          {explanation.key_factors.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Key Decision Factors
              </div>
              <ul className="space-y-1.5">
                {explanation.key_factors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/80">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step-by-Step Breakdown */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              6-Step Adjudication Breakdown
            </div>
            {explanation.steps.map((step) => (
              <StepRow key={step.step} step={step} />
            ))}
          </div>

          {/* Financial Summary */}
          {explanation.financial_summary.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <DollarSign size={12} />
                Financial Summary
              </div>
              <div className="rounded-lg border border-border bg-surface-muted/30 p-3 space-y-1.5">
                {explanation.financial_summary.map((line, i) => {
                  const isApproved = line.toLowerCase().startsWith('approved');
                  const isCost = line.includes('−');
                  return (
                    <div
                      key={i}
                      className={`flex justify-between text-[12.5px] ${
                        isApproved ? 'font-semibold text-success pt-1.5 border-t border-border' :
                        isCost ? 'text-warning' : 'text-foreground'
                      }`}
                    >
                      <span>{line.split(':')[0]}</span>
                      <span>{line.includes(':') ? line.split(':').slice(1).join(':').trim() : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {explanation.recommendation && (
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                Recommendation
              </div>
              <p className="text-[12.5px] text-foreground/80">{explanation.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
