from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from database import get_db
from models import User, AuditLog, UserRole
from schemas import AuditLogResponse
from auth_utils import get_current_user, require_role

router = APIRouter()

@router.get("/users")
async def list_users(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """List all users"""
    users = db.query(User).all()
    
    result = []
    for user in users:
        roles = db.query(UserRole).filter(UserRole.user_id == user.id).all()
        result.append({
            "id": user.id,
            "phone": user.phone,
            "email": user.email,
            "phone_verified": user.phone_verified,
            "email_verified": user.email_verified,
            "roles": [r.role.value for r in roles],
            "created_at": user.created_at
        })
    
    return result

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = 100,
    current_user: User = Depends(require_role(["admin", "hospital_manager"])),
    db: Session = Depends(get_db)
):
    """Get audit logs"""
    logs = db.query(AuditLog).order_by(
        AuditLog.timestamp.desc()
    ).limit(limit).all()
    
    return logs

@router.post("/users/{user_id}/roles")
async def assign_role(
    user_id: UUID,
    role: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """Assign role to user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if role already exists
    existing = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role == role
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has this role"
        )
    
    user_role = UserRole(user_id=user_id, role=role)
    db.add(user_role)
    db.commit()
    
    return {"message": f"Role {role} assigned to user"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """Delete user"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}
