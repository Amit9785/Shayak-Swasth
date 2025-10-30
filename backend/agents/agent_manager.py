"""
Agent Manager

Central coordinator for all agents in the system. Manages agent
lifecycle, orchestrates workflows, and handles inter-agent communication.
"""

import uuid
from typing import Dict, Any
from sqlalchemy.orm import Session

from .data_ingestion_agent import DataIngestionAgent
from .medical_insights_agent import MedicalInsightsAgent
from .query_compliance_agent import QueryComplianceAgent
from .base_agent import BaseAgent

class AgentManager(BaseAgent):
    """Manages and coordinates all agents in the system"""
    
    def __init__(self):
        super().__init__("AgentManager")
        self.data_ingestion_agent = DataIngestionAgent()
        self.medical_insights_agent = MedicalInsightsAgent()
        self.query_compliance_agent = QueryComplianceAgent()
        
        self.logger.info("Agent Manager initialized with all agents")
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get status of all agents"""
        return {
            "manager": "AgentManager",
            "status": "active",
            "agents": {
                "data_ingestion": {
                    "name": self.data_ingestion_agent.name,
                    "s3_configured": self.data_ingestion_agent.s3_client is not None
                },
                "medical_insights": {
                    "name": self.medical_insights_agent.name,
                    "openai_configured": self.medical_insights_agent.openai_api_key is not None
                },
                "query_compliance": {
                    "name": self.query_compliance_agent.name,
                    "openai_configured": self.query_compliance_agent.openai_api_key is not None
                }
            }
        }
    
    async def orchestrate_record_upload(
        self,
        db: Session,
        file: Any,
        patient_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        ip_address: str = None,
        process_insights: bool = True
    ) -> Dict[str, Any]:
        """
        Orchestrate the complete record upload workflow:
        1. Data Ingestion Agent: Upload to S3 and create DB record
        2. Medical Insights Agent: Extract text and generate embeddings (async)
        """
        self.logger.info(f"Orchestrating record upload for patient: {patient_id}")
        
        # Step 1: Ingest record
        ingestion_result = await self.data_ingestion_agent.ingest_record(
            db=db,
            file=file,
            patient_id=patient_id,
            user_id=user_id,
            title=title,
            ip_address=ip_address
        )
        
        if not ingestion_result.get("success"):
            self.logger.error("Data ingestion failed")
            return ingestion_result
        
        # Step 2: Trigger Medical Insights Agent (async)
        if process_insights and ingestion_result["data"].get("trigger_insights"):
            record_id = uuid.UUID(ingestion_result["data"]["record_id"])
            
            # In production, this should be a Celery task
            # For now, we'll mark it for async processing
            self.logger.info(f"Triggering Medical Insights Agent for record: {record_id}")
            
            # Note: In production, use:
            # from tasks import process_medical_insights
            # process_medical_insights.delay(str(record_id))
            
            # For development/testing, process synchronously:
            try:
                insights_result = await self.medical_insights_agent.process_record(
                    db=db,
                    record_id=record_id
                )
                
                if insights_result.get("success"):
                    self.logger.info("Medical insights processed successfully")
                else:
                    self.logger.warning(f"Insights processing issue: {insights_result.get('error')}")
                    
            except Exception as e:
                self.logger.error(f"Insights processing failed: {str(e)}")
                # Don't fail the entire upload if insights fail
        
        return ingestion_result
    
    async def orchestrate_semantic_search(
        self,
        db: Session,
        user_id: uuid.UUID,
        query: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Orchestrate semantic search with compliance checks"""
        self.logger.info(f"Orchestrating semantic search for user: {user_id}")
        
        return self.query_compliance_agent.semantic_search(
            db=db,
            user_id=user_id,
            query=query,
            top_k=top_k
        )
    
    async def orchestrate_question_answering(
        self,
        db: Session,
        user_id: uuid.UUID,
        record_id: uuid.UUID,
        question: str
    ) -> Dict[str, Any]:
        """Orchestrate question answering with compliance checks"""
        self.logger.info(f"Orchestrating Q&A for record: {record_id}")
        
        return self.query_compliance_agent.ask_question(
            db=db,
            user_id=user_id,
            record_id=record_id,
            question=question
        )


# Singleton instance
_agent_manager = None

def get_agent_manager() -> AgentManager:
    """Get or create the singleton AgentManager instance"""
    global _agent_manager
    if _agent_manager is None:
        _agent_manager = AgentManager()
    return _agent_manager

