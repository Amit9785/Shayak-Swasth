from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import random
import os
from datetime import datetime, timedelta

from database import get_db
from models import User, UserRole, RoleEnum
from schemas import PhoneOTPRequest, OTPVerifyRequest, EmailLoginRequest, TokenResponse, UserResponse
from auth_utils import get_password_hash, verify_password, create_access_token, get_user_roles
# from twilio.rest import Client  # Uncomment when using Twilio
router = APIRouter()

# Temporary OTP storage (use Redis in production)
otp_store = {}

# Twilio Configuration (uncomment when ready)
# TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
# TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
# TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
# twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

@router.post("/send-otp")
async def send_otp(request: PhoneOTPRequest, db: Session = Depends(get_db)):
    """Send OTP to phone number"""
    otp = generate_otp()
    
    # Store OTP with expiration (5 minutes)
    otp_store[request.phone] = {
        "otp": otp,
        "expires": datetime.utcnow() + timedelta(minutes=5)
    }
    
    # TODO: Send via Twilio
    # message = twilio_client.messages.create(
    #     body=f"Your HealthCare Portal OTP is: {otp}",
    #     from_=TWILIO_PHONE_NUMBER,
    #     to=request.phone
    # )
    
    # For development - return OTP (REMOVE IN PRODUCTION)
    return {"message": "OTP sent successfully", "otp_dev": otp}

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerifyRequest, db: Session = Depends(get_db)):
    """Verify OTP and create/login user"""
    stored_otp = otp_store.get(request.phone)
    
    if not stored_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found or expired"
        )
    
    if stored_otp["expires"] < datetime.utcnow():
        del otp_store[request.phone]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired"
        )
    
    if stored_otp["otp"] != request.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP"
        )
    
    # Remove used OTP
    del otp_store[request.phone]
    
    # Find or create user
    user = db.query(User).filter(User.phone == request.phone).first()
    
    if not user:
        user = User(phone=request.phone, phone_verified=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Assign default role (patient)
        user_role = UserRole(user_id=user.id, role=RoleEnum.PATIENT)
        db.add(user_role)
        db.commit()
    else:
        user.phone_verified = True
        db.commit()
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # Get user roles
    roles = get_user_roles(user, db)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "email": user.email,
            "phone_verified": user.phone_verified,
            "email_verified": user.email_verified,
            "roles": roles
        }
    }

@router.post("/login", response_model=TokenResponse)
async def login(request: EmailLoginRequest, db: Session = Depends(get_db)):
    """Email/Password login"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # Get user roles
    roles = get_user_roles(user, db)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "email": user.email,
            "phone_verified": user.phone_verified,
            "email_verified": user.email_verified,
            "roles": roles
        }
    }

@router.post("/logout")
async def logout():
    """Logout (client should delete token)"""
    return {"message": "Logged out successfully"}
