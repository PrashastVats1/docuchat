import fitz  # PyMuPDF
import httpx
from bs4 import BeautifulSoup


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF given its raw bytes."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    if not text.strip():
        raise ValueError("No text found in PDF. It may be a scanned image.")

    return text.strip()


def extract_text_from_url(url: str) -> str:
    """
    Fetch a webpage and extract its readable text.
    Strips away HTML tags, scripts, navbars etc.
    """
    try:
        response = httpx.get(
            url,
            timeout=10,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                     }
        )
        response.raise_for_status()
    except httpx.TimeoutException:
        raise ValueError(f"Request timed out fetching: {url}")
    except httpx.HTTPStatusError as e:
        raise ValueError(f"HTTP {e.response.status_code} error fetching: {url}")
    except httpx.RequestError as e:
        raise ValueError(f"Could not reach URL: {url}. Error: {str(e)}")

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove noise — scripts, styles, nav, footer
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Get clean text
    text = soup.get_text(separator="\n")

    # Clean up excessive blank lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    text = "\n".join(lines)

    if not text:
        raise ValueError("No readable text found at that URL.")

    return text


def chunk_text(text: str, max_chars: int = 4000) -> str:
    """
    Truncate text to max_chars for the OpenAI context window.
    Later we'll make this smarter — for now, first chunk is enough.
    """
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[Document truncated for context window...]"