"""
Query & Compliance Agent

Handles AI queries using RAG (Retrieval Augmented Generation) and enforces
role-based access control for medical records.
Triggered by: /api/ai/search and /api/ai/ask endpoints
"""

import os
import json
import uuid
import numpy as np
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

try:
    import openai
except ImportError:
    pass

from .base_agent import BaseAgent
from models import (
    Record, RecordText, Embedding, Patient, User, UserRole,
    SharedAccess, RoleEnum
)

class QueryComplianceAgent(BaseAgent):
    """Agent responsible for AI queries with compliance checks"""
    
    def __init__(self):
        super().__init__("QueryComplianceAgent")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            v1 = np.array(vec1)
            v2 = np.array(vec2)
            return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))
        except:
            return 0.0
    
    def check_access_permission(
        self,
        db: Session,
        user_id: uuid.UUID,
        patient_id: uuid.UUID
    ) -> bool:
        """
        Check if user has permission to access patient records
        Rules:
        - Patients can access their own records
        - Doctors can access records shared with them
        - Hospital managers can access all records
        - Admins can access all records
        """
        try:
            # Get user roles
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False
            
            roles = [role.role for role in user.roles]
            
            # Admins and hospital managers have full access
            if RoleEnum.ADMIN in roles or RoleEnum.HOSPITAL_MANAGER in roles:
                return True
            
            # Patients can access their own records
            if RoleEnum.PATIENT in roles:
                patient = db.query(Patient).filter(
                    Patient.user_id == user_id,
                    Patient.id == patient_id
                ).first()
                if patient:
                    return True
            
            # Doctors can access shared records
            if RoleEnum.DOCTOR in roles:
                # Check if any record of this patient is shared with the doctor
                shared = db.query(SharedAccess).join(Record).filter(
                    Record.patient_id == patient_id,
                    SharedAccess.doctor_id == user_id
                ).first()
                if shared:
                    return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Access check failed: {str(e)}")
            return False
    
    def get_accessible_records(
        self,
        db: Session,
        user_id: uuid.UUID
    ) -> List[uuid.UUID]:
        """Get list of record IDs the user can access"""
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return []
            
            roles = [role.role for role in user.roles]
            
            # Admins and hospital managers can access all records
            if RoleEnum.ADMIN in roles or RoleEnum.HOSPITAL_MANAGER in roles:
                records = db.query(Record.id).all()
                return [r.id for r in records]
            
            record_ids = []
            
            # Patient's own records
            if RoleEnum.PATIENT in roles:
                patient = db.query(Patient).filter(Patient.user_id == user_id).first()
                if patient:
                    records = db.query(Record.id).filter(Record.patient_id == patient.id).all()
                    record_ids.extend([r.id for r in records])
            
            # Doctor's shared records
            if RoleEnum.DOCTOR in roles:
                shared_records = db.query(Record.id).join(SharedAccess).filter(
                    SharedAccess.doctor_id == user_id
                ).all()
                record_ids.extend([r.id for r in shared_records])
            
            return list(set(record_ids))  # Remove duplicates
            
        except Exception as e:
            self.logger.error(f"Failed to get accessible records: {str(e)}")
            return []
    
    def generate_query_embedding(self, query: str) -> Optional[List[float]]:
        """Generate embedding for search query"""
        if not self.openai_api_key:
            self.logger.warning("OpenAI API key not configured")
            return None
        
        try:
            response = openai.Embedding.create(
                model="text-embedding-ada-002",
                input=query
            )
            return response['data'][0]['embedding']
        except Exception as e:
            self.logger.error(f"Query embedding failed: {str(e)}")
            return None
    
    def semantic_search(
        self,
        db: Session,
        user_id: uuid.UUID,
        query: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Perform semantic search across accessible medical records
        1. Check user access permissions
        2. Generate query embedding
        3. Search across embeddings
        4. Return top-k results with compliance metadata
        """
        try:
            self.logger.info(f"Semantic search: {query[:50]}...")
            
            # 1. Get accessible record IDs
            accessible_record_ids = self.get_accessible_records(db, user_id)
            
            if not accessible_record_ids:
                return self.success_response(
                    data={"results": [], "total": 0},
                    message="No accessible records found"
                )
            
            # 2. Generate query embedding
            query_embedding = self.generate_query_embedding(query)
            if not query_embedding:
                return self.handle_error(
                    Exception("Failed to generate query embedding"),
                    "Embedding generation"
                )
            
            # 3. Get all embeddings from accessible records
            embeddings = db.query(Embedding, RecordText).join(RecordText).filter(
                Embedding.record_id.in_(accessible_record_ids)
            ).all()
            
            # 4. Calculate similarities
            results = []
            for embedding_obj, text_obj in embeddings:
                try:
                    doc_embedding = json.loads(embedding_obj.embedding_json)
                    similarity = self.cosine_similarity(query_embedding, doc_embedding)
                    
                    results.append({
                        "record_id": str(embedding_obj.record_id),
                        "text": text_obj.extracted_text[:500],  # Preview
                        "similarity": similarity,
                        "chunk_index": text_obj.chunk_index
                    })
                except Exception as e:
                    self.logger.warning(f"Skipping embedding: {str(e)}")
                    continue
            
            # 5. Sort by similarity and get top-k
            results.sort(key=lambda x: x["similarity"], reverse=True)
            top_results = results[:top_k]
            
            # 6. Add metadata
            for result in top_results:
                record = db.query(Record).filter(
                    Record.id == uuid.UUID(result["record_id"])
                ).first()
                if record:
                    result["title"] = record.title
                    result["file_type"] = record.file_type.value
                    result["upload_date"] = record.upload_date.isoformat()
            
            # 7. Log search action
            self.log_action(
                db=db,
                user_id=user_id,
                action=f"SEMANTIC_SEARCH: {query[:100]}",
                resource="Records",
                resource_id=None
            )
            
            return self.success_response(
                data={
                    "results": top_results,
                    "total": len(results),
                    "query": query
                },
                message=f"Found {len(top_results)} relevant results"
            )
            
        except Exception as e:
            return self.handle_error(e, "Semantic search")
    
    def ask_question(
        self,
        db: Session,
        user_id: uuid.UUID,
        record_id: uuid.UUID,
        question: str
    ) -> Dict[str, Any]:
        """
        Ask questions about a specific medical record using RAG
        1. Check access permission
        2. Retrieve record context
        3. Generate answer using GPT
        """
        try:
            # 1. Check access permission
            record = db.query(Record).filter(Record.id == record_id).first()
            if not record:
                return self.handle_error(
                    Exception("Record not found"),
                    "Record lookup"
                )
            
            if not self.check_access_permission(db, user_id, record.patient_id):
                return self.handle_error(
                    Exception("Access denied"),
                    "Permission check"
                )
            
            # 2. Get record text
            texts = db.query(RecordText).filter(
                RecordText.record_id == record_id
            ).order_by(RecordText.chunk_index).all()
            
            if not texts:
                return self.handle_error(
                    Exception("No text content available"),
                    "Content retrieval"
                )
            
            # Combine texts
            full_text = "\n\n".join([t.extracted_text for t in texts])
            context = full_text[:4000]  # Limit context size
            
            # 3. Generate answer using GPT
            if not self.openai_api_key:
                return self.handle_error(
                    Exception("OpenAI API not configured"),
                    "API configuration"
                )
            
            try:
                response = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a medical assistant. Answer questions about the medical document based on the provided context. Be precise and cite relevant information."},
                        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
                    ],
                    max_tokens=500
                )
                
                answer = response['choices'][0]['message']['content']
                
                # 4. Log query
                self.log_action(
                    db=db,
                    user_id=user_id,
                    action=f"ASK_QUESTION: {question[:100]}",
                    resource="Record",
                    resource_id=record_id
                )
                
                return self.success_response(
                    data={
                        "record_id": str(record_id),
                        "question": question,
                        "answer": answer,
                        "record_title": record.title
                    },
                    message="Question answered successfully"
                )
                
            except Exception as e:
                return self.handle_error(e, "GPT answer generation")
            
        except Exception as e:
            return self.handle_error(e, "Question answering")

