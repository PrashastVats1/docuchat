from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app

client = TestClient(app)


def test_root_returns_ok():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_chat_empty_message_rejected():
    """Empty messages should return 400, not hit OpenAI at all."""
    response = client.post("/chat", json={"message": "  "})
    assert response.status_code == 400


def test_chat_returns_reply():
    """
    Mock the OpenAI call so tests work without a real API key.
    This is the right pattern — tests should never call paid APIs.
    """
    with patch("app.services.openai_service.client.chat.completions.create") as mock_create:
        # Simulate what OpenAI returns
        mock_create.return_value.choices[0].message.content = "Mocked AI reply"

        response = client.post("/chat", json={
            "message": "Hello, what can you do?",
            "context": ""
        })

        assert response.status_code == 200
        assert response.json()["reply"] == "Mocked AI reply"


def test_chat_with_context():
    """Context should be passed through to the AI."""
    with patch("app.services.openai_service.client.chat.completions.create") as mock_create:
        mock_create.return_value.choices[0].message.content = "Based on the document, the answer is X."

        response = client.post("/chat", json={
            "message": "Summarise this for me",
            "context": "This is a sample document about Python."
        })

        assert response.status_code == 200
        assert "document" in response.json()["reply"].lower()