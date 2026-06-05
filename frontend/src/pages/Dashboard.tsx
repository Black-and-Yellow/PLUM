import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CheckCircle, XCircle, Clock, TrendingUp,
  Search, RefreshCw, BarChart2, ShieldAlert, ShieldCheck, Plus, ArrowUpRight
} from 'lucide-react';
import { storageService } from '../services/storageService';
import * as api from '../services/apiService';
import { StatusBadge } from '../components/StatusBadge';
import type { Claim, ClaimsStats } from '../types/claim';

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) {
    return `${diffMins || 1}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}

type FilterStatus = 'ALL' | 'APPROVED' | 'REJECTED' | 'PARTIAL' | 'MANUAL_REVIEW';

export function Dashboard() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ClaimsStats | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      // Try backend first
      const [claimsRes, statsRes] = await Promise.all([
        api.getClaims({ limit: 50 }),
        api.getStats(),
      ]);
      setClaims(claimsRes.claims);
      setStats(statsRes);
    } catch {
      // Fallback to localStorage
      const allClaims = storageService.getClaims();
      const allStats = storageService.getClaimsStats();
      setClaims(allClaims);
      setStats(allStats);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = claims.filter(c => {
    const matchSearch =
      search === '' ||
      c.member.memberName.toLowerCase().includes(search.toLowerCase()) ||
      c.claimId.toLowerCase().includes(search.toLowerCase()) ||
      c.member.memberId.toLowerCase().includes(search.toLowerCase()) ||
      c.provider.providerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const recentClaims = filtered.slice(0, 5);

  // Dynamic activity feed based on actual claims
  const activities = claims.slice(0, 5).map(c => {
    let msg = '';
    let dotColor = 'bg-muted-foreground';
    if (c.status === 'APPROVED') {
      msg = `Auto-adjudication approved ${c.claimId}`;
      dotColor = 'bg-success';
    } else if (c.status === 'REJECTED') {
      msg = `Claim ${c.claimId} was rejected`;
      dotColor = 'bg-destructive';
    } else if (c.status === 'PARTIAL') {
      msg = `Claim ${c.claimId} approved with adjustments`;
      dotColor = 'bg-warning';
    } else {
      msg = `Risk engine flagged ${c.claimId} for manual review`;
      dotColor = 'bg-warning';
    }
    return {
      id: c.claimId,
      msg,
      dotColor,
      time: formatDate(c.submittedAt),
    };
  });

  // Helper to compute trends dynamically
  const getDynamicTrends = () => {
    if (claims.length === 0) {
      return {
        total: '+0.0%',
        approved: '+0.0%',
        rejected: '0.0%',
        pending: '+0 today',
        amount: '+₹0 MoM',
        totalColor: 'text-muted-foreground',
        approvedColor: 'text-muted-foreground',
        rejectedColor: 'text-muted-foreground',
        pendingColor: 'text-muted-foreground',
        amountColor: 'text-muted-foreground'
      };
    }

    const now = new Date().getTime();
    const oneDay = 24 * 3600 * 1000;
    
    const todayClaims = claims.filter(c => now - new Date(c.submittedAt).getTime() < oneDay);
    const priorClaims = claims.filter(c => now - new Date(c.submittedAt).getTime() >= oneDay);
    
    // Total claims trend
    let totalTrendVal = 0;
    if (priorClaims.length > 0) {
      totalTrendVal = (todayClaims.length / priorClaims.length) * 100;
    } else {
      totalTrendVal = todayClaims.length > 0 ? 100.0 : 0.0;
    }
    const totalTrend = `${totalTrendVal >= 0 ? '+' : ''}${totalTrendVal.toFixed(1)}%`;
    const totalColor = totalTrendVal > 0 ? 'text-success' : 'text-muted-foreground';

    // Approved trend
    const todayApproved = todayClaims.filter(c => c.status === 'APPROVED' || c.status === 'PARTIAL').length;
    const priorApproved = priorClaims.filter(c => c.status === 'APPROVED' || c.status === 'PARTIAL').length;
    let approvedTrendVal = 0;
    if (priorApproved > 0) {
      approvedTrendVal = (todayApproved / priorApproved) * 100;
    } else {
      approvedTrendVal = todayApproved > 0 ? 100.0 : 0.0;
    }
    const approvedTrend = `${approvedTrendVal >= 0 ? '+' : ''}${approvedTrendVal.toFixed(1)}%`;
    const approvedColor = approvedTrendVal > 0 ? 'text-success' : 'text-muted-foreground';

    // Rejected trend
    const todayRejected = todayClaims.filter(c => c.status === 'REJECTED').length;
    const priorRejected = priorClaims.filter(c => c.status === 'REJECTED').length;
    let rejectedTrendVal = 0;
    if (priorRejected > 0) {
      rejectedTrendVal = (todayRejected / priorRejected) * 100;
    } else {
      rejectedTrendVal = todayRejected > 0 ? 100.0 : 0.0;
    }
    const rejectedTrend = `${rejectedTrendVal >= 0 ? '+' : ''}${rejectedTrendVal.toFixed(1)}%`;
    const rejectedColor = rejectedTrendVal > 0 ? 'text-destructive' : rejectedTrendVal < 0 ? 'text-success' : 'text-muted-foreground';

    // Pending today
    const pendingToday = todayClaims.filter(c => ['MANUAL_REVIEW', 'SUBMITTED', 'PROCESSING'].includes(c.status)).length;
    const pendingTrend = `+${pendingToday} today`;
    const pendingColor = pendingToday > 0 ? 'text-warning' : 'text-muted-foreground';

    // Approved Amount trend
    const todayAmount = todayClaims.filter(c => c.status === 'APPROVED' || c.status === 'PARTIAL')
      .reduce((sum, c) => sum + (c.decision?.approvedAmount ?? 0), 0);
    const priorAmount = priorClaims.filter(c => c.status === 'APPROVED' || c.status === 'PARTIAL')
      .reduce((sum, c) => sum + (c.decision?.approvedAmount ?? 0), 0);
    
    let amountTrend = '';
    let amountTrendVal = 0;
    if (priorAmount > 0) {
      amountTrendVal = (todayAmount / priorAmount) * 100;
      amountTrend = `+${amountTrendVal.toFixed(1)}% MoM`;
    } else if (todayAmount > 0) {
      if (todayAmount >= 100000) {
        amountTrend = `+₹${(todayAmount / 100000).toFixed(1)}L MoM`;
      } else {
        amountTrend = `+₹${(todayAmount / 1000).toFixed(1)}K MoM`;
      }
      amountTrendVal = 100.0;
    } else {
      amountTrend = '+₹0 MoM';
      amountTrendVal = 0;
    }
    const amountColor = amountTrendVal > 0 ? 'text-success' : 'text-muted-foreground';

    return {
      total: totalTrend,
      approved: approvedTrend,
      rejected: rejectedTrend,
      pending: pendingTrend,
      amount: amountTrend,
      totalColor,
      approvedColor,
      rejectedColor,
      pendingColor,
      amountColor
    };
  };

  const trends = getDynamicTrends();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface border border-border rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in flex flex-col flex-1">
      {/* Header Block */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase mb-2">Overview</div>
          <h1 className="text-[26px] leading-tight font-semibold text-foreground tracking-tight">Claims Dashboard</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground max-w-2xl">
            A live view of OPD claim throughput, model confidence, and risk signals across your policy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-[13px] font-medium hover:bg-muted transition-colors cursor-pointer text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
          </button>
          <button
            onClick={() => navigate('/submit')}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New claim
          </button>
        </div>
      </div>

      {/* 5-KPI Grid Separated by Thin Lines */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {/* KPI 1: Total Claims */}
        <div className="bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className={`text-[11px] font-medium tabular ${trends.totalColor}`}>{trends.total}</span>
          </div>
          <div>
            <div className="text-[22px] font-display font-semibold text-foreground tabular tracking-tight">
              {stats?.total ?? 0}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Total Claims</div>
          </div>
        </div>

        {/* KPI 2: Approved */}
        <div className="bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CheckCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className={`text-[11px] font-medium tabular ${trends.approvedColor}`}>{trends.approved}</span>
          </div>
          <div>
            <div className="text-[22px] font-display font-semibold text-foreground tabular tracking-tight">
              {stats?.approved ?? 0}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Approved</div>
          </div>
        </div>

        {/* KPI 3: Rejected */}
        <div className="bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className={`text-[11px] font-medium tabular ${trends.rejectedColor}`}>{trends.rejected}</span>
          </div>
          <div>
            <div className="text-[22px] font-display font-semibold text-foreground tabular tracking-tight">
              {stats?.rejected ?? 0}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Rejected</div>
          </div>
        </div>

        {/* KPI 4: Pending Review */}
        <div className="bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className={`text-[11px] font-medium tabular ${trends.pendingColor}`}>{trends.pending}</span>
          </div>
          <div>
            <div className="text-[22px] font-display font-semibold text-foreground tabular tracking-tight">
              {(stats?.manualReview ?? 0) + (stats?.pending ?? 0)}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Pending Review</div>
          </div>
        </div>

        {/* KPI 5: Approved Amount */}
        <div className="bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className={`text-[11px] font-medium tabular ${trends.amountColor}`}>{trends.amount}</span>
          </div>
          <div>
            <div className="text-[22px] font-display font-semibold text-foreground tabular tracking-tight">
              {formatCurrency(stats?.totalApprovedAmount ?? 0)}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Approved Amount</div>
          </div>
        </div>
      </div>

      {/* 3 Secondary Progress Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Metric 1: Avg Confidence */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground font-medium">
              <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" /> Avg. Confidence
            </div>
            <div className="text-[15px] font-display font-semibold tabular">
              {stats ? `${(stats.averageConfidence * 100).toFixed(1)}%` : '94.2%'}
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-500"
              style={{ width: stats ? `${(stats.averageConfidence * 100)}%` : '94%' }}
            />
          </div>
        </div>

        {/* Metric 2: Fraud Review Rate */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground font-medium">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Fraud Review Rate
            </div>
            <div className="text-[15px] font-display font-semibold tabular">
              {stats ? `${(stats.fraudReviewRate * 100).toFixed(1)}%` : '2.7%'}
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-500"
              style={{ width: stats ? `${(stats.fraudReviewRate * 100)}%` : '27%' }}
            />
          </div>
        </div>

        {/* Metric 3: Appeal Rate */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground font-medium">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Appeal Rate
            </div>
            <div className="text-[15px] font-display font-semibold tabular">
              {stats ? `${(stats.appealRate * 100).toFixed(1)}%` : '1.1%'}
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-500"
              style={{ width: stats ? `${(stats.appealRate * 100)}%` : '11%' }}
            />
          </div>
        </div>
      </div>

      {/* Claims Table + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* All Claims Table (2/3 width) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight">All claims</h2>
              <p className="text-[11.5px] text-muted-foreground">Showing latest {recentClaims.length} of {claims.length}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-7 w-44 pl-7 pr-2 text-[12px] rounded-md border border-border bg-background focus:outline-none focus:border-border-strong text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                className="h-7 text-[12px] rounded-md border border-border bg-background px-2 focus:outline-none text-foreground"
              >
                <option value="ALL">All status</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PARTIAL">Partial</option>
                <option value="MANUAL_REVIEW">Pending</option>
              </select>
            </div>
          </div>

          {recentClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText size={40} className="mb-3 text-muted-foreground/30" />
              <div className="font-medium text-muted-foreground">No claims found</div>
              <div className="text-sm mt-1 text-muted-foreground/60">
                {claims.length === 0 ? 'Submit your first claim to get started.' : 'Try adjusting your filters.'}
              </div>
              {claims.length === 0 && (
                <button onClick={() => navigate('/submit')} className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12px] font-medium hover:bg-foreground/90 transition-colors mt-3 cursor-pointer">
                  New claim
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase bg-surface-muted border-b border-border">
                  <th className="px-4 py-2.5 font-semibold">Claim</th>
                  <th className="px-4 py-2.5 font-semibold">Member</th>
                  <th className="px-4 py-2.5 font-semibold">Provider</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Conf.</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentClaims.map(claim => {
                  const conf = claim.decision ? Math.round(claim.decision.confidence * 100) : 90;
                  return (
                    <tr
                      key={claim.claimId}
                      onClick={() => navigate(`/claim/${claim.claimId}`)}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/60 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-[12px] text-foreground font-semibold">{claim.claimId.slice(0, 10)}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(claim.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{claim.member.memberName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{claim.provider.providerName}</td>
                      <td className="px-4 py-3 text-right font-medium tabular text-foreground">{formatCurrency(claim.claimedAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-foreground" style={{ width: `${conf}%` }}></div>
                          </div>
                          <span className="text-[11.5px] text-muted-foreground tabular">{conf}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={claim.status} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Activity List (1/3 width) */}
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-[14px] font-semibold tracking-tight">Recent activity</h2>
            <div className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 cursor-pointer">
              View all <ArrowUpRight className="h-3 w-3" />
            </div>
          </div>
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <RefreshCw size={28} className="mb-2 text-muted-foreground/30 animate-spin-slow" />
              <div className="text-sm text-muted-foreground">No recent activity</div>
            </div>
          ) : (
            <ul className="p-2 space-y-0.5">
              {activities.map((act, index) => (
                <li
                  key={index}
                  onClick={() => navigate(`/claim/${act.id}`)}
                  className="flex gap-3 px-2 py-2.5 rounded-md hover:bg-surface-muted cursor-pointer transition-colors"
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${act.dotColor}`}></span>
                  <div className="text-[12.5px] leading-snug">
                    <span className="text-foreground">{act.msg}</span>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{act.time}</div>
                  </div>
                </li>
              ))}
              {/* Default mock system items to enrich list just like Plum portal */}
              <li className="flex gap-3 px-2 py-2.5 rounded-md hover:bg-surface-muted transition-colors">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"></span>
                <div className="text-[12.5px] leading-snug">
                  <span className="font-medium text-foreground">Policy v1.2</span> <span className="text-muted-foreground">published by admin</span>
                  <div className="text-[11px] text-muted-foreground mt-0.5">3h ago</div>
                </div>
              </li>
              <li className="flex gap-3 px-2 py-2.5 rounded-md hover:bg-surface-muted transition-colors">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"></span>
                <div className="text-[12.5px] leading-snug">
                  <span className="font-medium text-foreground">Settlement</span> <span className="text-muted-foreground">batch run completed</span>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Yesterday</div>
                </div>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
