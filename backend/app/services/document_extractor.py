"""Document extraction service using Gemini AI.

Direct port of documentExtractor.ts — same prompts, same parsing logic.
"""

from __future__ import annotations
import base64
import json
from typing import Optional

from app.core.config import get_settings
from app.models.claim import ExtractionResult
from app.models.decision import MedicalNecessityResult

# Same prompts as the TypeScript frontend
EXTRACTION_PROMPT = """You are a medical document OCR and data extraction specialist.
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
- Do NOT make up information that isn't in the document"""

MEDICAL_NECESSITY_PROMPT = """You are a medical review specialist for insurance claims.
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
{{
  "score": number between 0 and 1,
  "reasoning": "brief one-paragraph explanation"
}}

Score guide: 0.9+ = clearly medically necessary, 0.7-0.9 = likely necessary, 0.5-0.7 = questionable, <0.5 = not medically necessary"""


def _get_gemini_model():
    """Get configured Gemini model instance."""
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise ValueError("Gemini API key not configured. Set GEMINI_API_KEY in environment.")

    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(settings.GEMINI_MODEL)


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from response."""
    import re
    text = text.strip()
    text = re.sub(r"^```(?:json)?\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


async def extract_from_file(file_bytes: bytes, mime_type: str) -> ExtractionResult:
    """Extract data from a document image using Gemini Vision.

    Args:
        file_bytes: Raw file bytes
        mime_type: MIME type (image/jpeg, image/png, application/pdf, etc.)
    """
    model = _get_gemini_model()

    image_part = {
        "inline_data": {
            "data": base64.b64encode(file_bytes).decode("utf-8"),
            "mime_type": mime_type or "image/jpeg",
        }
    }

    response = model.generate_content([EXTRACTION_PROMPT, image_part])
    text = response.text.strip()
    json_text = _strip_code_fences(text)

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        return ExtractionResult(confidence=0.1, raw_text=text)

    return ExtractionResult(
        patient_name=parsed.get("patientName"),
        doctor_name=parsed.get("doctorName"),
        doctor_registration_number=parsed.get("doctorRegistrationNumber"),
        diagnosis=parsed.get("diagnosis"),
        medicines=parsed.get("medicines", []) if isinstance(parsed.get("medicines"), list) else [],
        procedures=parsed.get("procedures", []) if isinstance(parsed.get("procedures"), list) else [],
        consultation_amount=parsed.get("consultationAmount") if isinstance(parsed.get("consultationAmount"), (int, float)) else None,
        pharmacy_amount=parsed.get("pharmacyAmount") if isinstance(parsed.get("pharmacyAmount"), (int, float)) else None,
        diagnostic_amount=parsed.get("diagnosticAmount") if isinstance(parsed.get("diagnosticAmount"), (int, float)) else None,
        provider_name=parsed.get("providerName"),
        treatment_date=parsed.get("treatmentDate"),
        bill_date=parsed.get("billDate"),
        confidence=min(1.0, max(0.0, parsed.get("confidence", 0.5))) if isinstance(parsed.get("confidence"), (int, float)) else 0.5,
        raw_text=text,
    )


async def assess_medical_necessity(
    diagnosis: str,
    medicines: list[str],
    procedures: list[str],
) -> MedicalNecessityResult:
    """Assess medical necessity using Gemini."""
    model = _get_gemini_model()

    prompt = MEDICAL_NECESSITY_PROMPT.replace(
        "{diagnosis}", diagnosis or "Not specified"
    ).replace(
        "{medicines}", ", ".join(medicines) if medicines else "None"
    ).replace(
        "{procedures}", ", ".join(procedures) if procedures else "None"
    )

    response = model.generate_content(prompt)
    text = response.text.strip()
    json_text = _strip_code_fences(text)

    try:
        parsed = json.loads(json_text)
        return MedicalNecessityResult(
            score=min(1.0, max(0.0, parsed.get("score", 0.8))),
            reasoning=parsed.get("reasoning", "Medical necessity assessment completed."),
        )
    except json.JSONDecodeError:
        return MedicalNecessityResult(
            score=0.8,
            reasoning="Could not parse medical necessity assessment.",
        )


def has_api_key() -> bool:
    """Check if Gemini API key is configured."""
    settings = get_settings()
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
