from fastapi import FastAPI

app = FastAPI(
    title="DocuChat",
    description="Chat with your documents and resumes using AI",
    version="0.1.0"
)


@app.get("/")
def root():
    return {"message": "DocuChat is running!", "status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}