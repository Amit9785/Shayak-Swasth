from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import openai
import json
import numpy as np
from database import get_db
from models import User, Record, RecordText, Embedding
from schemas import SearchRequest, SearchResult
from auth_utils import get_current_user

router = APIRouter()

# OpenAI Configuration
openai.api_key = os.getenv("OPENAI_API_KEY")

@router.post("/embed")
async def create_embeddings(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate embeddings for a record (called after OCR/text extraction)"""
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found"
        )
    
    # Get extracted texts
    texts = db.query(RecordText).filter(RecordText.record_id == record_id).all()
    
    if not texts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text extracted from record"
        )
    
    # Generate embeddings
    for text_chunk in texts:
        response = openai.Embedding.create(
            model="text-embedding-3-small",
            input=text_chunk.extracted_text
        )
        
        embedding_vector = response['data'][0]['embedding']
        
        # Store embedding
        embedding = Embedding(
            record_id=record_id,
            chunk_id=text_chunk.id,
            embedding_json=json.dumps(embedding_vector)
        )
        db.add(embedding)
    
    db.commit()
    
    return {"message": "Embeddings created successfully", "count": len(texts)}

@router.post("/search", response_model=List[SearchResult])
async def semantic_search(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Semantic search across medical records"""
    # Generate query embedding
    response = openai.Embedding.create(
        model="text-embedding-3-small",
        input=request.query
    )
    query_embedding = np.array(response['data'][0]['embedding'])
    
    # Get all embeddings (in production, use pgvector for efficient similarity search)
    embeddings = db.query(Embedding).all()
    
    results = []
    for emb in embeddings:
        emb_vector = np.array(json.loads(emb.embedding_json))
        
        # Calculate cosine similarity
        similarity = np.dot(query_embedding, emb_vector) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(emb_vector)
        )
        
        if similarity > 0.7:  # Threshold
            record = db.query(Record).filter(Record.id == emb.record_id).first()
            if record and (not request.patient_id or record.patient_id == request.patient_id):
                chunk = db.query(RecordText).filter(RecordText.id == emb.chunk_id).first()
                
                results.append({
                    "record_id": record.id,
                    "title": record.title,
                    "relevance_score": float(similarity),
                    "excerpt": chunk.extracted_text[:200] if chunk else ""
                })
    
    # Sort by relevance
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    
    return results[:10]  # Top 10 results

@router.post("/ask")
async def ask_report(
    record_id: UUID,
    question: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions about a specific report using AI"""
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found"
        )
    
    # Get all text from record
    texts = db.query(RecordText).filter(RecordText.record_id == record_id).all()
    full_text = "\n".join([t.extracted_text for t in texts])
    
    if not full_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text available from this record"
        )
    
    # Generate response using OpenAI
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a medical assistant helping patients understand their medical reports. Provide clear, accurate information but remind users to consult their doctor for medical advice."
            },
            {
                "role": "user",
                "content": f"Based on this medical report:\n\n{full_text}\n\nQuestion: {question}"
            }
        ],
        temperature=0.7,
        max_tokens=500
    )
    
    answer = response.choices[0].message.content
    
    return {
        "question": question,
        "answer": answer,
        "record_title": record.title
    }
