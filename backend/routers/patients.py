from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from database import get_db
from models import User, Patient, RoleEnum
from schemas import PatientCreate, PatientResponse
from auth_utils import get_current_user, require_role
router = APIRouter()

@router.post("/", response_model=PatientResponse)
async def create_patient(
    patient_data: PatientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create patient profile (for current user)"""
    # Check if patient profile already exists
    existing = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient profile already exists"
        )
    
    # Generate medical ID
    medical_id = f"PT-{datetime.utcnow().year}-{str(uuid.uuid4())[:8].upper()}"
    
    patient = Patient(
        user_id=current_user.id,
        medical_id=medical_id,
        **patient_data.dict()
    )
    
    db.add(patient)
    db.commit()
    db.refresh(patient)
    
    return patient

@router.get("/me", response_model=PatientResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's patient profile"""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found"
        )
    return patient

@router.get("/search")
async def search_patients(
    q: str,
    current_user: User = Depends(require_role(["doctor", "hospital_manager", "admin"])),
    db: Session = Depends(get_db)
):
    """Search patients by name or medical ID"""
    patients = db.query(Patient).filter(
        (Patient.first_name.ilike(f"%{q}%")) |
        (Patient.last_name.ilike(f"%{q}%")) |
        (Patient.medical_id.ilike(f"%{q}%"))
    ).limit(20).all()
    
    return patients

@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    current_user: User = Depends(require_role(["doctor", "hospital_manager", "admin"])),
    db: Session = Depends(get_db)
):
    """Get patient by ID"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    return patient
