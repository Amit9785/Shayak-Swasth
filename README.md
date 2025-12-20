# Smart Healthcare Record System (Care Access Pro)

🏥 **AI-Powered Healthcare Records Management System**

A comprehensive enterprise healthcare management platform featuring AI-driven medical record analysis, role-based access control, and secure patient data management.



A comprehensive enterprise healthcare management platform featuring AI-driven medical record analysis, role-based access control, and secure patient data management.## How can I edit this code?



---There are several ways of editing your application.



## 🌟 Key Features

**Use your preferred IDE**

### 🔐 **Multi-Role Authentication System**

- **Patient Portal**: Self-service health record managementIf you want to work locally using your own IDE, you can clone this repo and push changes.

- **Doctor Dashboard**: Patient management and AI-assisted diagnosis

- **Hospital Manager**: Facility-wide oversight and approval workflowsThe only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

- **Admin Panel**: System administration and user management

- **OTP Verification**: Secure two-factor authentication via email/SMSFollow these steps:



### 🤖 **AI-Powered Medical Intelligence**```sh

- **RAG-based Medical Analysis**: Retrieval-Augmented Generation using Gemini 1.5# Step 1: Clone the repository using the project's Git URL.

- **LangGraph Workflow**: Multi-step AI reasoning pipelinegit clone <YOUR_GIT_URL>

  - Query classification

  - Record retrieval with vector search# Step 2: Navigate to the project directory.

  - Context-aware analysiscd <YOUR_PROJECT_NAME>

  - Personalized recommendations

- **PDF Medical Record Processing**: Automated extraction and embedding# Step 3: Install the necessary dependencies.

- **Multi-Document Analysis**: Compare and analyze multiple patient recordsnpm i

- **EU AI Act Compliance**: Built-in guardrails for medical AI safety

# Step 4: Start the development server with auto-reloading and an instant preview.

### 📊 **Healthcare Data Management**npm run dev

- **Electronic Health Records (EHR)**: Upload, store, and manage medical documents```

- **Appointment Scheduling**: Integrated booking system

- **Real-time Notifications**: Activity tracking and alerts**Edit a file directly in GitHub**

- **Audit Logging**: Complete activity trail for compliance

- **Secure File Storage**: Encrypted document management- Navigate to the desired file(s).

- Click the "Edit" button (pencil icon) at the top right of the file view.

### 🛡️ **Enterprise Security**- Make your changes and commit the changes.

- **Row-Level Security (RLS)**: Granular data access control

- **Role-Based Access Control (RBAC)**: Patient, Doctor, Manager, Admin roles**Use GitHub Codespaces**

- **JWT Authentication**: Secure token-based sessions

- **Doctor Approval Workflow**: Verified medical professional access- Navigate to the main page of your repository.

- **HIPAA-Ready Architecture**: Privacy-first design patterns- Click on the "Code" button (green button) near the top right.

- Select the "Codespaces" tab.

---- Click on "New codespace" to launch a new Codespace environment.

- Edit files directly within the Codespace and commit and push your changes once you're done.

## 🏗️ Technology Stack

## What technologies are used for this project?

### **Frontend**

- **Framework**: React 18 + TypeScriptThis project is built with:

- **Build Tool**: Vite

- **UI Library**: shadcn/ui (Radix UI primitives)- Vite

- **Styling**: Tailwind CSS- TypeScript

- **State Management**: TanStack Query (React Query)- React

- **Routing**: React Router v6- shadcn-ui

- **Forms**: React Hook Form + Zod validation- Tailwind CSS



### **Backend**## How can I deploy this project?

- **API Framework**: FastAPI (Python)yes

- **Database**: PostgreSQL with Supabase
- **Authentication**: Supabase Auth + Custom JWT
- **ORM**: SQLAlchemy 2.0
- **API Documentation**: Auto-generated OpenAPI/Swagger

### **AI Services**
- **LLM**: Google Gemini 1.5 Pro
- **Orchestration**: LangGraph
- **Vector Database**: ChromaDB
- **Embeddings**: HuggingFace Inference API
- **PDF Processing**: PyPDF

### **Infrastructure**
- **BaaS**: Supabase (Auth, Database, Storage, Edge Functions)
- **Containerization**: Docker + Docker Compose
- **API Gateway**: Supabase Edge Functions
- **File Storage**: Supabase Storage with S3-compatible backend

---

## 📦 Project Structure

```
care-access-pro/
├── src/                          # React frontend
│   ├── components/               # Reusable UI components
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── AIChatPanel.tsx      # AI conversation interface
│   │   ├── DoctorMultiAnalysisPanel.tsx
│   │   ├── RecordCard.tsx       # Medical record display
│   │   └── OTPModal.tsx         # 2FA verification
│   ├── pages/                   # Route components
│   │   ├── Auth.tsx             # Login page
│   │   ├── Signup*.tsx          # Role-specific registration
│   │   ├── PatientDashboard.tsx
│   │   ├── DoctorDashboard.tsx
│   │   ├── HospitalManagerDashboard.tsx
│   │   └── AdminDashboard.tsx
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.tsx
│   │   ├── usePatient.tsx
│   │   ├── useRecords.tsx
│   │   └── useAppointments.tsx
│   └── lib/                     # Utilities
│       ├── api.ts               # API client
│       ├── types.ts             # TypeScript definitions
│       └── utils.ts             # Helper functions
├── backend/                      # FastAPI main backend
│   ├── main.py                  # FastAPI app entry point
│   ├── models.py                # SQLAlchemy models
│   ├── schemas.py               # Pydantic schemas
│   ├── database.py              # DB configuration
│   ├── auth_utils.py            # JWT utilities
│   └── routers/                 # API endpoints
│       ├── auth.py              # Authentication
│       ├── patients.py          # Patient management
│       ├── records.py           # Medical records
│       ├── admin.py             # Admin operations
│       ├── manager.py           # Hospital manager
│       └── ai_search.py         # AI search endpoints
├── ai-backend/                   # AI microservice
│   ├── main.py                  # AI FastAPI app
│   └── services/
│       ├── pdf_processor.py     # Document extraction
│       ├── embeddings.py        # Vector embeddings
│       ├── vector_store.py      # ChromaDB interface
│       └── langgraph_workflow.py # AI workflow
└── supabase/
    ├── functions/               # Edge Functions
    │   ├── upload-record/
    │   ├── approve-doctor/
    │   ├── send-otp-sms/
    │   └── audit-log/
    └── migrations/              # Database migrations
```

---

## 🚀 Getting Started

### **Prerequisites**
- **Node.js** 18+ and npm ([Install with nvm](https://github.com/nvm-sh/nvm))
- **Python** 3.10+
- **PostgreSQL** 14+ (or Supabase account)
- **Docker** (optional, for containerized deployment)

### **Environment Setup**

1. **Clone the repository**
```bash
git clone https://github.com/Amit9785/smart-heatcare-record-system.git
cd smart-heatcare-record-system
```

2. **Frontend Setup**
```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Add your Supabase credentials to .env
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_key

# Start development server
npm run dev
```

3. **Backend Setup**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Configure database connection
# DATABASE_URL=postgresql://user:password@localhost:5432/healthcare
# SECRET_KEY=your_jwt_secret_key

# Initialize database
python -c "from database import init_db; init_db()"

# Run backend server
uvicorn main:app --reload --port 8000
```

4. **AI Backend Setup**
```bash
cd ai-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with API keys
# GOOGLE_API_KEY=your_gemini_api_key
# HUGGINGFACE_API_KEY=your_hf_token

# Run AI service
uvicorn main:app --reload --port 8001
```

### **Docker Deployment**

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🔧 Configuration

### **Supabase Setup**

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run migrations from `supabase/migrations/`
3. Deploy Edge Functions: `supabase functions deploy`
4. Configure Storage buckets for medical records
5. Enable RLS policies for data security

### **API Keys Required**

- **Supabase**: URL and Anon Key (from Supabase dashboard)
- **Google Gemini**: API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **HuggingFace**: Token from [HuggingFace settings](https://huggingface.co/settings/tokens)
- **Twilio** (Optional): For SMS OTP functionality

---

## 📱 User Roles & Capabilities

### **Patient**
- ✅ View personal medical records
- ✅ Upload new health documents
- ✅ Book appointments with doctors
- ✅ Chat with AI for health insights
- ✅ Manage profile and preferences

### **Doctor**
- ✅ View assigned patient records
- ✅ Multi-patient analysis with AI
- ✅ Upload/update patient records
- ✅ Appointment management
- ✅ AI-assisted diagnosis recommendations

### **Hospital Manager**
- ✅ Approve new doctor registrations
- ✅ Hospital-wide record access
- ✅ Analytics and reporting
- ✅ Manage facility resources
- ✅ Audit log monitoring

### **Admin**
- ✅ Full system access
- ✅ User management (create, update, delete)
- ✅ Role assignments
- ✅ System configuration
- ✅ Complete audit trail access

---

## 🧪 API Documentation

Once the backend is running, access:

- **Main API Docs**: http://localhost:8000/docs
- **AI Service Docs**: http://localhost:8001/docs

### **Key Endpoints**

```
POST   /api/auth/signup              # User registration
POST   /api/auth/send-otp            # Send OTP for login
POST   /api/auth/verify-otp          # Verify OTP and login
GET    /api/patients/me              # Get current patient info
POST   /api/records/upload           # Upload medical record
GET    /api/records/                 # List user records
POST   /api/ai/search                # AI-powered record search
POST   /api/ai/analyze               # Multi-record analysis
GET    /api/admin/users              # List all users (admin)
POST   /api/manager/approve-doctor   # Approve doctor (manager)
```

---

## 🎨 UI Components

Built with **shadcn/ui** for consistent, accessible design:

- **Accordion**, **Alert Dialog**, **Avatar**
- **Button**, **Card**, **Checkbox**, **Dialog**
- **Dropdown Menu**, **Form**, **Input**, **Label**
- **Popover**, **Progress**, **Radio Group**
- **Select**, **Separator**, **Slider**, **Switch**
- **Table**, **Tabs**, **Toast**, **Tooltip**

All components are fully customizable via Tailwind CSS.

---

## 🔒 Security Features

- **JWT Token Authentication**: Secure stateless sessions
- **Password Hashing**: bcrypt with salt
- **SQL Injection Protection**: Parameterized queries via SQLAlchemy
- **XSS Prevention**: Input sanitization and output encoding
- **CORS Configuration**: Controlled cross-origin requests
- **Rate Limiting**: API throttling (via Supabase)
- **Audit Logging**: Complete activity tracking
- **Role-Based Policies**: Supabase RLS enforcement

---

## 📊 Database Schema

### **Core Tables**
- `users` - User accounts and authentication
- `patients` - Patient demographic information
- `doctors` - Doctor profiles and credentials
- `records` - Medical records and documents
- `appointments` - Scheduling data
- `audit_logs` - System activity tracking
- `notifications` - User alerts and messages

### **Relationships**
- Users (1) → (*) Patients
- Doctors (1) → (*) Patients (assignments)
- Patients (1) → (*) Records
- Records (*) → (1) Vector Embeddings

---

## 🤖 AI Workflow

```
User Query → LangGraph Workflow
   ↓
1. Query Classification
   ├─ Health Query
   ├─ Record Search
   └─ General Medical Info
   ↓
2. Retrieval (if needed)
   ├─ Vector Search in ChromaDB
   └─ Fetch Relevant Records
   ↓
3. Context Assembly
   ├─ User History
   ├─ Retrieved Records
   └─ Domain Knowledge
   ↓
4. Gemini 1.5 Analysis
   ├─ Medical Reasoning
   ├─ Risk Assessment
   └─ Recommendations
   ↓
5. EU AI Act Guardrails
   ├─ Disclaimer Injection
   ├─ Emergency Detection
   └─ Hallucination Check
   ↓
6. Response to User
```

---

## 🧪 Testing

```bash
# Frontend tests
npm run test

# Backend tests
cd backend
pytest

# AI service tests
cd ai-backend
pytest tests/
```

---

## 📝 License

This project is licensed under the **MIT License**.

---

## 👥 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Support

For issues and questions:
- **GitHub Issues**: [Create an issue](https://github.com/Amit9785/smart-heatcare-record-system/issues)
- **Email**: support@healthcaresystem.com

---

## 🙏 Acknowledgments

- **shadcn/ui** - Beautiful, accessible UI components
- **Supabase** - Backend infrastructure
- **Google Gemini** - AI language model
- **LangGraph** - AI workflow orchestration
- **Radix UI** - Unstyled component primitives
- **Tailwind CSS** - Utility-first styling

---

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Telemedicine video calls
- [ ] Prescription management
- [ ] Lab report integration
- [ ] Multi-language support
- [ ] FHIR compliance
- [ ] Insurance claim processing
- [ ] Wearable device integration

---

<div align="center">

**Built with ❤️ for better healthcare access**

[Live Demo](https://48d689c6-79db-48cb-acef-d00caa6391ba.lovableproject.com) • [Documentation](./ARCHITECTURE.md) • [Report Bug](https://github.com/Amit9785/smart-heatcare-record-system/issues)

</div>
