from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Auth Schemas
class PhoneOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str = Field(..., min_length=6, max_length=6)

class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserResponse(BaseModel):
    id: UUID
    phone: Optional[str]
    email: Optional[str]
    phone_verified: bool
    email_verified: bool
    roles: List[str]

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Patient Schemas
class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: datetime
    gender: str
    blood_type: Optional[str]

class PatientResponse(BaseModel):
    id: UUID
    medical_id: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    gender: str
    blood_type: Optional[str]

    class Config:
        from_attributes = True

# Record Schemas
class RecordCreate(BaseModel):
    patient_id: UUID
    title: str
    file_type: str

class RecordResponse(BaseModel):
    id: UUID
    patient_id: UUID
    title: str
    file_type: str
    file_url: str
    uploaded_by: UUID
    upload_date: datetime
    status: str

    class Config:
        from_attributes = True

# Manager OTP Schemas
class ManagerOTPRequest(BaseModel):
    action: str

class ManagerOTPVerify(BaseModel):
    otp: str
    action: str

# AI Search Schemas
class SearchRequest(BaseModel):
    query: str
    patient_id: Optional[UUID] = None

class SearchResult(BaseModel):
    record_id: UUID
    title: str
    relevance_score: float
    excerpt: str

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    action: str
    resource: str
    timestamp: datetime

    class Config:
        from_attributes = True
