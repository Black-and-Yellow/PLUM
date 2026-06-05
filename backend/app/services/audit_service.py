"""Audit logging service for claim events."""

from __future__ import annotations
from datetime import datetime
from app.database.mongodb import get_database


async def log_event(
    action: str,
    claim_id: str = "",
    details: dict | None = None,
    actor: str = "system",
) -> None:
    """Write an audit log entry to MongoDB."""
    db = get_database()
    await db.audit_logs.insert_one({
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "claim_id": claim_id,
        "actor": actor,
        "details": details or {},
    })
