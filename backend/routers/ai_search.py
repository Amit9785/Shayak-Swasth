from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from database import get_db
from models import User
from auth_utils import get_current_user
from agents.agent_manager import get_agent_manager

router = APIRouter()

# Request/Response Models
class SearchRequest(BaseModel):
    query: str
    patient_id: Optional[UUID] = None
    top_k: int = 5

class QuestionRequest(BaseModel):
    record_id: UUID
    question: str

@router.post("/process/{record_id}")
async def process_record_insights(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger Medical Insights Agent for a record.
    Normally triggered automatically after upload.
    """
    agent_manager = get_agent_manager()
    
    result = await agent_manager.medical_insights_agent.process_record(
        db=db,
        record_id=record_id
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Processing failed")
        )
    
    return result

@router.post("/search")
async def semantic_search(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Semantic search across accessible medical records using Query & Compliance Agent.
    Enforces role-based access control automatically.
    """
    agent_manager = get_agent_manager()
    
    result = await agent_manager.orchestrate_semantic_search(
        db=db,
        user_id=current_user.id,
        query=request.query,
        top_k=request.top_k
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Search failed")
        )
    
    return result

@router.post("/ask")
async def ask_question(
    request: QuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ask questions about a specific medical record using Query & Compliance Agent.
    Automatically checks access permissions and uses RAG for accurate answers.
    """
    agent_manager = get_agent_manager()
    
    result = await agent_manager.orchestrate_question_answering(
        db=db,
        user_id=current_user.id,
        record_id=request.record_id,
        question=request.question
    )
    
    if not result.get("success"):
        if "Access denied" in result.get("error", ""):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this record"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Question answering failed")
        )
    
    return result

@router.get("/agents/status")
async def get_agents_status(
    current_user: User = Depends(get_current_user)
):
    """Get status of all agents (for debugging/monitoring)"""
    agent_manager = get_agent_manager()
    return agent_manager.get_agent_status()
