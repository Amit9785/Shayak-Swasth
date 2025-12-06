"""
FastAPI AI Backend for Medical Record Analysis
Lightweight version using Gemini API and HuggingFace Inference API
"""
import os
import io
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
import httpx
import chromadb
from pypdf import PdfReader

# Load environment variables
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Global variables
chroma_client = None
collection = None
gemini_model = None


async def extract_pdf_text_from_url(url: str) -> str:
    """Download PDF from URL and extract text"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            
            pdf_reader = PdfReader(io.BytesIO(response.content))
            text_parts = []
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            return "\n\n".join(text_parts)
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""


def extract_pdf_text_from_bytes(file_bytes: bytes) -> str:
    """Extract text from PDF bytes"""
    try:
        pdf_reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n\n".join(text_parts)
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""


async def get_embeddings_async(texts: List[str]) -> List[List[float]]:
    """Get embeddings using HuggingFace Inference API - Feature Extraction"""
    api_key = os.getenv("HUGGINGFACE_API_KEY")
    if not api_key:
        raise ValueError("HUGGINGFACE_API_KEY not set")
    
    # Use the inference API for feature extraction
    url = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url, 
                headers=headers, 
                json={"inputs": texts}, 
                timeout=60.0
            )
            if response.status_code == 503:
                # Model is loading, wait and retry
                import asyncio
                await asyncio.sleep(10)
                response = await client.post(
                    url, 
                    headers=headers, 
                    json={"inputs": texts}, 
                    timeout=60.0
                )
            response.raise_for_status()
            result = response.json()
            # Handle different response formats - API might return nested arrays
            if isinstance(result, list) and len(result) > 0:
                if isinstance(result[0], list) and isinstance(result[0][0], list):
                    # Response is [[[embedding]], ...] - extract innermost
                    return [r[0] for r in result]
                elif isinstance(result[0], list):
                    # Response is [[embedding], ...] - use directly
                    return result
            return result
        except Exception as e:
            print(f"HuggingFace API error: {e}")
            # Return a simple fallback embedding (just for testing)
            return [[0.0] * 384 for _ in texts]


def initialize_services():
    """Initialize AI services"""
    global chroma_client, collection, gemini_model
    
    try:
        # Initialize ChromaDB
        chroma_api_key = os.getenv("CHROMA_API_KEY")
        chroma_tenant = os.getenv("CHROMA_TENANT")
        chroma_database = os.getenv("CHROMA_DATABASE")
        
        if chroma_api_key and chroma_tenant and chroma_database:
            print(f"🔗 Connecting to ChromaDB Cloud...")
            chroma_client = chromadb.CloudClient(
                api_key=chroma_api_key,
                tenant=chroma_tenant,
                database=chroma_database
            )
        else:
            print("📁 Using local ChromaDB...")
            chroma_client = chromadb.PersistentClient(path="./chroma_db")
        
        collection = chroma_client.get_or_create_collection(
            name="medical_records",
            metadata={"description": "Medical records embeddings"}
        )
        print("✅ ChromaDB initialized!")
        
    except Exception as e:
        print(f"⚠️ ChromaDB error: {e}")
    
    try:
        # Initialize Gemini - use the correct model name
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        print("✅ Gemini 1.5 Flash initialized!")
    except Exception as e:
        print(f"⚠️ Gemini error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager"""
    print("🚀 Starting AI Backend...")
    initialize_services()
    print("✅ AI Backend ready!")
    yield
    print("👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Care Access Pro - AI Backend",
    description="AI-powered medical record analysis using Gemini 1.5 and HuggingFace",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Models ============

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    patient_id: str
    chat_history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    success: bool
    response: str
    analysis_type: Optional[str] = None
    records_used: Optional[int] = 0
    error: Optional[str] = None


class EmbedRecordRequest(BaseModel):
    record_id: str
    patient_id: str
    title: str
    file_url: str
    file_type: str
    content: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    patient_id: Optional[str] = None
    limit: int = 5


# ============ Endpoints ============

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "chromadb": collection is not None,
            "gemini": gemini_model is not None
        }
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with medical AI using Gemini 1.5"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Gemini not initialized")
    
    try:
        # Search for relevant records
        context = ""
        records_used = 0
        
        if collection:
            try:
                # Get query embedding
                query_embedding = await get_embeddings_async([request.query])
                
                # Search ChromaDB
                results = collection.query(
                    query_embeddings=query_embedding,
                    n_results=5,
                    where={"patient_id": request.patient_id} if request.patient_id else None
                )
                
                if results and results['documents']:
                    records_used = len(results['documents'][0])
                    context_parts = []
                    for i, doc in enumerate(results['documents'][0]):
                        metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                        context_parts.append(f"Record {i+1} ({metadata.get('title', 'Unknown')}): {doc[:500]}...")
                    context = "\n\n".join(context_parts)
            except Exception as e:
                print(f"Search error: {e}")
        
        # Build prompt
        system_prompt = """You are an expert medical AI assistant helping patients understand their health records.

IMPORTANT GUIDELINES:
1. Be accurate, empathetic, and professional
2. Do NOT diagnose conditions - only provide information
3. Always recommend consulting with healthcare providers
4. Be clear and use simple language when possible
5. If records are available, reference them in your response"""

        if context:
            system_prompt += f"\n\nPATIENT'S MEDICAL RECORDS:\n{context}"
        
        # Build chat history
        chat_text = ""
        for msg in request.chat_history[-5:]:  # Last 5 messages
            role = "User" if msg.role == "user" else "Assistant"
            chat_text += f"{role}: {msg.content}\n"
        
        full_prompt = f"{system_prompt}\n\nConversation:\n{chat_text}\nUser: {request.query}\n\nAssistant:"
        
        # Generate response
        response = gemini_model.generate_content(full_prompt)
        
        return ChatResponse(
            success=True,
            response=response.text,
            records_used=records_used
        )
        
    except Exception as e:
        return ChatResponse(
            success=False,
            response=f"I apologize, but I encountered an error: {str(e)}",
            error=str(e)
        )


@app.post("/embed-record")
async def embed_record(request: EmbedRecordRequest):
    """Embed a medical record for RAG - extracts PDF content automatically"""
    if not collection:
        raise HTTPException(status_code=503, detail="ChromaDB not initialized")
    
    try:
        content = request.content
        
        # If no content provided and it's a PDF, extract from URL
        if not content and request.file_type.lower() == 'pdf' and request.file_url:
            print(f"📄 Extracting PDF content from: {request.file_url}")
            content = await extract_pdf_text_from_url(request.file_url)
            if content:
                print(f"✅ Extracted {len(content)} characters from PDF")
            else:
                print("⚠️ No text extracted from PDF")
        
        # Fallback to title if no content
        if not content:
            content = f"Medical Record: {request.title}"
        
        # Truncate very long content (embedding models have limits)
        if len(content) > 10000:
            content = content[:10000] + "... [truncated]"
        
        # Get embedding from HuggingFace
        embeddings = await get_embeddings_async([content])
        
        # Check if record already exists and delete it first
        try:
            collection.delete(ids=[request.record_id])
        except:
            pass  # Record didn't exist, that's fine
        
        # Add to ChromaDB
        collection.add(
            ids=[request.record_id],
            embeddings=embeddings,
            documents=[content],
            metadatas=[{
                "patient_id": request.patient_id,
                "title": request.title,
                "file_type": request.file_type,
                "file_url": request.file_url
            }]
        )
        
        return {"success": True, "message": "Record embedded successfully", "content_length": len(content)}
        
    except Exception as e:
        print(f"Embed error: {e}")
        return {"success": False, "message": str(e)}


@app.post("/search")
async def search_records(request: SearchRequest):
    """Search embedded medical records"""
    if not collection:
        raise HTTPException(status_code=503, detail="ChromaDB not initialized")
    
    try:
        # Get query embedding
        query_embedding = await get_embeddings_async([request.query])
        
        # Search ChromaDB
        where_filter = {"patient_id": request.patient_id} if request.patient_id else None
        
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=request.limit,
            where=where_filter
        )
        
        formatted_results = []
        if results and results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                formatted_results.append({
                    "id": results['ids'][0][i] if results['ids'] else None,
                    "content": doc,
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results.get('distances') else None
                })
        
        return {"success": True, "results": formatted_results}
        
    except Exception as e:
        return {"success": False, "results": [], "error": str(e)}


@app.post("/simple-chat")
async def simple_chat(request: ChatRequest):
    """Simple chat without RAG (fallback)"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Gemini not initialized")
    
    try:
        prompt = f"""You are a helpful medical AI assistant. Answer the following question helpfully but always remind users to consult healthcare providers.

Question: {request.query}

Answer:"""
        
        response = gemini_model.generate_content(prompt)
        return {"success": True, "response": response.text}
        
    except Exception as e:
        return {"success": False, "response": str(e)}


class SummarizeRequest(BaseModel):
    file_url: str
    title: Optional[str] = None
    patient_id: Optional[str] = None


@app.post("/summarize-pdf")
async def summarize_pdf(request: SummarizeRequest):
    """Summarize a PDF medical report in simple, human-friendly language"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Extract PDF content
        print(f"📄 Extracting PDF for summarization: {request.file_url}")
        content = await extract_pdf_text_from_url(request.file_url)
        
        if not content:
            return {
                "success": False, 
                "summary": "Could not read this report. The file might be a scanned image or protected."
            }
        
        print(f"✅ Extracted {len(content)} characters, generating summary...")
        
        # Truncate very long content
        if len(content) > 30000:
            content = content[:30000] + "... [document truncated for processing]"
        
        # Generate summary with Gemini using patient-friendly prompt
        prompt = f"""You are a friendly health assistant helping a patient understand their medical report. 
Your job is to explain medical reports in SIMPLE, EASY-TO-UNDERSTAND language that anyone can follow.

CRITICAL FORMATTING RULES:
1. DO NOT use any markdown formatting like ** or * or __ or _
2. DO NOT use bold or italic text markers  
3. Use PLAIN TEXT only with clean spacing
4. Use • for bullet points
5. Use CAPS for emphasis (e.g., NORMAL, HIGH, LOW)
6. Keep lines short and easy to read
7. Add blank lines between sections for readability

CONTENT RULES:
1. Use SIMPLE words - avoid medical jargon
2. If you must use a medical term, explain what it means in parentheses
3. Be warm and reassuring, but factual
4. Use short sentences
5. Focus on what the patient needs to know
6. NEVER diagnose or give medical advice

MEDICAL REPORT TO SUMMARIZE:
{content}

Provide a summary using this EXACT clean format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2-3 simple sentences about what this test is and why it matters]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬  KEY FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[For each test result, use this format:]

• [Test Name]: [Value] [Unit]
  ↳ Status: [NORMAL / HIGH / LOW]
  ↳ Meaning: [Simple one-line explanation]

• [Next Test]: [Value] [Unit]
  ↳ Status: [NORMAL / HIGH / LOW]
  ↳ Meaning: [Simple explanation]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊  MEDICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[List medications if any, or write "None mentioned in this report"]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅  NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. [Action item]
2. [Action item]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ATTENTION NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Only if there are concerning values:]
• [Concern and what to do about it]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬  REMINDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please discuss these results with your doctor for personalized advice. 
This summary is for informational purposes only.

IMPORTANT: Use ━ for lines, • for bullets, ↳ for sub-items. NO asterisks or markdown."""
        
        response = gemini_model.generate_content(prompt)
        
        return {
            "success": True,
            "summary": response.text,
            "content_length": len(content),
            "title": request.title
        }
        
    except Exception as e:
        print(f"Summarize error: {e}")
        return {"success": False, "summary": f"Sorry, we couldn't read this report right now. Please try again later."}


@app.post("/analyze-record")
async def analyze_record(
    file: UploadFile = File(...),
    title: str = Form(default="Medical Record"),
    patient_id: str = Form(default="unknown")
):
    """Upload and analyze a medical record directly"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Gemini not initialized")
    
    try:
        file_bytes = await file.read()
        content = ""
        
        # Extract content based on file type
        if file.filename.lower().endswith('.pdf'):
            content = extract_pdf_text_from_bytes(file_bytes)
        else:
            # Try to decode as text
            try:
                content = file_bytes.decode('utf-8')
            except:
                content = f"File: {file.filename} (binary file, cannot extract text)"
        
        if not content:
            return {
                "success": False,
                "analysis": "Could not extract text from the file."
            }
        
        # Truncate if needed
        if len(content) > 30000:
            content = content[:30000] + "... [truncated]"
        
        # Generate analysis
        prompt = f"""Analyze this medical document titled "{title}":

{content}

Provide:
1. Summary of key points
2. Important findings or values
3. Simple patient-friendly explanation

Always advise consulting healthcare providers."""
        
        response = gemini_model.generate_content(prompt)
        
        return {
            "success": True,
            "analysis": response.text,
            "content_length": len(content)
        }
        
    except Exception as e:
        return {"success": False, "analysis": f"Error: {str(e)}"}


# ============ Doctor-Specific Endpoints ============

class DoctorChatRequest(BaseModel):
    query: str
    file_url: str
    title: Optional[str] = None
    patient_id: Optional[str] = None
    chat_history: Optional[List[ChatMessage]] = []


class DoctorRecommendationRequest(BaseModel):
    file_url: str
    title: Optional[str] = None
    patient_id: Optional[str] = None


class MultiPDFAnalysisRequest(BaseModel):
    """Request for analyzing multiple PDFs together"""
    files: List[Dict[str, str]]  # List of {file_url, title}
    patient_id: Optional[str] = None
    analysis_type: str = "comprehensive"  # comprehensive, comparative, timeline


class MultiPDFChatRequest(BaseModel):
    """Chat request for multiple PDFs"""
    query: str
    files: List[Dict[str, str]]  # List of {file_url, title}
    patient_id: Optional[str] = None
    chat_history: Optional[List[ChatMessage]] = []


@app.post("/analyze-multiple-pdfs")
async def analyze_multiple_pdfs(request: MultiPDFAnalysisRequest):
    """Analyze multiple PDF medical reports together for comprehensive insights"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        if not request.files or len(request.files) == 0:
            return {"success": False, "analysis": "No files provided for analysis."}
        
        # Extract content from all PDFs
        all_contents = []
        for i, file_info in enumerate(request.files):
            print(f"📄 Extracting PDF {i+1}/{len(request.files)}: {file_info.get('title', 'Unknown')}")
            content = await extract_pdf_text_from_url(file_info.get('file_url', ''))
            if content:
                all_contents.append({
                    "title": file_info.get('title', f'Report {i+1}'),
                    "content": content[:15000] if len(content) > 15000 else content  # Limit each doc
                })
        
        if not all_contents:
            return {
                "success": False,
                "analysis": "Could not extract content from any of the provided files."
            }
        
        # Build combined document context
        combined_docs = ""
        for i, doc in enumerate(all_contents):
            combined_docs += f"\n{'='*60}\n📋 DOCUMENT {i+1}: {doc['title']}\n{'='*60}\n{doc['content']}\n"
        
        # Choose analysis prompt based on type
        if request.analysis_type == "comparative":
            analysis_prompt = f"""You are an expert medical AI assistant helping a physician perform COMPARATIVE ANALYSIS across multiple patient reports.

CRITICAL FORMATTING RULES:
1. DO NOT use markdown formatting like ** or * or __ or _
2. Use PLAIN TEXT only with clean spacing
3. Use CAPS for emphasis where needed
4. Use • for bullet points, ↳ for sub-items
5. Keep lines short and readable

PATIENT REPORTS:
{combined_docs}

Provide a COMPARATIVE ANALYSIS using this EXACT format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊  COMPARATIVE ANALYSIS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reports Analyzed: {len(all_contents)}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  DOCUMENTS OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[List each document with brief description]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄  PARAMETER COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Compare same parameters across reports in table format]

• [Parameter Name]:
  ↳ Report 1: [Value] - [Status]
  ↳ Report 2: [Value] - [Status]
  ↳ Trend: [IMPROVING / WORSENING / STABLE]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈  TRENDS IDENTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Trend 1]
• [Trend 2]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  AREAS OF CONCERN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Concern with details]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  IMPROVEMENTS NOTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Improvement with details]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  CLINICAL RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. [Recommendation based on trends]
2. [Recommendation]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚕️  DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI-generated comparative analysis for clinical reference only.
The attending physician must exercise independent medical judgment."""

        elif request.analysis_type == "timeline":
            analysis_prompt = f"""You are an expert medical AI assistant helping a physician analyze TIMELINE progression of a patient's health through multiple reports.

CRITICAL FORMATTING RULES:
1. DO NOT use markdown formatting like ** or * or __ or _
2. Use PLAIN TEXT only with clean spacing
3. Use CAPS for emphasis where needed
4. Use • for bullet points, ↳ for sub-items

PATIENT REPORTS (in order):
{combined_docs}

Provide a TIMELINE ANALYSIS using this EXACT format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅  TIMELINE ANALYSIS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reports Analyzed: {len(all_contents)}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐  CHRONOLOGICAL OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[List reports in chronological order with key events]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈  HEALTH PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Track key parameters over time]

• [Parameter]:
  ↳ Earliest: [Value]
  ↳ Latest: [Value]
  ↳ Progression: [IMPROVED / DECLINED / STABLE]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔  KEY EVENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Event 1 with significance]
• [Event 2 with significance]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊  TREATMENT HISTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Medications and treatments mentioned across reports]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊  OVERALL ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Summary of patient's health trajectory]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. [Recommendation]
2. [Recommendation]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚕️  DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI-generated timeline analysis for clinical reference only."""

        else:  # comprehensive (default)
            analysis_prompt = f"""You are an expert medical AI assistant helping a physician analyze multiple patient reports comprehensively.

CRITICAL FORMATTING RULES:
1. DO NOT use markdown formatting like ** or * or __ or _
2. Use PLAIN TEXT only with clean spacing
3. Use CAPS for emphasis where needed
4. Use • for bullet points, ↳ for sub-items

PATIENT REPORTS:
{combined_docs}

Provide a COMPREHENSIVE ANALYSIS using this EXACT format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥  COMPREHENSIVE MULTI-REPORT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reports Analyzed: {len(all_contents)}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  DOCUMENTS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Brief summary of each document]

• Document 1 ({all_contents[0]['title']}):
  ↳ Type: [Report type]
  ↳ Key Focus: [Main findings]

[Continue for all documents]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬  CONSOLIDATED FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[All key findings across all reports]

• [Finding 1]
  ↳ Source: [Document name]
  ↳ Status: NORMAL / ABNORMAL / CRITICAL

• [Finding 2]
  ↳ Source: [Document name]
  ↳ Status: NORMAL / ABNORMAL / CRITICAL


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗  CROSS-REPORT CORRELATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Identify relationships between findings in different reports]

• [Correlation 1]
• [Correlation 2]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  AREAS REQUIRING ATTENTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Priority concern with supporting evidence from reports]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊  MEDICATIONS ACROSS REPORTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[List all medications mentioned, potential interactions]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊  INTEGRATED ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Overall patient health assessment based on all reports]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  CLINICAL RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. [Recommendation with rationale]
2. [Recommendation with rationale]
3. [Recommendation with rationale]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅  SUGGESTED FOLLOW-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Follow-up item with timeline]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚕️  DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI-generated comprehensive analysis for clinical reference only.
The attending physician must exercise independent medical judgment."""

        response = gemini_model.generate_content(analysis_prompt)
        
        return {
            "success": True,
            "analysis": response.text,
            "documents_analyzed": len(all_contents),
            "analysis_type": request.analysis_type
        }
        
    except Exception as e:
        print(f"Multi-PDF analysis error: {e}")
        return {"success": False, "analysis": f"Error during analysis: {str(e)}"}


@app.post("/multi-pdf-chat")
async def multi_pdf_chat(request: MultiPDFChatRequest):
    """Chat with AI about multiple patient reports"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        if not request.files or len(request.files) == 0:
            return {"success": False, "response": "No files provided."}
        
        # Extract content from all PDFs
        all_contents = []
        for i, file_info in enumerate(request.files):
            content = await extract_pdf_text_from_url(file_info.get('file_url', ''))
            if content:
                all_contents.append({
                    "title": file_info.get('title', f'Report {i+1}'),
                    "content": content[:10000] if len(content) > 10000 else content
                })
        
        if not all_contents:
            return {"success": False, "response": "Could not read any of the provided files."}
        
        # Build combined context
        combined_docs = ""
        for i, doc in enumerate(all_contents):
            combined_docs += f"\n--- {doc['title']} ---\n{doc['content']}\n"
        
        # Build chat history
        chat_context = ""
        if request.chat_history:
            for msg in request.chat_history[-4:]:
                role = "Doctor" if msg.role == "user" else "Assistant"
                chat_context += f"{role}: {msg.content}\n"
        
        prompt = f"""You are an expert medical AI assistant helping a doctor analyze MULTIPLE patient reports.
You are speaking to a MEDICAL PROFESSIONAL, so use clinical terminology appropriately.

CRITICAL: DO NOT use markdown formatting (no ** or * symbols). Use CAPS for emphasis.

PATIENT REPORTS ({len(all_contents)} documents):
{combined_docs}

{f"Previous conversation:{chr(10)}{chat_context}" if chat_context else ""}

Doctor's question: {request.query}

Provide a detailed, clinically relevant response referencing the specific reports when applicable.
If comparing across reports, clearly indicate which report you're referencing."""

        response = gemini_model.generate_content(prompt)
        
        return {
            "success": True,
            "response": response.text,
            "documents_used": len(all_contents)
        }
        
    except Exception as e:
        return {"success": False, "response": f"Error: {str(e)}"}


@app.post("/doctor-chat")
async def doctor_chat(request: DoctorChatRequest):
    """AI chat for doctors about a specific patient report"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Extract PDF content
        content = await extract_pdf_text_from_url(request.file_url)
        
        if not content:
            return {
                "success": False,
                "response": "Could not read the report content."
            }
        
        # Truncate if needed
        if len(content) > 20000:
            content = content[:20000] + "... [truncated]"
        
        # Build chat history context
        chat_context = ""
        if request.chat_history:
            for msg in request.chat_history[-4:]:
                role = "Doctor" if msg.role == "user" else "Assistant"
                chat_context += f"{role}: {msg.content}\n"
        
        prompt = f"""You are an expert medical AI assistant helping a doctor analyze a patient's medical report.
You are speaking to a MEDICAL PROFESSIONAL, so you can use clinical terminology appropriately.

PATIENT'S MEDICAL REPORT:
{content}

{f"Previous conversation:{chr(10)}{chat_context}" if chat_context else ""}

Doctor's question: {request.query}

Please provide a detailed, clinically relevant response. Include:
- Direct answers to the doctor's question
- Relevant clinical observations from the report
- Any correlations or patterns you notice
- Potential differential considerations if relevant (as discussion points, not diagnosis)

Remember: This is a clinical discussion aid. The doctor makes all medical decisions."""

        response = gemini_model.generate_content(prompt)
        
        return {
            "success": True,
            "response": response.text
        }
        
    except Exception as e:
        return {"success": False, "response": f"Error: {str(e)}"}


@app.post("/doctor-recommendations")
async def doctor_recommendations(request: DoctorRecommendationRequest):
    """Generate clinical recommendations for doctors based on a patient report"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Extract PDF content
        content = await extract_pdf_text_from_url(request.file_url)
        
        if not content:
            return {
                "success": False,
                "recommendations": "Could not read the report content."
            }
        
        # Truncate if needed
        if len(content) > 25000:
            content = content[:25000] + "... [truncated]"
        
        prompt = f"""You are an expert medical AI assistant providing clinical decision support to a physician.
Analyze the following patient report and provide structured clinical recommendations.

CRITICAL FORMATTING RULES:
1. DO NOT use markdown formatting like ** or * or __ or _
2. Use PLAIN TEXT only with clean spacing
3. Use CAPS for emphasis where needed
4. Use • for bullet points, ↳ for sub-items
5. Keep lines short and readable
6. Add blank lines between sections

MEDICAL REPORT:
{content}

Provide recommendations using this EXACT clean format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬  CLINICAL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Brief clinical summary of the report findings]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  KEY FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Parameter]: [Value]
  ↳ Status: NORMAL / ABNORMAL / CRITICAL
  ↳ Clinical Note: [Brief note]

• [Next Parameter]: [Value]
  ↳ Status: NORMAL / ABNORMAL / CRITICAL
  ↳ Clinical Note: [Brief note]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  SUGGESTED FOLLOW-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. [First recommendation]
2. [Second recommendation]
3. [Third recommendation]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊  TREATMENT CONSIDERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Consideration 1]
• [Consideration 2]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅  MONITORING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Parameter to monitor] - [Timeline]
• [Parameter to monitor] - [Timeline]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗  DIFFERENTIAL CONSIDERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• [Condition to consider]
• [Condition to consider]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝  DOCUMENTATION NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Key points to document]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚕️  DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI-generated suggestions for clinical consideration only. 
The attending physician must exercise independent medical judgment.

IMPORTANT: Use ━ for lines, • for bullets, ↳ for sub-items. NO asterisks."""

        response = gemini_model.generate_content(prompt)
        
        return {
            "success": True,
            "recommendations": response.text
        }
        
    except Exception as e:
        return {"success": False, "recommendations": f"Error: {str(e)}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
