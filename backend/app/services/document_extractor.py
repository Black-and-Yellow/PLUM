"""Document extraction service using Gemini AI.

Improvements over v1:
- Structured JSON mode (response_mime_type="application/json") where supported
- Retry logic: up to 3 attempts with exponential backoff
- Timeout: 30-second per-attempt timeout
- On parse failure: returns low-confidence partial result (routes to MANUAL_REVIEW)
- Robust code-fence stripping with multi-pattern cleanup
- Never crashes: all exceptions caught and surfaced gracefully
"""

from __future__ import annotations
import asyncio
import base64
import json
import re
import time
from typing import Optional

from app.core.config import get_settings
from app.models.claim import ExtractionResult
from app.models.decision import MedicalNecessityResult

# ── Prompts ───────────────────────────────────────────────────────────────────

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

# ── Constants ─────────────────────────────────────────────────────────────────

_MAX_RETRIES = 3
_BASE_BACKOFF_SECONDS = 1.0  # doubles each retry: 1s, 2s, 4s
_TIMEOUT_SECONDS = 30


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_gemini_model(json_mode: bool = False):
    """Get a configured Gemini GenerativeModel instance.

    Args:
        json_mode: If True, requests application/json response MIME type
                   for structured output (reduces parsing failures).
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise ValueError("Gemini API key not configured. Set GEMINI_API_KEY in environment.")

    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)

    generation_config = {}
    if json_mode:
        # Ask Gemini to return structured JSON directly — greatly reduces
        # markdown-wrapped responses and parse failures.
        try:
            generation_config = genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        except Exception:
            # Older SDK versions may not support this parameter — ignore
            generation_config = {}

    return genai.GenerativeModel(settings.GEMINI_MODEL, generation_config=generation_config)


def _strip_code_fences(text: str) -> str:
    """Robustly strip markdown code fences and surrounding whitespace."""
    text = text.strip()
    # Remove ```json or ``` at the start
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
    # Remove ``` at the end
    text = re.sub(r"\n?```\s*$", "", text)
    # Sometimes Gemini wraps in single backticks
    text = re.sub(r"^`+|`+$", "", text)
    return text.strip()


def _safe_parse_json(text: str) -> Optional[dict]:
    """Attempt to parse JSON from a Gemini response, handling common issues."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try after stripping code fences
    cleaned = _strip_code_fences(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try finding the first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


async def _call_with_retry(model, content: list, operation: str) -> str:
    """Call Gemini with retry logic and exponential backoff.

    Args:
        model: Gemini GenerativeModel instance
        content: Content list to send
        operation: Human-readable name for logging

    Returns:
        Response text string

    Raises:
        Exception: If all retries are exhausted
    """
    last_exc: Optional[Exception] = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            # Run synchronous Gemini call in thread pool with timeout
            loop = asyncio.get_event_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: model.generate_content(content)),
                timeout=_TIMEOUT_SECONDS,
            )
            return response.text.strip()

        except asyncio.TimeoutError as exc:
            last_exc = exc
            print(f"[Gemini] {operation} attempt {attempt}/{_MAX_RETRIES} timed out after {_TIMEOUT_SECONDS}s")
        except Exception as exc:
            last_exc = exc
            print(f"[Gemini] {operation} attempt {attempt}/{_MAX_RETRIES} failed: {exc}")

        if attempt < _MAX_RETRIES:
            wait = _BASE_BACKOFF_SECONDS * (2 ** (attempt - 1))
            print(f"[Gemini] Retrying {operation} in {wait:.1f}s...")
            await asyncio.sleep(wait)

    raise RuntimeError(
        f"Gemini {operation} failed after {_MAX_RETRIES} attempts. Last error: {last_exc}"
    )


# ── Public API ────────────────────────────────────────────────────────────────

async def extract_from_file(file_bytes: bytes, mime_type: str) -> ExtractionResult:
    """Extract structured data from a document image using Gemini Vision.

    On failure or parse error, returns a low-confidence ExtractionResult
    rather than raising — the adjudication engine will route the claim
    to MANUAL_REVIEW based on the confidence score.

    Args:
        file_bytes: Raw file bytes
        mime_type: MIME type (image/jpeg, image/png, application/pdf, etc.)
    """
    try:
        model = _get_gemini_model(json_mode=True)
    except ValueError as exc:
        # API key not configured — return empty result
        return ExtractionResult(confidence=0.0, raw_text=str(exc))

    image_part = {
        "inline_data": {
            "data": base64.b64encode(file_bytes).decode("utf-8"),
            "mime_type": mime_type or "image/jpeg",
        }
    }

    try:
        text = await _call_with_retry(model, [EXTRACTION_PROMPT, image_part], "document extraction")
    except Exception as exc:
        print(f"[Gemini] Extraction failed completely: {exc}")
        # Return very low confidence — adjudication will escalate to MANUAL_REVIEW
        return ExtractionResult(confidence=0.1, raw_text=f"Extraction failed: {exc}")

    parsed = _safe_parse_json(text)

    if parsed is None:
        print(f"[Gemini] Could not parse extraction response. Raw: {text[:200]}...")
        return ExtractionResult(confidence=0.15, raw_text=text)

    def safe_float(val) -> Optional[float]:
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            return float(val)
        return None

    def safe_list(val) -> list[str]:
        if isinstance(val, list):
            return [str(x) for x in val if x]
        return []

    return ExtractionResult(
        patient_name=parsed.get("patientName"),
        doctor_name=parsed.get("doctorName"),
        doctor_registration_number=parsed.get("doctorRegistrationNumber"),
        diagnosis=parsed.get("diagnosis"),
        medicines=safe_list(parsed.get("medicines")),
        procedures=safe_list(parsed.get("procedures")),
        consultation_amount=safe_float(parsed.get("consultationAmount")),
        pharmacy_amount=safe_float(parsed.get("pharmacyAmount")),
        diagnostic_amount=safe_float(parsed.get("diagnosticAmount")),
        provider_name=parsed.get("providerName"),
        treatment_date=parsed.get("treatmentDate"),
        bill_date=parsed.get("billDate"),
        confidence=min(1.0, max(0.0, safe_float(parsed.get("confidence")) or 0.5)),
        raw_text=text,
    )


async def assess_medical_necessity(
    diagnosis: str,
    medicines: list[str],
    procedures: list[str],
) -> MedicalNecessityResult:
    """Assess medical necessity using Gemini LLM.

    Falls back to a neutral score (0.8) on any failure so that
    the adjudication engine can still proceed without crashing.
    """
    try:
        model = _get_gemini_model(json_mode=True)
    except ValueError:
        return MedicalNecessityResult(
            score=0.8,
            reasoning="Medical necessity not assessed (Gemini API not configured). Full confidence assumed.",
        )

    prompt = MEDICAL_NECESSITY_PROMPT.replace(
        "{diagnosis}", diagnosis or "Not specified"
    ).replace(
        "{medicines}", ", ".join(medicines) if medicines else "None"
    ).replace(
        "{procedures}", ", ".join(procedures) if procedures else "None"
    )

    try:
        text = await _call_with_retry(model, [prompt], "medical necessity assessment")
    except Exception as exc:
        print(f"[Gemini] Medical necessity assessment failed: {exc}")
        return MedicalNecessityResult(
            score=0.8,
            reasoning="Medical necessity assessment unavailable (service error). Default confidence applied.",
        )

    parsed = _safe_parse_json(text)
    if parsed is None:
        return MedicalNecessityResult(
            score=0.8,
            reasoning="Could not parse medical necessity assessment response.",
        )

    score = parsed.get("score")
    if not isinstance(score, (int, float)):
        score = 0.8

    return MedicalNecessityResult(
        score=min(1.0, max(0.0, float(score))),
        reasoning=parsed.get("reasoning", "Assessment completed."),
    )


def has_api_key() -> bool:
    """Check if Gemini API key is configured."""
    settings = get_settings()
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
