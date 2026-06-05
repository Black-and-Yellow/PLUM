"""Policy administration endpoints."""

from fastapi import APIRouter, HTTPException
from app.database.mongodb import get_database
from app.models.policy import PolicyTerms
from app.services import policy_service, audit_service

router = APIRouter()


@router.get("/policies")
async def get_policy():
    """Get current policy terms."""
    db = get_database()
    doc = await db.policies.find_one({}, {"_id": 0})
    if not doc:
        return PolicyTerms().model_dump()
    return doc


@router.put("/policies")
async def update_policy(policy: PolicyTerms):
    """Update policy terms."""
    db = get_database()
    policy_dict = policy.model_dump()

    result = await db.policies.replace_one({}, policy_dict, upsert=True)

    # Update in-memory policy
    policy_service.set_policy(policy)

    await audit_service.log_event("policy_updated", details={"policy_id": policy.policy_id})

    return policy_dict
