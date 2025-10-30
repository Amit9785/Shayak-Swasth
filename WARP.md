# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Shayak-Swasth** is a healthcare management platform built with a **multi-agent AI architecture**. The system uses specialized AI agents for data processing, medical insights extraction, and intelligent querying with compliance checks.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI (Python), PostgreSQL with pgvector, SQLAlchemy
- **AI/ML**: OpenAI (GPT, Embeddings), RAG (Retrieval Augmented Generation)
- **Storage**: AWS S3 for medical records
- **Task Queue**: Celery + Redis (for async processing)
- **Architecture**: Multi-Agent System (3 specialized agents)

---

## Multi-Agent Architecture

The backend implements a **three-agent system** for intelligent healthcare management:

### 1. **Data Ingestion Agent** (`agents/data_ingestion_agent.py`)
- **Purpose**: Handles file uploads to S3 and metadata storage in PostgreSQL
- **Triggered by**: `POST /api/records/upload`
- **Workflow**:
  1. Validates patient existence
  2. Creates record entry in database
  3. Uploads file to AWS S3
  4. Updates record with S3 URL
  5. Logs action for audit trail
  6. Triggers Medical Insights Agent (async)

### 2. **Medical Insights Agent** (`agents/medical_insights_agent.py`)
- **Purpose**: Extracts text from medical documents and generates embeddings for semantic search
- **Triggered by**: Automatically after file upload (via Celery task)
- **Workflow**:
  1. Downloads file from S3
  2. Extracts text (PDF via PyPDF2, Images via OCR/pytesseract)
  3. Chunks text for processing
  4. Generates embeddings using OpenAI API
  5. Stores embeddings in database
  6. Updates record status to "processed"

### 3. **Query & Compliance Agent** (`agents/query_compliance_agent.py`)
- **Purpose**: Handles AI queries with role-based access control
- **Triggered by**: `POST /api/ai/search` and `POST /api/ai/ask`
- **Features**:
  - Semantic search across medical records using RAG
  - Automatic role-based access control (patients, doctors, admins, managers)
  - Question answering using GPT with context from records
  - Cosine similarity for relevance scoring

### Agent Manager (`agents/agent_manager.py`)
Central coordinator that orchestrates all agents and manages their lifecycle.

---

## Common Development Commands

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start PostgreSQL (Docker)
docker-compose up -d db

# Run FastAPI server
uvicorn main:app --reload --port 8000

# Or use Python directly
python main.py
```

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev  # Runs on http://localhost:8080

# Build for production
npm run build

# Build for development (with source maps)
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Database Commands

```bash
# Connect to PostgreSQL
psql -U postgres -d healthcare_db

# Enable pgvector extension
CREATE EXTENSION vector;

# View tables
\dt

# View agent logs
SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 20;

# Check record processing status
SELECT id, title, status FROM records WHERE status = 'processing';
```

### Celery (Background Tasks)

```bash
# Start Redis (required for Celery)
docker-compose up -d redis

# Start Celery worker
celery -A tasks worker --loglevel=info

# Monitor Celery tasks
celery -A tasks events

# Flower (Celery monitoring UI)
celery -A tasks flower
```

---

## Code Architecture & Patterns

### Backend Structure

```
backend/
├── agents/                      # Multi-agent system
│   ├── base_agent.py           # Shared agent functionality
│   ├── data_ingestion_agent.py # File upload & S3 handling
│   ├── medical_insights_agent.py # Text extraction & embeddings
│   ├── query_compliance_agent.py # RAG queries + access control
│   └── agent_manager.py        # Central orchestrator
├── routers/                     # FastAPI endpoints
│   ├── auth.py                 # Authentication
│   ├── records.py              # Uses Data Ingestion Agent
│   ├── ai_search.py            # Uses Query & Compliance Agent
│   └── ...
├── models.py                    # SQLAlchemy models
├── database.py                  # Database configuration
├── schemas.py                   # Pydantic schemas
├── auth_utils.py               # JWT & role-based auth
├── tasks.py                    # Celery tasks
└── main.py                     # FastAPI app + agent initialization
```

### Frontend Structure

```
src/
├── components/                  # Reusable UI components
│   ├── AIChatPanel.tsx         # AI query interface
│   ├── RecordCard.tsx          # Medical record display
│   └── ui/                     # shadcn/ui components
├── pages/                       # Route pages
│   ├── PatientDashboard.tsx    # Patient view
│   ├── DoctorDashboard.tsx     # Doctor view
│   └── AdminDashboard.tsx      # Admin view
├── lib/
│   ├── api.ts                  # API client (fetch wrapper)
│   └── utils.ts                # Utility functions
└── hooks/                       # Custom React hooks
```

### Key Design Patterns

1. **Agent Pattern**: Each agent is self-contained with logging, error handling, and audit trails
2. **Orchestration Pattern**: AgentManager coordinates multi-agent workflows
3. **Repository Pattern**: Database access abstracted through SQLAlchemy ORM
4. **Role-Based Access Control**: Enforced at both API and agent level
5. **Async Processing**: File processing happens in background via Celery
6. **RAG (Retrieval Augmented Generation)**: Semantic search + GPT for accurate answers

---

## Environment Variables

### Backend (`.env`)

**Required:**
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/healthcare_db
SECRET_KEY=your-super-secret-jwt-key-minimum-32-characters
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=healthcare-records-bucket
AWS_REGION=us-east-1
OPENAI_API_KEY=sk-your-openai-api-key
```

**Optional:**
```bash
REDIS_URL=redis://localhost:6379/0
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
APP_ENV=development
```

### Frontend (`.env`)

```bash
VITE_API_URL=http://localhost:8000
```

---

## Testing

### Backend Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest

# Run with coverage
pytest --cov=agents --cov=routers

# Test specific agent
pytest tests/test_data_ingestion_agent.py
```

### Frontend Tests

```bash
# Not currently configured - add with Vitest/Jest
```

### Manual Testing Workflow

1. **Upload a medical record**: `POST /api/records/upload`
2. **Check processing status**: `GET /api/records/{record_id}`
3. **Query agent status**: `GET /api/ai/agents/status`
4. **Semantic search**: `POST /api/ai/search` with `{"query": "blood pressure"}`
5. **Ask question**: `POST /api/ai/ask` with `{"record_id": "...", "question": "What was my diagnosis?"}`

---

## Deployment

### Development

```bash
# Backend
cd backend
uvicorn main:app --reload --port 8000

# Frontend
npm run dev

# Celery worker
celery -A tasks worker --loglevel=info
```

### Production

See `backend/DEPLOYMENT.md` for detailed deployment instructions for:
- AWS (EC2 + RDS + S3)
- Railway
- Render
- DigitalOcean

**Key considerations:**
- Enable HTTPS/SSL
- Use production-grade secrets
- Configure CORS properly
- Enable rate limiting
- Set up Celery workers with supervisor/systemd
- Use PostgreSQL with pgvector extension
- Configure S3 bucket policies

---

## Troubleshooting

### Agent Not Processing Records

```bash
# Check record status
psql -U postgres -d healthcare_db -c "SELECT id, title, status FROM records WHERE status != 'processed';"

# Manually trigger Medical Insights Agent
curl -X POST http://localhost:8000/api/ai/process/{record_id} \
  -H "Authorization: Bearer {token}"

# Check Celery worker logs
celery -A tasks worker --loglevel=debug
```

### S3 Upload Failures

```bash
# Verify AWS credentials
aws s3 ls s3://your-bucket-name

# Check agent logs
# Look for "DataIngestionAgent" errors in console
```

### OpenAI API Errors

```bash
# Verify API key
echo $OPENAI_API_KEY

# Check API quota/limits at platform.openai.com
# Consider rate limiting in production
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -U postgres -d healthcare_db -c "SELECT 1;"

# Check pgvector extension
psql -U postgres -d healthcare_db -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

---

## Important Notes

### Security
- All medical data uploads are logged in `access_logs` table
- Role-based access is enforced at agent level, not just API level
- S3 pre-signed URLs expire after 1 hour
- Hospital managers require OTP for sensitive operations

### Performance
- Medical Insights Agent processes records asynchronously (doesn't block upload)
- Semantic search uses cosine similarity (consider pgvector for large datasets)
- Text extraction from images requires Tesseract OCR (install separately)

### Limitations
- OCR quality depends on image quality
- OpenAI API has rate limits (monitor usage)
- Celery requires Redis for production (included in docker-compose.yml)

---

## API Endpoints Reference

### Records (Data Ingestion Agent)
- `POST /api/records/upload` - Upload medical record
- `GET /api/records/` - List records (role-filtered)
- `GET /api/records/{id}` - Get specific record
- `DELETE /api/records/{id}` - Delete record (managers only)

### AI Search (Query & Compliance Agent)
- `POST /api/ai/search` - Semantic search across records
- `POST /api/ai/ask` - Ask questions about specific record
- `POST /api/ai/process/{record_id}` - Manually trigger insights processing
- `GET /api/ai/agents/status` - Get agent system status

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/signup` - Patient registration
- `POST /api/auth/send-otp` - Send phone OTP
- `POST /api/auth/verify-otp` - Verify OTP and login

---

## Additional Resources

- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Startup Guide**: `STARTUP.md`
- **Deployment Guide**: `backend/DEPLOYMENT.md`
- **Backend README**: `backend/README.md`

