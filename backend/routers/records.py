from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import os
from datetime import datetime
from database import get_db
from models import User, Record, Patient, AuditLog, FileTypeEnum, RecordStatusEnum
from schemas import RecordCreate, RecordResponse
from auth_utils import get_current_user, require_role, get_user_roles
from agents.agent_manager import get_agent_manager

router = APIRouter()

def log_access(db: Session, user_id: UUID, action: str, resource: str, resource_id: UUID = None):
    """Log access for audit trail"""
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()

@router.post("/upload")
async def upload_record(
    patient_id: UUID,
    title: str,
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload medical record using Data Ingestion Agent.
    Automatically triggers Medical Insights Agent for text extraction and embeddings.
    """
    # Get agent manager
    agent_manager = get_agent_manager()
    
    # Get client IP for audit logging
    ip_address = request.client.host if request else None
    
    # Orchestrate upload through agent manager
    result = await agent_manager.orchestrate_record_upload(
        db=db,
        file=file,
        patient_id=patient_id,
        user_id=current_user.id,
        title=title,
        ip_address=ip_address,
        process_insights=True
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Upload failed")
        )
    
    # Return record data
    record_id = UUID(result["data"]["record_id"])
    record = db.query(Record).filter(Record.id == record_id).first()
    
    return {
        "success": True,
        "message": result.get("message"),
        "record": {
            "id": str(record.id),
            "patient_id": str(record.patient_id),
            "title": record.title,
            "file_type": record.file_type.value,
            "status": record.status.value,
            "upload_date": record.upload_date.isoformat()
        }
    }

@router.get("/", response_model=List[RecordResponse])
async def list_records(
    patient_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List records (filtered by role and patient)"""
    user_roles = get_user_roles(current_user, db)
    
    query = db.query(Record)
    
    if "admin" in user_roles or "hospital_manager" in user_roles:
        # Can see all records
        if patient_id:
            query = query.filter(Record.patient_id == patient_id)
    elif "doctor" in user_roles:
        # Can see shared records
        if patient_id:
            query = query.filter(Record.patient_id == patient_id)
        # TODO: Filter by shared_access
    elif "patient" in user_roles:
        # Can only see own records
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        query = query.filter(Record.patient_id == patient.id)
    
    records = query.order_by(Record.upload_date.desc()).all()
    
    # Log access
    log_access(db, current_user.id, "view_records", "records")
    
    return records

@router.get("/{record_id}", response_model=RecordResponse)
async def get_record(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get single record"""
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found"
        )
    
    # Log access
    log_access(db, current_user.id, "view_record", "record", record.id)
    
    return record

@router.delete("/{record_id}")
async def delete_record(
    record_id: UUID,
    current_user: User = Depends(require_role(["hospital_manager", "admin"])),
    db: Session = Depends(get_db)
):
    """Delete record (requires OTP verification - handled by manager router)"""
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found"
        )
    
    # Use Data Ingestion Agent to handle S3 deletion
    agent_manager = get_agent_manager()
    s3_client = agent_manager.data_ingestion_agent.s3_client
    
    if s3_client:
        try:
            # Delete from S3
            s3_key = record.file_url.split('.com/')[-1]
            s3_client.delete_object(
                Bucket=agent_manager.data_ingestion_agent.bucket_name,
                Key=s3_key
            )
        except Exception as e:
            # Log error but continue with DB deletion
            print(f"S3 deletion failed: {str(e)}")
    
    # Delete from database
    db.delete(record)
    db.commit()
    
    # Log action
    log_access(db, current_user.id, "delete_record", "record", record_id)
    
    return {"message": "Record deleted successfully"}
