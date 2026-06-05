"""Document extraction endpoints (Gemini-powered)."""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services import document_extractor
from app.schemas.extraction import (
    ExtractionResponse,
    MedicalNecessityRequest,
    MedicalNecessityResponse,
)

router = APIRouter()


@router.post("/extract", response_model=ExtractionResponse)
async def extract_document(
    file: UploadFile = File(...),
    doc_type: str = Form("prescription"),
):
    """Extract structured data from an uploaded medical document using Gemini Vision.

    Accepts: prescription, bill, diagnostic_report
    """
    if not document_extractor.has_api_key():
        raise HTTPException(
            status_code=503,
            detail="Gemini API key not configured. Set GEMINI_API_KEY in environment.",
        )

    file_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"

    try:
        result = await document_extractor.extract_from_file(file_bytes, mime_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    return ExtractionResponse(extraction=result, doc_type=doc_type)


@router.post("/medical-necessity", response_model=MedicalNecessityResponse)
async def assess_medical_necessity(request: MedicalNecessityRequest):
    """Assess medical necessity for a claim using Gemini."""
    if not document_extractor.has_api_key():
        raise HTTPException(
            status_code=503,
            detail="Gemini API key not configured.",
        )

    try:
        result = await document_extractor.assess_medical_necessity(
            request.diagnosis,
            request.medicines,
            request.procedures,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assessment failed: {str(e)}")

    return MedicalNecessityResponse(result=result)
