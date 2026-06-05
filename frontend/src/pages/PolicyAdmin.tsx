import { useState, useEffect } from 'react';
import {
  Shield, DollarSign, Clock, List, AlertTriangle, ChevronDown, Check, X
} from 'lucide-react';
import { policyService } from '../services/policyService';
import * as api from '../services/apiService';
import type { PolicyTerms } from '../types/policy';

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-muted/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-[13px] border-b border-border last:border-0">
      <span className="text-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function Tag({ text, color = 'success' }: { text: string; color?: 'success' | 'destructive' | 'warning' | 'info' }) {
  const colorMap = {
    success: 'bg-success/10 text-success border-success/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    info: 'bg-info/10 text-info border-info/20',
  };

  return (
    <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${colorMap[color]}`}>
      {text}
    </span>
  );
}

export function PolicyAdmin() {
  const [policy, setPolicy] = useState<PolicyTerms | null>(null);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const data = await api.getPolicy();
        setPolicy(data as PolicyTerms);
      } catch (err) {
        console.warn('Backend policy fetch failed, falling back to local service', err);
        setPolicy(policyService.getPolicy() as PolicyTerms);
      }
    }
    loadPolicy();
  }, []);

  if (!policy) return null;

  const cd = policy.coverage_details;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1280px] w-full">
      {/* Header Title Block */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase mb-2">Policy</div>
          <h1 className="text-[26px] leading-tight font-semibold text-foreground tracking-tight">Policy administration</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground max-w-2xl">
            Read-only view of the currently active OPD policy. Edits are scheduled through your account manager.
          </p>
        </div>
      </div>

      {/* Policy Info Card */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-6 py-5 flex flex-wrap items-start justify-between gap-4 border-b border-border">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Active policy</div>
            <h2 className="mt-1.5 text-[20px] font-display font-semibold tracking-tight">{policy.policy_name}</h2>
            <div className="text-[12.5px] text-muted-foreground mt-1">
              <span className="font-mono">{policy.policy_id}</span> · {policy.policy_holder.company}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Effective from</div>
            <div className="text-[15px] font-semibold tabular mt-1">{policy.effective_date}</div>
            <span className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold border bg-success/10 text-success border-success/20">
              <span className="h-1 w-1 rounded-full bg-success"></span> ACTIVE
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-6 py-4">
            <div className="text-[20px] font-display font-semibold tabular-nums">{policy.policy_holder.employees_covered}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Employees</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-[20px] font-display font-semibold tabular-nums">{policy.network_hospitals.length}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Network hospitals</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-[20px] font-display font-semibold tabular-nums">
              {policy.policy_holder.dependents_covered ? 'Yes' : 'No'}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Dependents covered</div>
          </div>
        </div>
      </div>

      {/* Coverage Limits Card */}
      <Section title="Coverage limits" icon={DollarSign}>
        <div className="divide-y divide-border">
          <InfoRow label="Annual limit" value={`₹${cd.annual_limit.toLocaleString('en-IN')}`} />
          <InfoRow label="Per-claim limit" value={`₹${cd.per_claim_limit.toLocaleString('en-IN')}`} />
          <InfoRow label="Family floater limit" value={`₹${cd.family_floater_limit.toLocaleString('en-IN')}`} />
          <InfoRow label="Minimum claim amount" value={`₹${policy.claim_requirements.minimum_claim_amount.toLocaleString('en-IN')}`} />
          <InfoRow label="Submission deadline" value={`${policy.claim_requirements.submission_timeline_days} days from treatment`} />
        </div>

        <div className="px-5 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sub-limits by category
        </div>
        <div className="px-5 pb-5 pt-2">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[13px] border-collapse">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Category</th>
                  <th className="text-right px-4 py-2 font-semibold">Sub-limit</th>
                  <th className="text-right px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['Consultation fees', cd.consultation_fees],
                  ['Diagnostic tests', cd.diagnostic_tests],
                  ['Pharmacy', cd.pharmacy],
                  ['Dental (preventive)', cd.dental],
                  ['Vision care', cd.vision],
                  ['Alternative medicine', cd.alternative_medicine],
                ].map(([label, config]) => {
                  const cfg = config as { covered: boolean; sub_limit: number };
                  return (
                    <tr key={label as string}>
                      <td className="px-4 py-2.5 text-foreground font-medium">{label as string}</td>
                      <td className="px-4 py-2.5 text-right tabular text-muted-foreground font-medium">
                        ₹{cfg.sub_limit.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {cfg.covered ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border bg-success/10 text-success border-success/20">
                            <Check className="h-3 w-3" /> Covered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border bg-muted text-muted-foreground border-border">
                            <X className="h-3 w-3" /> Excluded
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* cosmetic procedures explicitly excluded matching the design file */}
                <tr>
                  <td className="px-4 py-2.5 text-foreground font-medium">Cosmetic procedures</td>
                  <td className="px-4 py-2.5 text-right tabular text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border bg-muted text-muted-foreground border-border">
                      <X className="h-3 w-3" /> Excluded
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Copay & Network Card */}
      <Section title="Copay & Network Benefits" icon={Shield} defaultOpen={false}>
        <div className="divide-y divide-border">
          <InfoRow label="Co-payment (Non-network)" value={`${cd.consultation_fees.copay_percentage}%`} />
          <InfoRow label="Network Discount" value={`${cd.consultation_fees.network_discount}%`} />
          <InfoRow label="Cashless Facility" value={policy.cashless_facilities.available ? 'Available' : 'Not Available'} />
          <InfoRow label="Instant Approval Limit" value={`₹${policy.cashless_facilities.instant_approval_limit.toLocaleString('en-IN')}`} />
        </div>
        <div className="px-5 py-4 border-t border-border">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-muted-foreground">
            Network Hospitals
          </div>
          <div className="flex flex-wrap gap-2">
            {policy.network_hospitals.map(h => <Tag key={h} text={h} color="success" />)}
          </div>
        </div>
      </Section>

      {/* Waiting Periods Card */}
      <Section title="Waiting Periods" icon={Clock} defaultOpen={false}>
        <div className="divide-y divide-border">
          <InfoRow label="Initial Waiting Period" value={`${policy.waiting_periods.initial_waiting} days`} />
          <InfoRow label="Pre-existing Diseases" value={`${policy.waiting_periods.pre_existing_diseases} days`} />
          <InfoRow label="Maternity" value={`${policy.waiting_periods.maternity} days`} />
        </div>
        <div className="px-5 py-4 border-t border-border">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-muted-foreground">
            Specific Ailments
          </div>
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-surface-muted/30">
            {Object.entries(policy.waiting_periods.specific_ailments).map(([ailment, days]) => (
              <div key={ailment} className="flex items-center justify-between px-4 py-2.5 text-xs text-foreground">
                <span>{ailment.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span className="font-semibold">{days} days</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Dental Coverage Card */}
      <Section title="Dental Coverage Details" icon={Shield} defaultOpen={false}>
        <div className="divide-y divide-border">
          <InfoRow label="Sub-limit" value={`₹${cd.dental.sub_limit.toLocaleString('en-IN')}`} />
          <InfoRow label="Routine Checkup Limit" value={`₹${(cd.dental.routine_checkup_limit ?? 0).toLocaleString('en-IN')}`} />
        </div>
        <div className="px-5 py-4 border-t border-border space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Procedures Covered</div>
            <div className="flex flex-wrap gap-2">
              {(cd.dental.procedures_covered ?? []).map(p => <Tag key={p} text={p} color="info" />)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Not Covered / Excluded</div>
            <div className="flex flex-wrap gap-2">
              <Tag text="Teeth Whitening" color="destructive" />
              <Tag text="Cosmetic Veneers" color="destructive" />
              <Tag text="Aesthetic Dentistry" color="destructive" />
            </div>
          </div>
        </div>
      </Section>

      {/* Exclusions Card */}
      <Section title="Policy Exclusions" icon={List} defaultOpen={false}>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {policy.exclusions.map((exc: string) => (
            <Tag key={exc} text={exc} color="destructive" />
          ))}
        </div>
      </Section>

      {/* Required Documents Card */}
      <Section title="Required Documents" icon={AlertTriangle} defaultOpen={false}>
        <div className="px-5 py-4">
          <ul className="space-y-2">
            {policy.claim_requirements.documents_required.map((doc: string) => (
              <li key={doc} className="flex items-start gap-2.5 text-[13px] text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0"></span>
                <span>{doc}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
