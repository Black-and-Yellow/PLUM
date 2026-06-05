import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { storageService } from './storageService';
import type { ExtractionResult } from '../types/extraction';
import type { MedicalNecessityResult } from '../types/decision';

function getGemini(): GoogleGenerativeAI {
  const key = storageService.getApiKey();
  if (!key) throw new Error('Gemini API key not configured. Please set it in Settings.');
  return new GoogleGenerativeAI(key);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EXTRACTION_PROMPT = `You are a medical document OCR and data extraction specialist.
Analyze the provided medical document image carefully.

Extract the following fields and return ONLY valid JSON (no markdown, no code fences):
{
  "patientName": string or null,
  "doctorName": string or null,
  "doctorRegistrationNumber": string or null,
  "diagnosis": string or null,
  "medicines": string[],
  "procedures": string[],
  "consultationAmount": number or null,
  "pharmacyAmount": number or null,
  "diagnosticAmount": number or null,
  "providerName": string or null,
  "treatmentDate": "YYYY-MM-DD" or null,
  "billDate": "YYYY-MM-DD" or null,
  "confidence": number between 0 and 1
}

Rules:
- Extract ALL medicine names mentioned with dosage
- Extract ALL procedures, tests, therapies mentioned
- For amounts: extract only the numeric value in INR (no currency symbols)
- Doctor registration format is typically: [STATE]/[NUMBER]/[YEAR] (e.g., KA/12345/2015)
- Confidence: 0.9+ if document is clear, 0.7-0.9 if partially readable, <0.7 if very unclear
- Return null for fields you cannot extract with confidence
- Do NOT make up information that isn't in the document`;

const MEDICAL_NECESSITY_PROMPT = `You are a medical review specialist for insurance claims.
Evaluate the medical necessity of the following claim.

Patient Information:
- Diagnosis: {diagnosis}
- Prescribed Medicines: {medicines}
- Procedures/Tests: {procedures}

Assess whether:
1. The diagnosis clinically justifies the prescribed medicines
2. The procedures/tests are appropriate for the diagnosis
3. The treatment follows standard medical protocols

Return ONLY valid JSON (no markdown):
{
  "score": number between 0 and 1,
  "reasoning": "brief one-paragraph explanation"
}

Score guide: 0.9+ = clearly medically necessary, 0.7-0.9 = likely necessary, 0.5-0.7 = questionable, <0.5 = not medically necessary`;

export const documentExtractor = {
  async extractFromFile(file: File): Promise<ExtractionResult> {
    const gemini = getGemini();
    const modelName = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-1.5-flash';
    const model = gemini.getGenerativeModel({ model: modelName });

    const base64 = await fileToBase64(file);
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

    const imagePart: Part = {
      inlineData: {
        data: base64,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const result = await model.generateContent([EXTRACTION_PROMPT, imagePart]);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed: Partial<ExtractionResult>;
    try {
      parsed = JSON.parse(jsonText) as Partial<ExtractionResult>;
    } catch {
      console.error('[documentExtractor] Failed to parse Gemini response:', text);
      return {
        patientName: null,
        doctorName: null,
        doctorRegistrationNumber: null,
        diagnosis: null,
        medicines: [],
        procedures: [],
        consultationAmount: null,
        pharmacyAmount: null,
        diagnosticAmount: null,
        providerName: null,
        treatmentDate: null,
        billDate: null,
        confidence: 0.1,
        rawText: text,
      };
    }

    return {
      patientName: parsed.patientName ?? null,
      doctorName: parsed.doctorName ?? null,
      doctorRegistrationNumber: parsed.doctorRegistrationNumber ?? null,
      diagnosis: parsed.diagnosis ?? null,
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
      procedures: Array.isArray(parsed.procedures) ? parsed.procedures : [],
      consultationAmount: typeof parsed.consultationAmount === 'number' ? parsed.consultationAmount : null,
      pharmacyAmount: typeof parsed.pharmacyAmount === 'number' ? parsed.pharmacyAmount : null,
      diagnosticAmount: typeof parsed.diagnosticAmount === 'number' ? parsed.diagnosticAmount : null,
      providerName: parsed.providerName ?? null,
      treatmentDate: parsed.treatmentDate ?? null,
      billDate: parsed.billDate ?? null,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      rawText: text,
    };
  },

  async assessMedicalNecessity(
    diagnosis: string,
    medicines: string[],
    procedures: string[]
  ): Promise<MedicalNecessityResult> {
    const gemini = getGemini();
    const modelName = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-1.5-flash';
    const model = gemini.getGenerativeModel({ model: modelName });

    const prompt = MEDICAL_NECESSITY_PROMPT
      .replace('{diagnosis}', diagnosis || 'Not specified')
      .replace('{medicines}', medicines.length > 0 ? medicines.join(', ') : 'None')
      .replace('{procedures}', procedures.length > 0 ? procedures.join(', ') : 'None');

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    try {
      const parsed = JSON.parse(jsonText) as { score: number; reasoning: string };
      return {
        score: Math.min(1, Math.max(0, parsed.score ?? 0.8)),
        reasoning: parsed.reasoning ?? 'Medical necessity assessment completed.',
      };
    } catch {
      return { score: 0.8, reasoning: 'Could not parse medical necessity assessment.' };
    }
  },

  hasApiKey(): boolean {
    return storageService.hasApiKey();
  },
};
