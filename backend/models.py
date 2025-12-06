from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from database import Base

class RoleEnum(str, enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    HOSPITAL_MANAGER = "hospital_manager"
    ADMIN = "admin"

class RecordStatusEnum(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"

class FileTypeEnum(str, enum.Enum):
    PDF = "pdf"
    IMAGE = "image"
    REPORT = "report"
    DICOM = "dicom"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")

class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    
    user = relationship("User", back_populates="roles")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    medical_id = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(DateTime, nullable=False)
    gender = Column(String, nullable=False)
    blood_type = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="patient_profile")
    records = relationship("Record", back_populates="patient", cascade="all, delete-orphan")

class Record(Base):
    __tablename__ = "records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    file_type = Column(Enum(FileTypeEnum), nullable=False)
    file_url = Column(String, nullable=False)  # S3 URL
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(RecordStatusEnum), default=RecordStatusEnum.PENDING)
    
    patient = relationship("Patient", back_populates="records")
    texts = relationship("RecordText", back_populates="record", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="record", cascade="all, delete-orphan")
    shared_access = relationship("SharedAccess", back_populates="record", cascade="all, delete-orphan")

class RecordText(Base):
    __tablename__ = "record_texts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("records.id", ondelete="CASCADE"), nullable=False)
    extracted_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    record = relationship("Record", back_populates="texts")

class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("records.id", ondelete="CASCADE"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("record_texts.id", ondelete="CASCADE"), nullable=True)
    # For pgvector: vector = Column(Vector(1536))  # Requires pgvector extension
    embedding_json = Column(Text, nullable=False)  # JSON string of embedding array
    created_at = Column(DateTime, default=datetime.utcnow)
    
    record = relationship("Record", back_populates="embeddings")

class SharedAccess(Base):
    __tablename__ = "shared_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("records.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    record = relationship("Record", back_populates="shared_access")

class AuditLog(Base):
    __tablename__ = "access_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    
    user = relationship("User", back_populates="audit_logs")

class ManagerActionOTP(Base):
    __tablename__ = "manager_action_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    otp = Column(String, nullable=False)
    action = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    verified = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
