from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
from database import get_db
from models import User, ManagerActionOTP
from schemas import ManagerOTPRequest, ManagerOTPVerify
from auth_utils import get_current_user, require_role

router = APIRouter()

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

@router.post("/send-otp")
async def send_manager_otp(
    request: ManagerOTPRequest,
    current_user: User = Depends(require_role(["hospital_manager"])),
    db: Session = Depends(get_db)
):
    """Send OTP for sensitive manager action"""
    otp = generate_otp()
    
    # Store OTP
    otp_record = ManagerActionOTP(
        manager_id=current_user.id,
        otp=otp,
        action=request.action,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    
    db.add(otp_record)
    db.commit()
    
    # TODO: Send via Twilio
    # message = twilio_client.messages.create(
    #     body=f"Your verification OTP for {request.action} is: {otp}",
    #     from_=TWILIO_PHONE_NUMBER,
    #     to=current_user.phone
    # )
    
    # For development - return OTP (REMOVE IN PRODUCTION)
    return {"message": "OTP sent successfully", "otp_dev": otp}

@router.post("/verify-otp")
async def verify_manager_otp(
    request: ManagerOTPVerify,
    current_user: User = Depends(require_role(["hospital_manager"])),
    db: Session = Depends(get_db)
):
    """Verify OTP before sensitive action"""
    otp_record = db.query(ManagerActionOTP).filter(
        ManagerActionOTP.manager_id == current_user.id,
        ManagerActionOTP.action == request.action,
        ManagerActionOTP.otp == request.otp,
        ManagerActionOTP.verified == False,
        ManagerActionOTP.expires_at > datetime.utcnow()
    ).first()
    
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Mark as verified
    otp_record.verified = True
    db.commit()
    
    return {
        "message": "OTP verified successfully",
        "verified": True,
        "action": request.action
    }
