from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.services.openai_service import chat

app = FastAPI(
    title="DocuChat",
    description="Chat with your documents and resumes using AI",
    version="0.2.0"
)

#--Requests/Response Models--
class ChatRequest(BaseModel):
    message: str
    context: str = ""   #optional - empty until user loads a document
    
class ChatResponse(BaseModel):
    reply: str

#--Endpoints--
@app.get("/")
def root():
    return {"message": "DocuChat is running!", "status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Send a message and get an AI response"""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    reply = chat(
        user_message=request.message,
        context=request.context
    )
    return ChatResponse(reply=reply)