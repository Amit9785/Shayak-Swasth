from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn

from database import engine, Base, get_db
from routers import auth, patients, records, admin, manager, ai_search, signup
from models import User, Patient, Record, AuditLog
from auth_utils import get_current_user

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HealthCare Management API",
    description="Enterprise healthcare management platform with role-based access",
    version="1.0.0"
)

# CORS Configuration - UPDATE with your Lovable frontend URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "https://48d689c6-79db-48cb-acef-d00caa6391ba.lovableproject.com",
        # Add your custom domain here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(signup.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])
app.include_router(records.router, prefix="/api/records", tags=["Records"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(manager.router, prefix="/api/manager", tags=["Hospital Manager"])
app.include_router(ai_search.router, prefix="/api/ai", tags=["AI Features"])

@app.get("/")
async def root():
    return {
        "message": "HealthCare Management API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
