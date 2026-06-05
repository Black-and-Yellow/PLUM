"""MongoDB connection manager using Motor (async driver)."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    """Initialize MongoDB connection."""
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.MONGODB_URL)
    _db = _client[settings.DATABASE_NAME]

    # Create indexes
    await _db.claims.create_index("claim_id", unique=True)
    await _db.claims.create_index("member.member_id")
    await _db.claims.create_index("status")
    await _db.claims.create_index("submitted_at")
    await _db.audit_logs.create_index("timestamp")
    await _db.audit_logs.create_index("claim_id")


async def close_mongo_connection() -> None:
    """Close MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
    _client = None
    _db = None


def get_database() -> AsyncIOMotorDatabase:
    """Get the active database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return _db
