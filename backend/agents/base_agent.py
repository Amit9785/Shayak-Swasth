"""
Base Agent Class

Provides shared functionality for all agents including logging,
database access, and error handling.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import AuditLog
import uuid

class BaseAgent:
    """Base class for all agents in the system"""
    
    def __init__(self, name: str):
        self.name = name
        self.logger = self._setup_logger()
    
    def _setup_logger(self) -> logging.Logger:
        """Setup logger for this agent"""
        logger = logging.getLogger(f"agent.{self.name}")
        logger.setLevel(logging.INFO)
        
        # Console handler
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            f'%(asctime)s - {self.name} - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        return logger
    
    def log_action(
        self,
        db: Session,
        user_id: uuid.UUID,
        action: str,
        resource: str,
        resource_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """Log agent action to audit trail"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=f"[{self.name}] {action}",
                resource=resource,
                resource_id=resource_id,
                timestamp=datetime.utcnow(),
                ip_address=ip_address,
                user_agent=user_agent
            )
            db.add(audit_log)
            db.commit()
            self.logger.info(f"Action logged: {action} on {resource}")
        except Exception as e:
            self.logger.error(f"Failed to log action: {str(e)}")
            db.rollback()
    
    def handle_error(self, error: Exception, context: str) -> Dict[str, Any]:
        """Standardized error handling"""
        error_msg = f"{context}: {str(error)}"
        self.logger.error(error_msg)
        return {
            "success": False,
            "error": error_msg,
            "agent": self.name,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def success_response(self, data: Dict[str, Any], message: str = "") -> Dict[str, Any]:
        """Standardized success response"""
        return {
            "success": True,
            "data": data,
            "message": message,
            "agent": self.name,
            "timestamp": datetime.utcnow().isoformat()
        }

