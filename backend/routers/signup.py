from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from uuid import uuid4
from database import get_db
from models import User, UserRole, RoleEnum, Patient
from schemas import TokenResponse
from auth_utils import get_password_hash, create_access_token

router = APIRouter()

class PatientSignupData(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    blood_type: Optional[str] = None
    emergency_contact: Optional[str] = None
    address: Optional[str] = None

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone: str = Field(..., min_length=10, max_length=15)
    patient: PatientSignupData

@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Create new patient account with all information"""
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if phone already exists
    existing_phone = db.query(User).filter(User.phone == request.phone).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    try:
        # Create user account
        user = User(
            email=request.email,
            phone=request.phone,
            password_hash=get_password_hash(request.password),
            email_verified=False,
            phone_verified=False
        )
        db.add(user)
        db.flush()
        
        # Assign patient role
        user_role = UserRole(user_id=user.id, role=RoleEnum.PATIENT)
        db.add(user_role)
        db.flush()
        
        # Generate medical ID
        medical_id = f"MED{str(uuid4())[:8].upper()}"
        
        # Parse date of birth
        try:
            dob = datetime.fromisoformat(request.patient.date_of_birth.replace('Z', '+00:00'))
        except ValueError:
            dob = datetime.strptime(request.patient.date_of_birth, '%Y-%m-%d')
        
        # Create patient profile
        patient = Patient(
            user_id=user.id,
            medical_id=medical_id,
            first_name=request.patient.first_name,
            last_name=request.patient.last_name,
            date_of_birth=dob,
            gender=request.patient.gender,
            blood_type=request.patient.blood_type,
            emergency_contact=request.patient.emergency_contact,
            address=request.patient.address
        )
        db.add(patient)
        db.commit()
        db.refresh(user)
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "phone": user.phone,
                "email": user.email,
                "phone_verified": user.phone_verified,
                "email_verified": user.email_verified,
                "roles": [RoleEnum.PATIENT.value]
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(e)}"
        )
