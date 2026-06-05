"""API integration tests using httpx."""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """Create a test client with mocked MongoDB."""
    import app.database.mongodb as mongodb
    from unittest.mock import MagicMock

    mock_collection = MagicMock()
    mock_collection.find_one = AsyncMock(return_value=None)
    mock_collection.count_documents = AsyncMock(return_value=0)
    mock_collection.insert_one = AsyncMock(return_value=None)

    mock_cursor = MagicMock()
    mock_collection.find.return_value = mock_cursor
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[])

    mock_db_instance = MagicMock()
    mock_db_instance.claims = mock_collection
    mock_db_instance.policies = mock_collection
    mock_db_instance.audit_logs = mock_collection
    mock_db_instance.command = AsyncMock(return_value={"ok": 1})

    # Set mock _db directly on the module
    old_db = mongodb._db
    mongodb._db = mock_db_instance

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        mongodb._db = old_db



@pytest.mark.anyio
async def test_health_endpoint(client):
    """Test health check returns valid response."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "mongodb" in data
    assert "gemini_configured" in data


@pytest.mark.anyio
async def test_adjudicate_endpoint(client):
    """Test adjudication endpoint with TC001 data."""
    payload = {
        "member_id": "EMP001",
        "member_name": "Rajesh Kumar",
        "member_join_date": "2024-01-01",
        "treatment_date": "2024-11-01",
        "submitted_at": "2024-11-15",
        "claimed_amount": 1500,
        "provider_name": "City Clinic",
        "cashless_request": False,
        "extracted_patient_name": "Rajesh Kumar",
        "extracted_doctor_name": "Dr. Sharma",
        "extracted_doctor_reg": "KA/45678/2015",
        "extracted_diagnosis": "Viral fever",
        "extracted_medicines": ["Paracetamol 650mg", "Vitamin C"],
        "extracted_procedures": [],
        "consultation_amount": 1000,
        "pharmacy_amount": 0,
        "diagnostic_amount": 500,
        "treatment_date_from_doc": "2024-11-01",
        "bill_date_from_doc": "2024-11-01",
        "has_prescription": True,
        "has_bill": True,
        "previous_claims_same_day": 0,
        "ytd_approved_amount": 0,
    }
    response = await client.post("/api/adjudicate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["decision"]["status"] == "APPROVED"
    assert abs(data["decision"]["approved_amount"] - 1350) <= 5


@pytest.mark.anyio
async def test_get_stats_endpoint(client):
    """Test stats endpoint returns valid statistics."""
    response = await client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "stats" in data
    assert "total" in data["stats"]


@pytest.mark.anyio
async def test_list_claims_endpoint(client):
    """Test list claims returns empty list initially."""
    response = await client.get("/api/claims")
    assert response.status_code == 200
    data = response.json()
    assert "claims" in data
    assert isinstance(data["claims"], list)


@pytest.mark.anyio
async def test_get_policy_endpoint(client):
    """Test policy endpoint returns default policy."""
    response = await client.get("/api/policies")
    assert response.status_code == 200
    data = response.json()
    # Should return default policy even when DB is empty
    assert data is not None
