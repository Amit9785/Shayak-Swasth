"""
Data Ingestion Agent

Handles file uploads to S3 and stores metadata in PostgreSQL.
Triggered by: /api/records/upload endpoint
"""

import os
import uuid
import boto3
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import UploadFile

from .base_agent import BaseAgent
from models import Record, Patient, RecordStatusEnum, FileTypeEnum

class DataIngestionAgent(BaseAgent):
    """Agent responsible for ingesting medical records into the system"""
    
    def __init__(self):
        super().__init__("DataIngestionAgent")
        self.s3_client = self._init_s3_client()
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
    
    def _init_s3_client(self):
        """Initialize S3 client with AWS credentials"""
        try:
            return boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "us-east-1")
            )
        except Exception as e:
            self.logger.error(f"Failed to initialize S3 client: {str(e)}")
            return None
    
    def detect_file_type(self, filename: str) -> FileTypeEnum:
        """Detect file type based on extension"""
        extension = filename.lower().split('.')[-1]
        
        if extension == 'pdf':
            return FileTypeEnum.PDF
        elif extension in ['jpg', 'jpeg', 'png', 'tiff', 'bmp']:
            return FileTypeEnum.IMAGE
        elif extension in ['dcm', 'dicom']:
            return FileTypeEnum.DICOM
        else:
            return FileTypeEnum.REPORT
    
    async def upload_to_s3(
        self,
        file: UploadFile,
        patient_id: uuid.UUID,
        record_id: uuid.UUID
    ) -> Optional[str]:
        """Upload file to S3 and return the URL"""
        if not self.s3_client:
            self.logger.error("S3 client not initialized")
            return None
        
        try:
            # Generate unique S3 key
            file_extension = file.filename.split('.')[-1]
            s3_key = f"records/{patient_id}/{record_id}.{file_extension}"
            
            # Read file content
            content = await file.read()
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=content,
                ContentType=file.content_type or 'application/octet-stream',
                Metadata={
                    'patient_id': str(patient_id),
                    'record_id': str(record_id),
                    'original_filename': file.filename
                }
            )
            
            # Generate S3 URL
            s3_url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            
            self.logger.info(f"File uploaded to S3: {s3_key}")
            return s3_url
            
        except Exception as e:
            self.logger.error(f"S3 upload failed: {str(e)}")
            return None
    
    async def ingest_record(
        self,
        db: Session,
        file: UploadFile,
        patient_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main ingestion workflow:
        1. Validate patient exists
        2. Create record entry
        3. Upload file to S3
        4. Update record with S3 URL
        5. Log action
        6. Trigger Medical Insights Agent (async)
        """
        try:
            # 1. Validate patient
            patient = db.query(Patient).filter(Patient.id == patient_id).first()
            if not patient:
                return self.handle_error(
                    Exception("Patient not found"),
                    "Patient validation"
                )
            
            # 2. Detect file type
            file_type = self.detect_file_type(file.filename)
            
            # 3. Create record entry
            record_id = uuid.uuid4()
            record = Record(
                id=record_id,
                patient_id=patient_id,
                title=title,
                file_type=file_type,
                file_url="pending",  # Temporary
                uploaded_by=user_id,
                upload_date=datetime.utcnow(),
                status=RecordStatusEnum.PENDING
            )
            db.add(record)
            db.commit()
            
            self.logger.info(f"Record created: {record_id}")
            
            # 4. Upload to S3
            s3_url = await self.upload_to_s3(file, patient_id, record_id)
            
            if not s3_url:
                record.status = RecordStatusEnum.PENDING
                db.commit()
                return self.handle_error(
                    Exception("S3 upload failed"),
                    "File upload"
                )
            
            # 5. Update record with S3 URL
            record.file_url = s3_url
            record.status = RecordStatusEnum.PROCESSING
            db.commit()
            
            # 6. Log action
            self.log_action(
                db=db,
                user_id=user_id,
                action="UPLOAD_RECORD",
                resource="Record",
                resource_id=record_id,
                ip_address=ip_address
            )
            
            self.logger.info(f"Record ingested successfully: {record_id}")
            
            # Return success with record info
            return self.success_response(
                data={
                    "record_id": str(record_id),
                    "patient_id": str(patient_id),
                    "file_type": file_type.value,
                    "s3_url": s3_url,
                    "status": record.status.value,
                    "trigger_insights": True  # Signal to trigger Medical Insights Agent
                },
                message="Record uploaded successfully. Processing insights..."
            )
            
        except Exception as e:
            db.rollback()
            return self.handle_error(e, "Record ingestion")
    
    def get_record_url(
        self,
        db: Session,
        record_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Optional[str]:
        """Generate pre-signed URL for record download"""
        try:
            record = db.query(Record).filter(Record.id == record_id).first()
            if not record:
                return None
            
            # Extract S3 key from URL
            s3_key = record.file_url.split('.com/')[-1]
            
            # Generate pre-signed URL (valid for 1 hour)
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=3600
            )
            
            self.logger.info(f"Generated presigned URL for record: {record_id}")
            return url
            
        except Exception as e:
            self.logger.error(f"Failed to generate presigned URL: {str(e)}")
            return None

