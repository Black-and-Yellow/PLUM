import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, FileText, ShieldCheck, Settings, Activity, ArrowUpRight
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutGrid, label: 'Dashboard' },
  { to: '/submit', icon: FileText, label: 'Submit Claim' },
  { to: '/admin', icon: ShieldCheck, label: 'Policy Admin' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[244px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar h-screen fixed left-0 top-0 z-40 select-none">
      {/* Logo */}
      <div className="px-5 pt-5 pb-6">
        <NavLink className="flex items-center gap-2.5 group" to="/">
          <div className="h-8 w-8 rounded-md bg-foreground text-background grid place-items-center font-display font-bold text-sm">
            P
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-[15px] tracking-tight text-foreground">
              Plum Claims
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">
              OPD Adjudication
            </div>
          </div>
        </NavLink>
      </div>

      {/* Navigation */}
      <div className="px-3">
        <div className="px-2 pb-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Workspace
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* System active status indicator */}
      <div className="mt-auto p-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-medium text-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-success/60 animate-ping"></span>
                <span className="relative h-1.5 w-1.5 rounded-full bg-success"></span>
              </span>
              System active
            </div>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            All adjudication engines healthy. p95 latency 312ms.
          </div>
          <a
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:underline"
            href="https://status.plumhq.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Status page <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}
