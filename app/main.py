from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.services.openai_service import chat
from app.services.document_service import extract_text_from_pdf, chunk_text

app = FastAPI(
    title="DocuChat",
    description="Chat with your documents and resumes using AI",
    version="0.3.0"
)

# In-memory store — holds the last uploaded document text
# (simple for now; in production you'd use a database or session)
document_store: dict[str, str] = {}


# ── Models ────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    doc_id: str = ""    # optional — reference a previously uploaded doc


class ChatResponse(BaseModel):
    reply: str


class UploadResponse(BaseModel):
    doc_id: str
    filename: str
    char_count: int
    preview: str        # first 200 chars so user can confirm it parsed correctly


# ── Endpoints ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "DocuChat is running!", "status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/upload/pdf", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF — returns a doc_id to use in /chat."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = extract_text_from_pdf(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Use filename as doc_id (simple, works fine for learning)
    doc_id = file.filename
    document_store[doc_id] = chunk_text(text)

    return UploadResponse(
        doc_id=doc_id,
        filename=file.filename,
        char_count=len(text),
        preview=text[:200]
    )


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    Chat with optional document context.
    - No doc_id: general AI chat
    - With doc_id: AI answers based on the uploaded document
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Look up document context if a doc_id was provided
    context = ""
    if request.doc_id:
        if request.doc_id not in document_store:
            raise HTTPException(
                status_code=404,
                detail=f"Document '{request.doc_id}' not found. Please upload it first."
            )
        context = document_store[request.doc_id]

    reply = chat(user_message=request.message, context=context)
    return ChatResponse(reply=reply)