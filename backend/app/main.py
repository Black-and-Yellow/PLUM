"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.database.mongodb import connect_to_mongo, close_mongo_connection
from app.api import health, claims, extraction, adjudication, policies


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings = get_settings()

    # Create uploads directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Connect to MongoDB
    await connect_to_mongo()
    print(f"✅ Connected to MongoDB at {settings.MONGODB_URL}")

    # Seed default policy if collection is empty
    from app.database.mongodb import get_database
    from app.services.policy_service import get_default_policy_dict
    db = get_database()
    if await db.policies.count_documents({}) == 0:
        await db.policies.insert_one(get_default_policy_dict())
        print("✅ Seeded default policy terms")

    yield

    # Shutdown
    await close_mongo_connection()
    print("🛑 MongoDB connection closed")


app = FastAPI(
    title="Plum OPD Claim Adjudication API",
    description="AI-powered OPD insurance claim adjudication tool with Gemini integration",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
settings = get_settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register API routes
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(claims.router, prefix="/api", tags=["Claims"])
app.include_router(extraction.router, prefix="/api", tags=["Extraction"])
app.include_router(adjudication.router, prefix="/api", tags=["Adjudication"])
app.include_router(policies.router, prefix="/api", tags=["Policies"])
