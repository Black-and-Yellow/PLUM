import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Calendar, Upload, Eye, ChevronRight,
  ChevronLeft, CheckCircle, Loader, AlertCircle, Sparkles,
  ClipboardList
} from 'lucide-react';
import { adjudicateClaim, type AdjudicationInput } from '../services/adjudicationEngine';
import { documentExtractor } from '../services/documentExtractor';
import { storageService } from '../services/storageService';
import * as api from '../services/apiService';
import type { Claim, ClaimTimelineEvent } from '../types/claim';
import type { DocumentUpload, ExtractionResult } from '../types/extraction';

function generateClaimId(): string {
  return 'CLM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

type Step = 1 | 2 | 3;

interface FormData {
  memberId: string;
  memberName: string;
  memberJoinDate: string;
  relationship: 'employee' | 'spouse' | 'child' | 'parent';
  treatmentDate: string;
  providerName: string;
  cashlessRequest: boolean;
  claimedAmount: string;
  previousClaimsSameDay: string;
}

const INITIAL_FORM: FormData = {
  memberId: '',
  memberName: '',
  memberJoinDate: '2024-01-01',
  relationship: 'employee',
  treatmentDate: '',
  providerName: '',
  cashlessRequest: false,
  claimedAmount: '',
  previousClaimsSameDay: '0',
};

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { num: 1, label: 'Member & Treatment' },
    { num: 2, label: 'Upload Documents' },
    { num: 3, label: 'Review & Submit' }
  ];

  return (
    <div className="flex items-center justify-between w-full text-[13px] font-medium py-1">
      {steps.map((s, idx) => (
        <div key={s.num} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12.5px] font-bold transition-all ${
                s.num === current
                  ? 'bg-foreground text-background font-bold'
                  : s.num < current
                  ? 'bg-success/15 text-success border border-success/30'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {s.num < current ? '✓' : s.num}
            </div>
            <span
              className={
                s.num === current
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground font-normal'
              }
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className="flex-1 h-px bg-border mx-6 min-w-[20px]" />
          )}
        </div>
      ))}
    </div>
  );
}

function FileDropZone({
  label, type, onFileSelect, upload
}: {
  label: string;
  type: 'prescription' | 'bill';
  onFileSelect: (file: File, type: 'prescription' | 'bill') => void;
  upload?: DocumentUpload;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file, type);
  }, [onFileSelect, type]);

  return (
    <div>
      <label className="block text-sm font-medium mb-2 text-foreground">{label}</label>
      <div
        className={`upload-zone p-6 text-center transition-all ${isDragging ? 'drag-over' : ''} ${upload ? 'border-solid' : ''}`}
        style={upload ? { borderColor: 'var(--color-success)', background: 'rgba(34,197,94,0.02)' } : {}}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file, type);
          }}
        />
        {!upload ? (
          <>
            <Upload size={28} className="mx-auto mb-3 text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">Drop file or click to upload</div>
            <div className="text-xs mt-1 text-muted-foreground">JPG, PNG, PDF supported</div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              {upload.extractionStatus === 'extracting' && (
                <Loader size={16} className="animate-spin text-muted-foreground" />
              )}
              {upload.extractionStatus === 'done' && (
                <CheckCircle size={16} className="text-success" />
              )}
              {upload.extractionStatus === 'error' && (
                <AlertCircle size={16} className="text-destructive" />
              )}
              <span className="text-sm font-medium text-foreground">{upload.file.name}</span>
            </div>
            {upload.extractionStatus === 'extracting' && (
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles size={12} className="text-warning animate-pulse" />
                Extracting data with Gemini AI...
              </div>
            )}
            {upload.extractionStatus === 'done' && upload.extractionResult && (
              <div className="text-xs text-success">
                ✓ Extraction complete · {Math.round(upload.extractionResult.confidence * 100)}% confidence
              </div>
            )}
            {upload.extractionStatus === 'error' && (
              <div className="text-xs text-destructive">{upload.extractionError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ExtractionCard({ result, title }: { result: ExtractionResult; title: string }) {
  const fields = [
    { label: 'Patient', value: result.patientName },
    { label: 'Doctor', value: result.doctorName },
    { label: 'Reg. No.', value: result.doctorRegistrationNumber },
    { label: 'Diagnosis', value: result.diagnosis },
    { label: 'Provider', value: result.providerName },
    { label: 'Date', value: result.treatmentDate ?? result.billDate },
    { label: 'Consultation', value: result.consultationAmount ? `₹${result.consultationAmount}` : null },
    { label: 'Pharmacy', value: result.pharmacyAmount ? `₹${result.pharmacyAmount}` : null },
    { label: 'Diagnostics', value: result.diagnosticAmount ? `₹${result.diagnosticAmount}` : null },
  ].filter(f => f.value);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs font-mono text-muted-foreground">
          {Math.round(result.confidence * 100)}% confidence
        </div>
      </div>
      <div className="space-y-2">
        {fields.map(f => (
          <div key={f.label} className="flex gap-3 text-xs">
            <span className="w-24 flex-shrink-0 text-muted-foreground">{f.label}</span>
            <span className="text-foreground font-medium truncate">{f.value}</span>
          </div>
        ))}
        {result.medicines.length > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="w-24 flex-shrink-0 text-muted-foreground">Medicines</span>
            <span className="text-foreground">{result.medicines.join(', ')}</span>
          </div>
        )}
        {result.procedures.length > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="w-24 flex-shrink-0 text-muted-foreground">Procedures</span>
            <span className="text-foreground">{result.procedures.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SubmitClaim() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [uploads, setUploads] = useState<{ prescription?: DocumentUpload; bill?: DocumentUpload }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [backendAvailable, setBackendAvailable] = useState(false);

  useEffect(() => {
    api.isBackendAvailable().then(setBackendAvailable).catch(() => setBackendAvailable(false));
  }, []);

  const hasApiKey = backendAvailable || documentExtractor.hasApiKey();
  const stats = storageService.getClaimsStats();
  const usedYtdFormatted = `₹${(stats?.totalApprovedAmount ?? 12400).toLocaleString('en-IN')}`;

  const updateForm = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.memberId.trim()) newErrors.memberId = 'Member ID is required';
    if (!form.memberName.trim()) newErrors.memberName = 'Member name is required';
    if (!form.memberJoinDate) newErrors.memberJoinDate = 'Join date is required';
    if (!form.treatmentDate) newErrors.treatmentDate = 'Treatment date is required';
    if (!form.providerName.trim()) newErrors.providerName = 'Provider name is required';
    if (!form.claimedAmount || isNaN(Number(form.claimedAmount)) || Number(form.claimedAmount) <= 0) {
      newErrors.claimedAmount = 'Enter a valid claim amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileSelect = async (file: File, type: 'prescription' | 'bill') => {
    const reader = new FileReader();
    const base64 = await new Promise<string>(resolve => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    const upload: DocumentUpload = {
      file,
      base64,
      mimeType: file.type,
      type,
      extractionStatus: hasApiKey ? 'extracting' : 'pending',
    };

    setUploads(prev => ({ ...prev, [type]: upload }));

    if (hasApiKey) {
      try {
        let result: ExtractionResult;
        if (backendAvailable) {
          // Use backend API (keeps Gemini key server-side)
          result = await api.extractDocument(file, type);
        } else {
          // Fallback to client-side extraction
          result = await documentExtractor.extractFromFile(file);
        }
        setUploads(prev => ({
          ...prev,
          [type]: { ...prev[type]!, extractionResult: result, extractionStatus: 'done' },
        }));
      } catch (err) {
        setUploads(prev => ({
          ...prev,
          [type]: {
            ...prev[type]!,
            extractionStatus: 'error',
            extractionError: err instanceof Error ? err.message : 'Extraction failed',
          },
        }));
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const presc = uploads.prescription?.extractionResult;
      const bill = uploads.bill?.extractionResult;
      const diagnosis = presc?.diagnosis ?? bill?.diagnosis ?? '';
      const medicines = presc?.medicines ?? [];
      const procedures = presc?.procedures ?? [];

      if (backendAvailable) {
        // ── Backend-first path: POST /api/claims ──
        const claimData = {
          memberId: form.memberId,
          memberName: form.memberName,
          memberJoinDate: form.memberJoinDate,
          relationship: form.relationship,
          treatmentDate: form.treatmentDate,
          providerName: form.providerName,
          cashlessRequest: form.cashlessRequest,
          claimedAmount: Number(form.claimedAmount),
          previousClaimsSameDay: Number(form.previousClaimsSameDay),
          extractedPatientName: presc?.patientName ?? bill?.patientName ?? null,
          extractedDoctorName: presc?.doctorName ?? null,
          extractedDoctorReg: presc?.doctorRegistrationNumber ?? null,
          extractedDiagnosis: diagnosis || null,
          extractedMedicines: medicines,
          extractedProcedures: procedures,
          consultationAmount: bill?.consultationAmount ?? 0,
          pharmacyAmount: bill?.pharmacyAmount ?? 0,
          diagnosticAmount: bill?.diagnosticAmount ?? 0,
          treatmentDateFromDoc: presc?.treatmentDate ?? null,
          billDateFromDoc: bill?.billDate ?? null,
          hasPrescription: !!uploads.prescription,
          hasBill: !!uploads.bill,
          ytdApprovedAmount: 0,
        };

        const claim = await api.createClaim(claimData);
        // Also cache locally
        storageService.saveClaim(claim);
        navigate(`/claim/${claim.claimId}`);
      } else {
        // ── Fallback: local adjudication ──
        let medicalNecessityResult = null;
        if (documentExtractor.hasApiKey() && diagnosis) {
          try {
            medicalNecessityResult = await documentExtractor.assessMedicalNecessity(
              diagnosis, medicines, procedures
            );
          } catch { /* proceed without it */ }
        }

        const input: AdjudicationInput = {
          memberId: form.memberId,
          memberName: form.memberName,
          memberJoinDate: form.memberJoinDate,
          treatmentDate: form.treatmentDate,
          submittedAt: new Date().toISOString().split('T')[0],
          claimedAmount: Number(form.claimedAmount),
          providerName: form.providerName,
          cashlessRequest: form.cashlessRequest,
          extractedPatientName: presc?.patientName ?? bill?.patientName ?? null,
          extractedDoctorName: presc?.doctorName ?? null,
          extractedDoctorReg: presc?.doctorRegistrationNumber ?? null,
          extractedDiagnosis: diagnosis || null,
          extractedMedicines: medicines,
          extractedProcedures: procedures,
          consultationAmount: bill?.consultationAmount ?? 0,
          pharmacyAmount: bill?.pharmacyAmount ?? 0,
          diagnosticAmount: bill?.diagnosticAmount ?? 0,
          treatmentDateFromDoc: presc?.treatmentDate ?? null,
          billDateFromDoc: bill?.billDate ?? null,
          hasPrescription: !!uploads.prescription,
          hasBill: !!uploads.bill,
          previousClaimsSameDay: Number(form.previousClaimsSameDay),
          medicalNecessityResult,
          ytdApprovedAmount: 0,
        };

        const decision = adjudicateClaim(input);

        const timeline: ClaimTimelineEvent[] = [
          { stage: 'Submitted', status: 'completed', timestamp: new Date().toISOString(), description: 'Claim submitted successfully' },
          { stage: 'AI Extraction', status: 'completed', timestamp: new Date().toISOString(), description: hasApiKey ? 'Documents analyzed with Gemini Vision' : 'Manual data entry (no API key)' },
          { stage: 'Adjudication', status: 'completed', timestamp: new Date().toISOString(), description: `${decision.ruleEvaluations.length} rules evaluated` },
          { stage: 'Decision', status: 'completed', timestamp: new Date().toISOString(), description: decision.status },
        ];

        const claim: Claim = {
          claimId: generateClaimId(),
          status: decision.status === 'APPROVED' ? 'APPROVED' :
                  decision.status === 'REJECTED' ? 'REJECTED' :
                  decision.status === 'PARTIAL' ? 'PARTIAL' : 'MANUAL_REVIEW',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          member: {
            memberId: form.memberId,
            memberName: form.memberName,
            memberJoinDate: form.memberJoinDate,
            relationship: form.relationship,
          },
          provider: {
            providerName: form.providerName,
            isNetworkProvider: false,
            cashlessRequest: form.cashlessRequest,
          },
          treatmentDate: form.treatmentDate,
          claimedAmount: Number(form.claimedAmount),
          previousClaimsSameDay: Number(form.previousClaimsSameDay),
          documents: Object.values(uploads).filter(Boolean) as DocumentUpload[],
          decision,
          appeals: [],
          timeline,
        };

        storageService.saveClaim(claim);
        navigate(`/claim/${claim.claimId}`);
      }
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1280px] w-full space-y-6 animate-fade-in text-foreground">
      {/* Header Title Block */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase mb-2">NEW CLAIM</div>
          <h1 className="text-[26px] leading-tight font-semibold text-foreground tracking-tight">Submit OPD claim</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground max-w-2xl">
            Three quick steps. Documents are processed on submit — average adjudication under 12 seconds.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <StepIndicator current={step} />
      </div>

      {/* Step 1: Member Info */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left: Form Card */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-6 animate-fade-in">
            {/* Member Info */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-[14px] font-semibold text-foreground">Member information</h2>
                </div>
                <span className="text-[11px] text-muted-foreground">As per HR roster</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Member ID *</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    placeholder="EMP00184"
                    value={form.memberId}
                    onChange={e => updateForm('memberId', e.target.value)}
                  />
                  {errors.memberId && <p className="text-xs mt-1 text-destructive font-medium">{errors.memberId}</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Full Name *</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    placeholder="Rajesh Kumar"
                    value={form.memberName}
                    onChange={e => updateForm('memberName', e.target.value)}
                  />
                  {errors.memberName && <p className="text-xs mt-1 text-destructive font-medium">{errors.memberName}</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Policy Join Date *</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    type="date"
                    value={form.memberJoinDate}
                    onChange={e => updateForm('memberJoinDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Relationship *</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    value={form.relationship}
                    onChange={e => updateForm('relationship', e.target.value as any)}
                  >
                    <option value="employee">Employee</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Treatment Details */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-[14px] font-semibold text-foreground">Treatment details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Treatment Date *</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    type="date"
                    value={form.treatmentDate}
                    onChange={e => updateForm('treatmentDate', e.target.value)}
                  />
                  {errors.treatmentDate && <p className="text-xs mt-1 text-destructive font-medium">{errors.treatmentDate}</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Claim Amount (₹) *</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    type="number"
                    placeholder="1,500"
                    value={form.claimedAmount}
                    onChange={e => updateForm('claimedAmount', e.target.value)}
                  />
                  {errors.claimedAmount && <p className="text-xs mt-1 text-destructive font-medium">{errors.claimedAmount}</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Provider Name *</label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    placeholder="Apollo Hospitals"
                    value={form.providerName}
                    onChange={e => updateForm('providerName', e.target.value)}
                  />
                  {errors.providerName && <p className="text-xs mt-1 text-destructive font-medium">{errors.providerName}</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5 font-sans">
                    Previous Claims Same Day
                  </label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-[13px] text-foreground focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring/20"
                    type="number"
                    min="0"
                    max="10"
                    value={form.previousClaimsSameDay}
                    onChange={e => updateForm('previousClaimsSameDay', e.target.value)}
                  />
                </div>
                <div className="col-span-1 md:col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-10 h-6 rounded-full transition-all flex items-center p-0.5 border ${
                        form.cashlessRequest ? 'bg-foreground border-foreground' : 'bg-muted border-border'
                      }`}
                      onClick={() => updateForm('cashlessRequest', !form.cashlessRequest)}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-all ${
                          form.cashlessRequest ? 'bg-background translate-x-4' : 'bg-muted-foreground translate-x-0'
                        }`}
                      />
                    </div>
                    <span className="text-[13px] text-muted-foreground select-none">
                      Cashless claim at network hospital
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => validateStep1() && setStep(2)}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors cursor-pointer"
              >
                Next: Upload Documents <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Right: Sidebar Cards */}
          <div className="space-y-4">
            {/* Policy Snapshot Card */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">
                POLICY SNAPSHOT
              </div>
              <h3 className="font-semibold text-foreground text-[14px] mb-3">Plum OPD Advantage</h3>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per-claim limit</span>
                  <span className="font-medium text-foreground">₹5,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual limit</span>
                  <span className="font-medium text-foreground">₹50,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Used YTD</span>
                  <span className="font-medium text-foreground">{usedYtdFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission deadline</span>
                  <span className="font-medium text-foreground">30 days</span>
                </div>
              </div>
            </div>

            {/* Need Help Card */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <h4 className="font-semibold text-foreground text-[13.5px] mb-1">Need help?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Most claims clear in &lt; 12s. If something looks off, our team reviews within a business day.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Document Upload */}
      {step === 2 && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-foreground">Upload Documents</h2>
            {!hasApiKey && (
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded font-medium border bg-warning/10 text-warning border-warning/20">
                No API key — extraction unavailable
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileDropZone
              label="Prescription *"
              type="prescription"
              onFileSelect={handleFileSelect}
              upload={uploads.prescription}
            />
            <FileDropZone
              label="Medical Bill *"
              type="bill"
              onFileSelect={handleFileSelect}
              upload={uploads.bill}
            />
          </div>

          {/* Live extraction results */}
          {(uploads.prescription?.extractionResult || uploads.bill?.extractionResult) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                <Sparkles size={14} className="text-warning animate-pulse" />
                Extracted Data Preview
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {uploads.prescription?.extractionResult && (
                  <ExtractionCard result={uploads.prescription.extractionResult} title="Prescription" />
                )}
                {uploads.bill?.extractionResult && (
                  <ExtractionCard result={uploads.bill.extractionResult} title="Medical Bill" />
                )}
              </div>
            </div>
          )}

          {/* Notice if no uploads */}
          {!uploads.prescription && !uploads.bill && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-muted/30">
              <AlertCircle size={16} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Please upload at least the consultation prescription and the medical bill. Missing documents will trigger automated rejection.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-[13px] font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors cursor-pointer"
            >
              Review Claim <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center gap-3 mb-4">
              <ClipboardList size={20} className="text-muted-foreground" />
              <h2 className="text-[14px] font-semibold text-foreground">Review Claim Summary</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 text-[13px]">
              {[
                ['Member ID', form.memberId],
                ['Member Name', form.memberName],
                ['Policy Join Date', form.memberJoinDate],
                ['Treatment Date', form.treatmentDate],
                ['Provider', form.providerName],
                ['Claimed Amount', `₹${Number(form.claimedAmount).toLocaleString('en-IN')}`],
                ['Cashless Request', form.cashlessRequest ? 'Yes' : 'No'],
                ['Documents', `${uploads.prescription ? '✓ Prescription' : '✗ No Prescription'}, ${uploads.bill ? '✓ Bill' : '✗ No Bill'}`],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Warning for missing docs */}
          {(!uploads.prescription || !uploads.bill) && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive font-medium">
                {!uploads.prescription && !uploads.bill
                  ? 'No documents uploaded. Your claim will be rejected for missing documents.'
                  : !uploads.prescription
                  ? 'No prescription uploaded. Claim will be rejected for missing prescription.'
                  : 'No bill uploaded. Please upload the medical bill for claim processing.'}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-[13px] font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors min-w-40 justify-center cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="animate-spin" /> Adjudicating...
                </>
              ) : (
                <>
                  <Eye size={16} /> Submit & Adjudicate
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
