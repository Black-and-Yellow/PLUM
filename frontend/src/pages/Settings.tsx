import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, Eye, EyeOff, Trash2, Info, AlertTriangle } from 'lucide-react';
import { storageService } from '../services/storageService';
import * as api from '../services/apiService';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [claimsCount, setClaimsCount] = useState(0);
  const [backendHealth, setBackendHealth] = useState<{ status: string; mongodb: string; geminiConfigured: boolean } | null>(null);

  useEffect(() => {
    const existing = storageService.getApiKey();
    if (existing) setApiKey(existing);
    setClaimsCount(storageService.getClaims().length);

    api.checkHealth()
      .then(setBackendHealth)
      .catch(() => setBackendHealth(null));
  }, []);

  const handleSave = () => {
    storageService.saveApiKey(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClearData = () => {
    if (confirm('Clear all claims data? This cannot be undone.')) {
      storageService.clearAll();
      setClaimsCount(0);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in flex flex-col flex-1">
      {/* Header Title Block */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase mb-2">Workspace</div>
          <h1 className="text-[26px] leading-tight font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground max-w-2xl">
            API credentials and local data. Keys are stored in your browser only — never sent to our servers.
          </p>
        </div>
      </div>

      {/* 2-Column Settings Layout */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Left Nav */}
        <nav className="text-[13px] flex flex-col gap-0.5 self-start select-none">
          <a href="#api-keys" className="block px-3 py-1.5 rounded-md bg-muted text-foreground font-medium">
            API keys
          </a>
          <a href="#data-management" className="block px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground">
            Data management
          </a>
          <a href="#system-info" className="block px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground">
            System info
          </a>
          <a href="#notifications" className="block px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground opacity-50 cursor-not-allowed">
            Notifications
          </a>
          <a href="#audit-log" className="block px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground opacity-50 cursor-not-allowed">
            Audit log
          </a>
        </nav>

        {/* Right Content Area */}
        <div className="space-y-4 max-w-2xl">
          {/* Card 1: Google Gemini API key */}
          <div id="api-keys" className="rounded-xl border border-border bg-surface overflow-hidden scroll-mt-20">
            <div className="px-5 py-4 border-b border-border flex items-start gap-3">
              <div className="h-8 w-8 rounded-md border border-border bg-surface-muted grid place-items-center">
                <Key className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight">Google Gemini API key</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Required for document extraction and medical necessity assessment.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="h-9 w-full rounded-md border border-input bg-surface px-3 pr-9 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                  placeholder="AIzaSy…"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {backendHealth ? (
                backendHealth.geminiConfigured ? (
                  <div className="flex items-start gap-2 text-[12px] text-success rounded-md border border-success/20 bg-success/5 px-3 py-2">
                    <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" aria-hidden="true" />
                    <div>
                      <strong>Backend Gemini Key Active:</strong> The FastAPI backend server has a Gemini API key configured in its environment. All extraction and analysis will run securely server-side.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-[12px] text-warning rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                    <div>
                      <strong>Backend Gemini Key Missing:</strong> The backend has no `GEMINI_API_KEY` set. Document extraction will fall back to your local browser API key if supplied below.
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-start gap-2 text-[12px] text-muted-foreground rounded-md border border-border bg-surface-muted/60 px-3 py-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <strong>Local Mode (Backend Offline):</strong> Document extraction will use your local browser API key. Set one up below.
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 text-[12px] text-muted-foreground rounded-md border border-border bg-surface-muted/60 px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  Browser key is stored in your local storage only. Get a free key at{' '}
                  <a
                    className="underline text-foreground"
                    href="https://aistudio.google.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    aistudio.google.com
                  </a>
                  .
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    const existing = storageService.getApiKey();
                    setApiKey(existing || '');
                  }}
                  className="h-9 px-3 rounded-md border border-border text-[13px] font-medium hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 cursor-pointer"
                >
                  {saved ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" /> Saved key
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" /> Save key
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Data management */}
          <div id="data-management" className="rounded-xl border border-border bg-surface overflow-hidden scroll-mt-20">
            <div className="px-5 py-4 border-b border-border flex items-start gap-3">
              <div className="h-8 w-8 rounded-md border border-border bg-surface-muted grid place-items-center">
                <Trash2 className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight">Data management</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">Manage locally stored claims data.</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted/60 px-3 py-2.5 text-[13px]">
                <span>Claims stored locally</span>
                <span className="font-medium tabular">{claimsCount}</span>
              </div>
              <button
                onClick={handleClearData}
                className="mt-3 w-full h-9 rounded-md border border-destructive/30 text-destructive text-[13px] font-medium hover:bg-destructive/5 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear all claims data
              </button>
            </div>
          </div>

          {/* Card 3: System information */}
          <div id="system-info" className="rounded-xl border border-border bg-surface overflow-hidden scroll-mt-20">
            <div className="px-5 py-4 border-b border-border flex items-start gap-3">
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight">System information</h3>
              </div>
            </div>
            <dl className="divide-y divide-border text-[13px]">
              <div className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">Version</dt>
                <dd className="font-medium tabular">v1.0.0</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">Backend Server</dt>
                <dd className={`font-semibold ${backendHealth ? 'text-success' : 'text-warning'}`}>
                  {backendHealth ? 'FastAPI (Online)' : 'Offline (Local-only)'}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">Database</dt>
                <dd className="font-medium">
                  {backendHealth ? `MongoDB (${backendHealth.mongodb})` : 'Browser LocalStorage'}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">Backend Gemini AI</dt>
                <dd className={`font-medium ${backendHealth?.geminiConfigured ? 'text-success' : 'text-muted-foreground'}`}>
                  {backendHealth?.geminiConfigured ? 'Configured' : 'Not Configured'}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">Engine</dt>
                <dd className="font-medium">Rule-based + Gemini AI</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">Test Cases</dt>
                <dd className="font-medium text-success font-semibold tabular-nums">15/15 passing</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
