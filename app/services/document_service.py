import fitz


def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    if not text.strip():
        raise ValueError("No text found in PDF. It may be a scanned image.")
    return text.strip()


def chunk_text(text: str, max_chars: int = 4000) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[Document truncated for context window...]"
