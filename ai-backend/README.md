# Care Access Pro - AI Backend

## Overview

This is the AI-powered backend for the Care Access Pro medical records system. It provides:

- **Gemini 1.5 Flash** for medical analysis and conversation
- **HuggingFace Embeddings** (sentence-transformers/all-MiniLM-L6-v2) for semantic search
- **ChromaDB** for vector storage
- **LangChain** for LLM orchestration
- **LangGraph** for multi-step medical analysis workflows

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 FastAPI AI Backend                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   LangGraph Workflow                     ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ ││
│  │  │ Classify │→ │ Retrieve │→ │ Analyze  │→ │Recommend│ ││
│  │  │  Query   │  │ Records  │  │  (RAG)   │  │         │ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │ HuggingFace     │  │ ChromaDB         │                  │
│  │ Embeddings      │  │ Vector Store     │                  │
│  │ (all-MiniLM)    │  │                  │                  │
│  └─────────────────┘  └──────────────────┘                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 Gemini 1.5 Flash                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Create Virtual Environment

```bash
cd ai-backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional (for Supabase integration)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Model Configuration
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
LLM_MODEL=gemini-1.5-flash

# Vector Store
CHROMA_PERSIST_DIRECTORY=./chroma_db
```

### 4. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key and add it to your `.env` file

### 5. Run the Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```
Returns the status of all services.

### Chat with AI
```
POST /chat
{
  "query": "What does my latest blood test show?",
  "patient_id": "uuid",
  "chat_history": [
    {"role": "user", "content": "previous message"},
    {"role": "assistant", "content": "previous response"}
  ]
}
```

### Embed a Medical Record
```
POST /embed-record
{
  "record_id": "uuid",
  "patient_id": "uuid",
  "title": "Blood Test Results",
  "file_url": "https://...",
  "file_type": "pdf",
  "content": "optional extracted text"
}
```

### Search Records
```
POST /search
{
  "query": "cholesterol levels",
  "patient_id": "uuid",
  "limit": 5
}
```

### Delete Patient Records
```
DELETE /records/{patient_id}
```

## LangGraph Workflow

The medical analysis workflow consists of these steps:

1. **Classify Query**: Determines the type of medical question (DIAGNOSIS, TREATMENT, HISTORY, LIFESTYLE, GENERAL)

2. **Retrieve Records**: Uses RAG to find relevant medical records from the vector store

3. **Analyze Records**: Uses Gemini 1.5 to analyze the retrieved records in context of the query

4. **Generate Recommendations**: Creates actionable health recommendations

5. **Summarize**: Produces a final, patient-friendly response

## Docker Deployment

```bash
# Build the image
docker build -t care-access-ai-backend .

# Run the container
docker run -d \
  -p 8000:8000 \
  -e GOOGLE_API_KEY=your_key \
  -v $(pwd)/chroma_db:/app/chroma_db \
  care-access-ai-backend
```

## Frontend Integration

Add to your frontend `.env`:

```env
VITE_AI_BACKEND_URL=http://localhost:8000
```

The frontend automatically connects to the AI backend for:
- Chat conversations
- Record embedding on upload
- Semantic search

## Security Considerations

- Never expose the AI backend directly to the internet without authentication
- Use HTTPS in production
- Implement rate limiting
- Validate patient_id against authenticated user
- Don't store sensitive medical data in logs

## Troubleshooting

### "Import could not be resolved"
Install dependencies: `pip install -r requirements.txt`

### "Google API Key not set"
Add your Gemini API key to `.env`

### "ChromaDB errors"
Delete the `chroma_db` folder and restart to recreate it

### "CORS errors"
Make sure the frontend URL is allowed in the CORS configuration
