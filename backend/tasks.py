"""
Celery Tasks for Asynchronous Processing

This file defines background tasks for the multi-agent system.
In production, use Celery + Redis for task queue management.
"""

import os
from celery import Celery
from uuid import UUID
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Celery configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL")

# Initialize Celery
celery_app = Celery(
    "healthcare_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

# Database session for tasks
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@celery_app.task(name="process_medical_insights")
def process_medical_insights(record_id: str):
    """
    Background task to process medical insights for a record.
    Triggered after file upload.
    
    Args:
        record_id: UUID string of the record to process
    """
    from agents.agent_manager import get_agent_manager
    import asyncio
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Get agent manager
        agent_manager = get_agent_manager()
        
        # Process record
        result = asyncio.run(
            agent_manager.medical_insights_agent.process_record(
                db=db,
                record_id=UUID(record_id)
            )
        )
        
        return result
        
    except Exception as e:
        print(f"Task failed: {str(e)}")
        return {"success": False, "error": str(e)}
    
    finally:
        db.close()

@celery_app.task(name="batch_process_records")
def batch_process_records(record_ids: list):
    """
    Process multiple records in batch.
    
    Args:
        record_ids: List of record UUID strings
    """
    results = []
    for record_id in record_ids:
        result = process_medical_insights(record_id)
        results.append(result)
    return results

# Example usage in code:
# from tasks import process_medical_insights
# process_medical_insights.delay(str(record_id))

