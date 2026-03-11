import fitz # PyMuPDF
import httpx
from bs4 import BeautifulSoup

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF given its raw bytes."""
    doc = fitz.open(stream = file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    if not text.strip():
        raise ValueError("No text found in PDF. It may be a scanned image")
    
    return text.strip()

def chunk_text(text: str, max_chars: int = 4000) -> str:
    """
    Truncate text to max_chars for the OpenAI context window.
    Later we will make this smarted - for now, first chunk is enough
    """
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[Document truncated for context window...]"