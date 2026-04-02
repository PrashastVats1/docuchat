from unittest.mock import patch
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_returns_ok():
    response = client.get("/")
    assert response.status_code == 200
    assert "DocuChat" in response.text


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_chat_empty_message_rejected():
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 400


def test_chat_returns_reply():
    with patch("app.services.openai_service.client.chat.completions.create") as mock_create:
        mock_create.return_value.choices[0].message.content = "Hello!"
        response = client.post("/chat", json={"message": "Hi there"})
        assert response.status_code == 200
        assert response.json()["reply"] == "Hello!"


def test_chat_with_context():
    from app.main import document_store
    document_store["test-doc"] = "This is a sample document about Python."

    with patch("app.services.openai_service.client.chat.completions.create") as mock_create:
        mock_create.return_value.choices[0].message.content = "Based on the document, the answer is X."

        response = client.post("/chat", json={
            "message": "Summarise this for me",
            "doc_ids": ["test-doc"]
        })

        assert response.status_code == 200
        assert "document" in response.json()["reply"].lower()


def test_upload_non_pdf_rejected():
    response = client.post(
        "/upload/pdf",
        files={"file": ("test.txt", b"hello", "text/plain")}
    )
    assert response.status_code == 400


def test_upload_empty_file_rejected():
    response = client.post(
        "/upload/pdf",
        files={"file": ("empty.pdf", b"", "application/pdf")}
    )
    assert response.status_code == 400


def test_upload_valid_pdf():
    with patch("app.services.document_service.fitz.open") as mock_fitz:
        mock_page = mock_fitz.return_value.__enter__.return_value
        mock_fitz.return_value.close = lambda: None
        mock_fitz.return_value.__iter__ = lambda self: iter([mock_page])
        mock_page.get_text.return_value = "This is extracted text from PDF."

        response = client.post(
            "/upload/pdf",
            files={
                "file": ("test.pdf", b"%PDF-1.4 fake content", "application/pdf")}
        )
        assert response.status_code in [200, 422]


def test_chat_with_unknown_doc_id():
    response = client.post("/chat", json={
        "message": "hello",
        "doc_ids": ["nonexistent.pdf"]
    })
    assert response.status_code == 404


def test_preview_endpoint():
    from app.main import document_store
    document_store["preview-test.pdf"] = "A" * 600

    response = client.get("/preview/preview-test.pdf")
    assert response.status_code == 200
    assert len(response.json()["preview"]) == 500
    assert response.json()["char_count"] == 600
