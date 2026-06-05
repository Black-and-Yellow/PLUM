import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Search, Bell, ChevronDown } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-[244px] min-w-0 flex flex-col min-h-screen">
        {/* Sticky Topbar */}
        <div className="sticky top-0 z-20 h-14 bg-background/80 backdrop-blur border-b border-border flex items-center px-6 gap-4">
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="font-medium text-foreground">TechCorp Solutions</span>
            <span className="text-border-strong">/</span>
            <span>Plum OPD Advantage</span>
            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-success/10 text-success border border-success/20">
              ACTIVE
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <input
                placeholder="Search claims, members…"
                className="h-8 w-[280px] rounded-md border border-border bg-surface pl-8 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-border-strong"
                type="text"
                disabled
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground border border-border rounded px-1 py-0.5 bg-muted">
                ⌘K
              </kbd>
            </div>

            {/* Notification Bell */}
            <button className="h-8 w-8 grid place-items-center rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {/* Profile Pill */}
            <button className="h-8 pl-1 pr-2 flex items-center gap-2 rounded-md border border-border hover:bg-muted transition-colors">
              <div className="h-6 w-6 rounded bg-foreground text-background grid place-items-center text-[11px] font-semibold">
                AK
              </div>
              <span className="text-[12.5px] font-medium text-foreground">Aarav K.</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div className="px-8 py-8 max-w-[1280px] w-full mx-auto flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
