from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import boto3
import os
from datetime import datetime
from database import get_db
from models import User, Record, Patient, AuditLog, FileTypeEnum, RecordStatusEnum
from schemas import RecordCreate, RecordResponse
from auth_utils import get_current_user, require_role, get_user_roles

router = APIRouter()

# AWS S3 Configuration
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION
)

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

@router.post("/upload", response_model=RecordResponse)
async def upload_record(
    patient_id: UUID,
    title: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload medical record to S3"""
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Determine file type
    file_extension = file.filename.split('.')[-1].lower()
    file_type_map = {
        'pdf': FileTypeEnum.PDF,
        'jpg': FileTypeEnum.IMAGE,
        'jpeg': FileTypeEnum.IMAGE,
        'png': FileTypeEnum.IMAGE,
        'dcm': FileTypeEnum.DICOM
    }
    file_type = file_type_map.get(file_extension, FileTypeEnum.REPORT)
    
    # Upload to S3
    file_key = f"records/{patient_id}/{datetime.utcnow().timestamp()}_{file.filename}"
    s3_client.upload_fileobj(file.file, S3_BUCKET, file_key)
    
    file_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{file_key}"
    
    # Create record
    record = Record(
        patient_id=patient_id,
        title=title,
        file_type=file_type,
        file_url=file_url,
        uploaded_by=current_user.id,
        status=RecordStatusEnum.PENDING
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    # Log action
    log_access(db, current_user.id, "upload_record", "record", record.id)
    
    return record

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
    
    # Delete from S3
    # Extract key from URL
    file_key = record.file_url.split(f"{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/")[1]
    s3_client.delete_object(Bucket=S3_BUCKET, Key=file_key)
    
    # Delete from database
    db.delete(record)
    db.commit()
    
    # Log action
    log_access(db, current_user.id, "delete_record", "record", record_id)
    
    return {"message": "Record deleted successfully"}
