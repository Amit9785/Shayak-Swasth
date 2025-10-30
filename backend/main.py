from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn
import logging

from database import engine, Base, get_db
from routers import auth, patients, records, admin, manager, ai_search, signup
from models import User, Patient, Record, AuditLog
from auth_utils import get_current_user
from agents.agent_manager import get_agent_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HealthCare Management API - Multi-Agent Architecture",
    description="Enterprise healthcare management platform with multi-agent AI system",
    version="2.0.0"
)

# Initialize agents on startup
@app.on_event("startup")
async def startup_event():
    """Initialize agent manager and all agents"""
    logger = logging.getLogger("main")
    logger.info("Starting HealthCare Management API with Multi-Agent System")
    
    # Initialize agent manager (singleton)
    agent_manager = get_agent_manager()
    logger.info(f"Agent Manager initialized: {agent_manager.name}")
    
    # Log agent status
    status = agent_manager.get_agent_status()
    logger.info(f"Agent Status: {status}")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
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
        "message": "HealthCare Management API - Multi-Agent System",
        "version": "2.0.0",
        "architecture": "Multi-Agent (Data Ingestion, Medical Insights, Query & Compliance)",
        "docs": "/docs",
        "agents_status": "/api/ai/agents/status"
    }

@app.get("/api/health")
async def health_check():
    agent_manager = get_agent_manager()
    return {
        "status": "healthy",
        "database": "connected",
        "agents": agent_manager.get_agent_status()
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
