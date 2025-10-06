"""
PDF Processing Service for extracting text from medical records
"""
import io
from typing import Optional
from pypdf import PdfReader
import httpx


async def extract_text_from_pdf_url(url: str) -> Optional[str]:
    """Extract text from a PDF URL"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            
            pdf_bytes = io.BytesIO(response.content)
            reader = PdfReader(pdf_bytes)
            
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            
            return "\n".join(text_parts)
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return None


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> Optional[str]:
    """Extract text from PDF bytes"""
    try:
        pdf_io = io.BytesIO(pdf_bytes)
        reader = PdfReader(pdf_io)
        
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        
        return "\n".join(text_parts)
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return None


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks for embedding"""
    if not text:
        return []
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at a sentence boundary
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            
            if break_point > chunk_size // 2:
                chunk = text[start:start + break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    return [c for c in chunks if c]

# Ashmit contribution
