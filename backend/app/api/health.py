"""Health check endpoint."""

from fastapi import APIRouter
from app.database.mongodb import get_database
from app.services.document_extractor import has_api_key

router = APIRouter()


@router.get("/health")
async def health_check():
    """System health check — MongoDB connectivity and Gemini key status."""
    mongo_ok = False
    try:
        db = get_database()
        await db.command("ping")
        mongo_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if mongo_ok else "degraded",
        "mongodb": "connected" if mongo_ok else "disconnected",
        "gemini_configured": has_api_key(),
    }
