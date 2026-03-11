from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app
import io
from unittest.mock import patch, MagicMock

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

def test_upload_non_pdf_rejected():
    """Only PDFs should be accepted."""
    fake_file = io.BytesIO(b"not a pdf")
    response = client.post(
        "/upload/pdf",
        files={"file": ("resume.txt", fake_file, "text/plain")}
    )
    assert response.status_code == 400


def test_upload_empty_file_rejected():
    """Empty files should be rejected."""
    empty_file = io.BytesIO(b"")
    response = client.post(
        "/upload/pdf",
        files={"file": ("empty.pdf", empty_file, "application/pdf")}
    )
    assert response.status_code == 400


def test_upload_valid_pdf():
    """A valid PDF should be parsed and stored."""
    with patch("app.services.document_service.fitz.open") as mock_fitz:
        # Simulate PyMuPDF returning one page of text
        mock_page = MagicMock()
        mock_page.get_text.return_value = "John Doe\nSoftware Engineer\nPython, FastAPI, Docker"
        mock_doc = MagicMock()
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))
        mock_fitz.return_value = mock_doc

        fake_pdf = io.BytesIO(b"%PDF-1.4 fake content")
        response = client.post(
            "/upload/pdf",
            files={"file": ("resume.pdf", fake_pdf, "application/pdf")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["doc_id"] == "resume.pdf"
        assert "Python" in data["preview"]


def test_chat_with_unknown_doc_id():
    """Referencing a doc that was never uploaded should return 404."""
    response = client.post("/chat", json={
        "message": "Summarise this",
        "doc_id": "nonexistent.pdf"
    })
    assert response.status_code == 404