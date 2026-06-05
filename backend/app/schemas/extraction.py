"""Schemas for document extraction endpoints."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.claim import ExtractionResult
from app.models.decision import MedicalNecessityResult


class ExtractionResponse(BaseModel):
    """Response from document extraction."""
    extraction: ExtractionResult
    doc_type: str


class MedicalNecessityRequest(BaseModel):
    """Request for medical necessity assessment."""
    diagnosis: str
    medicines: list[str] = Field(default_factory=list)
    procedures: list[str] = Field(default_factory=list)


class MedicalNecessityResponse(BaseModel):
    """Response from medical necessity assessment."""
    result: MedicalNecessityResult
