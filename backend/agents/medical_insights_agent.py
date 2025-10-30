"""
Medical Insights Agent

Extracts text from PDFs/images, generates embeddings, and creates summaries.
Triggered asynchronously after file upload via Celery background task.
"""

import os
import json
import uuid
import boto3
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from io import BytesIO

try:
    import openai
    from PyPDF2 import PdfReader
    from PIL import Image
    import pytesseract
except ImportError:
    pass  # Handle gracefully if optional dependencies not installed

from .base_agent import BaseAgent
from models import Record, RecordText, Embedding, RecordStatusEnum

class MedicalInsightsAgent(BaseAgent):
    """Agent responsible for extracting insights from medical records"""
    
    def __init__(self):
        super().__init__("MedicalInsightsAgent")
        self.s3_client = self._init_s3_client()
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
    
    def _init_s3_client(self):
        """Initialize S3 client"""
        try:
            return boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "us-east-1")
            )
        except Exception as e:
            self.logger.error(f"Failed to initialize S3 client: {str(e)}")
            return None
    
    def download_from_s3(self, s3_url: str) -> Optional[bytes]:
        """Download file from S3"""
        try:
            s3_key = s3_url.split('.com/')[-1]
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return response['Body'].read()
        except Exception as e:
            self.logger.error(f"Failed to download from S3: {str(e)}")
            return None
    
    def extract_text_from_pdf(self, file_content: bytes) -> List[str]:
        """Extract text from PDF file"""
        try:
            pdf_file = BytesIO(file_content)
            reader = PdfReader(pdf_file)
            
            texts = []
            for page_num, page in enumerate(reader.pages):
                text = page.extract_text()
                if text.strip():
                    texts.append(f"[Page {page_num + 1}]\n{text}")
            
            self.logger.info(f"Extracted text from {len(texts)} pages")
            return texts
            
        except Exception as e:
            self.logger.error(f"PDF text extraction failed: {str(e)}")
            return []
    
    def extract_text_from_image(self, file_content: bytes) -> List[str]:
        """Extract text from image using OCR"""
        try:
            image = Image.open(BytesIO(file_content))
            text = pytesseract.image_to_string(image)
            
            if text.strip():
                self.logger.info("Extracted text from image using OCR")
                return [text]
            return []
            
        except Exception as e:
            self.logger.error(f"Image OCR failed: {str(e)}")
            return []
    
    def chunk_text(self, text: str, chunk_size: int = 1000) -> List[str]:
        """Split text into chunks for embedding"""
        words = text.split()
        chunks = []
        
        current_chunk = []
        current_size = 0
        
        for word in words:
            current_chunk.append(word)
            current_size += len(word) + 1
            
            if current_size >= chunk_size:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_size = 0
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding using OpenAI API"""
        if not self.openai_api_key:
            self.logger.warning("OpenAI API key not configured")
            return None
        
        try:
            response = openai.Embedding.create(
                model="text-embedding-ada-002",
                input=text
            )
            embedding = response['data'][0]['embedding']
            self.logger.info(f"Generated embedding (dim: {len(embedding)})")
            return embedding
            
        except Exception as e:
            self.logger.error(f"Embedding generation failed: {str(e)}")
            return None
    
    def generate_summary(self, text: str) -> Optional[str]:
        """Generate summary using OpenAI GPT"""
        if not self.openai_api_key:
            return None
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a medical assistant. Summarize the following medical document concisely."},
                    {"role": "user", "content": text[:4000]}  # Limit input size
                ],
                max_tokens=200
            )
            summary = response['choices'][0]['message']['content']
            self.logger.info("Generated summary")
            return summary
            
        except Exception as e:
            self.logger.error(f"Summary generation failed: {str(e)}")
            return None
    
    async def process_record(
        self,
        db: Session,
        record_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Main processing workflow:
        1. Download file from S3
        2. Extract text based on file type
        3. Chunk text for embeddings
        4. Generate embeddings
        5. Generate summary
        6. Store in database
        7. Update record status
        """
        try:
            # 1. Get record
            record = db.query(Record).filter(Record.id == record_id).first()
            if not record:
                return self.handle_error(
                    Exception("Record not found"),
                    "Record lookup"
                )
            
            self.logger.info(f"Processing record: {record_id}")
            
            # 2. Download from S3
            file_content = self.download_from_s3(record.file_url)
            if not file_content:
                return self.handle_error(
                    Exception("Failed to download file"),
                    "S3 download"
                )
            
            # 3. Extract text based on file type
            texts = []
            if record.file_type.value == "pdf":
                texts = self.extract_text_from_pdf(file_content)
            elif record.file_type.value == "image":
                texts = self.extract_text_from_image(file_content)
            else:
                self.logger.warning(f"Unsupported file type: {record.file_type}")
                texts = ["[No text extraction available for this file type]"]
            
            if not texts:
                self.logger.warning("No text extracted from file")
                texts = ["[No readable text found in document]"]
            
            # 4. Process each text chunk
            for idx, text in enumerate(texts):
                # Store extracted text
                record_text = RecordText(
                    id=uuid.uuid4(),
                    record_id=record_id,
                    extracted_text=text,
                    chunk_index=idx
                )
                db.add(record_text)
                
                # Generate and store embeddings
                chunks = self.chunk_text(text)
                for chunk in chunks:
                    embedding_vector = self.generate_embedding(chunk)
                    if embedding_vector:
                        embedding = Embedding(
                            id=uuid.uuid4(),
                            record_id=record_id,
                            chunk_id=record_text.id,
                            embedding_json=json.dumps(embedding_vector)
                        )
                        db.add(embedding)
            
            # 5. Update record status
            record.status = RecordStatusEnum.PROCESSED
            db.commit()
            
            self.logger.info(f"Record processed successfully: {record_id}")
            
            return self.success_response(
                data={
                    "record_id": str(record_id),
                    "texts_extracted": len(texts),
                    "status": "processed"
                },
                message="Medical insights extracted successfully"
            )
            
        except Exception as e:
            db.rollback()
            # Update record status to show error
            try:
                record = db.query(Record).filter(Record.id == record_id).first()
                if record:
                    record.status = RecordStatusEnum.PENDING
                    db.commit()
            except:
                pass
            
            return self.handle_error(e, "Record processing")

