export interface ExtractionResult {
  patientName: string | null;
  doctorName: string | null;
  doctorRegistrationNumber: string | null;
  diagnosis: string | null;
  medicines: string[];
  procedures: string[];
  consultationAmount: number | null;
  pharmacyAmount: number | null;
  diagnosticAmount: number | null;
  providerName: string | null;
  treatmentDate: string | null;
  billDate: string | null;
  confidence: number;
  rawText?: string;
}

export interface DocumentUpload {
  file: File;
  base64: string;
  mimeType: string;
  type: 'prescription' | 'bill' | 'diagnostic_report' | 'other';
  extractionResult?: ExtractionResult;
  extractionStatus: 'pending' | 'extracting' | 'done' | 'error';
  extractionError?: string;
}

export interface CombinedExtractionResult {
  prescription: ExtractionResult | null;
  bill: ExtractionResult | null;
  mergedData: MergedClaimData;
  overallConfidence: number;
}

export interface MergedClaimData {
  patientName: string | null;
  doctorName: string | null;
  doctorRegistrationNumber: string | null;
  diagnosis: string | null;
  medicines: string[];
  procedures: string[];
  totalConsultationAmount: number;
  totalPharmacyAmount: number;
  totalDiagnosticAmount: number;
  totalBillAmount: number;
  providerName: string | null;
  treatmentDate: string | null;
  billDate: string | null;
}
