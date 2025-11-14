# Care Access Pro - System Architecture

## 🏗️ High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CARE ACCESS PRO                                       │
│                        AI-Powered Healthcare Records Management System                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                         ┌─────────────┐
                                         │   USERS     │
                                         └──────┬──────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
            ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
            │   PATIENT     │           │    DOCTOR     │           │   HOSPITAL    │
            │               │           │               │           │   MANAGER     │
            └───────┬───────┘           └───────┬───────┘           └───────┬───────┘
                    │                           │                           │
                    └───────────────────────────┴───────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND LAYER                                         │
│                              React + TypeScript + Vite                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │    │
│  │  │   Auth.tsx   │  │  Patient     │  │   Doctor     │  │  Hospital    │        │    │
│  │  │   Signup.tsx │  │  Dashboard   │  │  Dashboard   │  │  Manager     │        │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  Dashboard   │        │    │
│  │                                                         └──────────────┘        │    │
│  │  ┌────────────────────────────────────────────────────────────────────────┐    │    │
│  │  │                         SHARED COMPONENTS                               │    │    │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │    │    │
│  │  │  │ AIChatPanel │ │ RecordCard  │ │ Appointment │ │ OTPModal    │      │    │    │
│  │  │  │             │ │             │ │ Dialog      │ │             │      │    │    │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │    │    │
│  │  └────────────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                                  │    │
│  │  ┌────────────────────────────────────────────────────────────────────────┐    │    │
│  │  │                            CUSTOM HOOKS                                 │    │    │
│  │  │  useAuth │ usePatient │ useRecords │ useAppointments │ useNotifications │    │    │
│  │  └────────────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                         │                                                │
│                              Port: 8080 │                                                │
└─────────────────────────────────────────┼────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   API GATEWAY                                            │
│                                  Supabase Client                                         │
└─────────────────────────────────────────┬────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│           SUPABASE BACKEND                │   │            AI BACKEND                      │
│                                           │   │         (FastAPI + Python)                 │
│  ┌─────────────────────────────────────┐  │   │                                           │
│  │         AUTHENTICATION              │  │   │  ┌─────────────────────────────────────┐  │
│  │  ┌─────────┐  ┌─────────┐          │  │   │  │         EU AI ACT GUARDRAILS        │  │
│  │  │  Email  │  │   OTP   │          │  │   │  │  ┌─────────────────────────────────┐│  │
│  │  │  Auth   │  │  Verify │          │  │   │  │  │ Input Validation               ││  │
│  │  └─────────┘  └─────────┘          │  │   │  │  │ Output Sanitization            ││  │
│  └─────────────────────────────────────┘  │   │  │  │ Hallucination Prevention       ││  │
│                                           │   │  │  │ Emergency Detection            ││  │
│  ┌─────────────────────────────────────┐  │   │  │  └─────────────────────────────────┘│  │
│  │         EDGE FUNCTIONS              │  │   │  └─────────────────────────────────────┘  │
│  │  ┌───────────┐ ┌───────────┐       │  │   │                                           │
│  │  │ upload-   │ │ search-   │       │  │   │  ┌─────────────────────────────────────┐  │
│  │  │ record    │ │ records   │       │  │   │  │        LANGGRAPH WORKFLOW           │  │
│  │  ├───────────┤ ├───────────┤       │  │   │  │  ┌─────────────────────────────────┐│  │
│  │  │ update-   │ │ verify-   │       │  │   │  │  │    classify_query              ││  │
│  │  │ record    │ │ otp       │       │  │   │  │  │         ↓                       ││  │
│  │  ├───────────┤ ├───────────┤       │  │   │  │  │    retrieve_records (RAG)      ││  │
│  │  │ approve-  │ │ generate- │       │  │   │  │  │         ↓                       ││  │
│  │  │ doctor    │ │ otp       │       │  │   │  │  │    analyze_records             ││  │
│  │  ├───────────┤ ├───────────┤       │  │   │  │  │         ↓                       ││  │
│  │  │ audit-log │ │ send-otp  │       │  │   │  │  │    generate_recommendations    ││  │
│  │  │           │ │ -sms      │       │  │   │  │  │         ↓                       ││  │
│  │  └───────────┘ └───────────┘       │  │   │  │  │    summarize                   ││  │
│  └─────────────────────────────────────┘  │   │  │  └─────────────────────────────────┘│  │
│                                           │   │  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │   │                                           │
│  │         ROW LEVEL SECURITY          │  │   │  ┌─────────────────────────────────────┐  │
│  │  • Patient sees own records only    │  │   │  │           AI SERVICES               │  │
│  │  • Doctor sees assigned patients    │  │   │  │  ┌─────────┐  ┌─────────┐          │  │
│  │  • Manager sees hospital records    │  │   │  │  │ PDF     │  │ Vector  │          │  │
│  │  • Admin has full access            │  │   │  │  │ Process │  │ Store   │          │  │
│  │                                     │  │   │  │  └─────────┘  └─────────┘          │  │
│  └─────────────────────────────────────┘  │   │  │  ┌─────────┐  ┌─────────┐          │  │
│                                           │   │  │  │Embedding│  │ Gemini  │          │  │
│  Port: 54321 (local) / Supabase Cloud    │   │  │  │ Service │  │ 1.5 LLM │          │  │
└───────────────────────────────────────────┘   │  │  └─────────┘  └─────────┘          │  │
                    │                           │  └─────────────────────────────────────┘  │
                    │                           │                                           │
                    │                           │  Port: 8000                               │
                    │                           └───────────────────────────────────────────┘
                    │                                           │
                    ▼                                           ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│         POSTGRESQL DATABASE               │   │            CHROMADB                        │
│              (Supabase)                   │   │         (Vector Database)                  │
│                                           │   │                                           │
│  ┌─────────────────────────────────────┐  │   │  ┌─────────────────────────────────────┐  │
│  │              TABLES                 │  │   │  │         COLLECTIONS                 │  │
│  │  ┌───────────┐  ┌───────────┐      │  │   │  │                                     │  │
│  │  │ profiles  │  │ patients  │      │  │   │  │  ┌─────────────────────────────┐   │  │
│  │  ├───────────┤  ├───────────┤      │  │   │  │  │    medical_records          │   │  │
│  │  │ user_roles│  │ doctors   │      │  │   │  │  │    (embeddings + metadata)  │   │  │
│  │  ├───────────┤  ├───────────┤      │  │   │  │  └─────────────────────────────┘   │  │
│  │  │ records   │  │ hospital_ │      │  │   │  │                                     │  │
│  │  │           │  │ managers  │      │  │   │  │  Embedding Model:                   │  │
│  │  ├───────────┤  ├───────────┤      │  │   │  │  sentence-transformers/             │  │
│  │  │appoint-   │  │ audit_    │      │  │   │  │  all-MiniLM-L6-v2                   │  │
│  │  │ments      │  │ logs      │      │  │   │  │                                     │  │
│  │  └───────────┘  └───────────┘      │  │   │  └─────────────────────────────────────┘  │
│  └─────────────────────────────────────┘  │   │                                           │
│                                           │   │  Storage: ./chroma_db                     │
│  ┌─────────────────────────────────────┐  │   └───────────────────────────────────────────┘
│  │          FILE STORAGE               │  │
│  │  ┌─────────────────────────────┐   │  │
│  │  │   medical-records bucket    │   │  │
│  │  │   (PDFs, Images, Documents) │   │  │
│  │  └─────────────────────────────┘   │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

---

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              PATIENT RECORD UPLOAD FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  Patient                Frontend                  Supabase                AI Backend
    │                       │                         │                        │
    │  1. Upload PDF        │                         │                        │
    ├──────────────────────►│                         │                        │
    │                       │  2. Store File          │                        │
    │                       ├────────────────────────►│                        │
    │                       │                         │  3. Trigger Edge Fn    │
    │                       │                         ├───────────────────────►│
    │                       │                         │                        │
    │                       │                         │  4. Extract Text (PDF) │
    │                       │                         │  ◄─────────────────────┤
    │                       │                         │                        │
    │                       │                         │  5. Generate Embeddings│
    │                       │                         │  ◄─────────────────────┤
    │                       │                         │                        │
    │                       │                         │  6. Store in ChromaDB  │
    │                       │                         │  ◄─────────────────────┤
    │                       │                         │                        │
    │                       │  7. Insert Record       │                        │
    │                       ├────────────────────────►│                        │
    │                       │                         │                        │
    │  8. Success           │                         │                        │
    │◄──────────────────────┤                         │                        │
    │                       │                         │                        │


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              AI CHAT QUERY FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  Patient              Frontend              AI Backend              ChromaDB        Gemini
    │                     │                      │                      │              │
    │  1. Ask Question    │                      │                      │              │
    ├────────────────────►│                      │                      │              │
    │                     │  2. POST /analyze    │                      │              │
    │                     ├─────────────────────►│                      │              │
    │                     │                      │                      │              │
    │                     │                      │  3. Input Guardrails │              │
    │                     │                      ├──────────────────────┤              │
    │                     │                      │                      │              │
    │                     │                      │  4. Classify Query   │              │
    │                     │                      ├─────────────────────────────────────►│
    │                     │                      │◄─────────────────────────────────────┤
    │                     │                      │                      │              │
    │                     │                      │  5. Vector Search    │              │
    │                     │                      ├─────────────────────►│              │
    │                     │                      │  Relevant Records    │              │
    │                     │                      │◄─────────────────────┤              │
    │                     │                      │                      │              │
    │                     │                      │  6. Analyze + Generate│             │
    │                     │                      ├─────────────────────────────────────►│
    │                     │                      │◄─────────────────────────────────────┤
    │                     │                      │                      │              │
    │                     │                      │  7. Output Guardrails│              │
    │                     │                      ├──────────────────────┤              │
    │                     │                      │                      │              │
    │                     │  8. EU AI Act        │                      │              │
    │                     │     Compliant Response                      │              │
    │                     │◄─────────────────────┤                      │              │
    │  9. Display Answer  │                      │                      │              │
    │◄────────────────────┤                      │                      │              │


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           APPOINTMENT BOOKING FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  Patient              Frontend              Supabase             Hospital Manager
    │                     │                      │                        │
    │  1. Select Slot     │                      │                        │
    ├────────────────────►│                      │                        │
    │                     │  2. Insert           │                        │
    │                     │     Appointment      │                        │
    │                     ├─────────────────────►│                        │
    │                     │                      │                        │
    │                     │                      │  3. Notify Manager     │
    │                     │                      ├───────────────────────►│
    │                     │                      │                        │
    │  4. Pending Status  │                      │                        │
    │◄────────────────────┤                      │                        │
    │                     │                      │                        │
    │                     │                      │  5. Approve/Reject     │
    │                     │                      │◄───────────────────────┤
    │                     │                      │                        │
    │  6. Notification    │                      │                        │
    │◄────────────────────┼──────────────────────┤                        │
    │                     │                      │                        │
```

---

## 🏛️ Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND ARCHITECTURE                                     │
│                                   (React + TypeScript)                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

src/
├── main.tsx                      # App entry point
├── App.tsx                       # Root component + routing
│
├── pages/                        # Page components
│   ├── Auth.tsx                  # Login page
│   ├── Signup.tsx               # Signup router
│   ├── SignupPatient.tsx        # Patient registration
│   ├── SignupDoctor.tsx         # Doctor registration  
│   ├── SignupHospitalManager.tsx # Manager registration
│   ├── SignupAdmin.tsx          # Admin registration
│   ├── PatientDashboard.tsx     # Patient main view
│   ├── DoctorDashboard.tsx      # Doctor main view
│   ├── HospitalManagerDashboard.tsx # Manager main view
│   ├── AdminDashboard.tsx       # Admin main view
│   └── Index.tsx                # Landing page
│
├── components/                   # Reusable components
│   ├── AIChatPanel.tsx          # Patient AI chat
│   ├── DoctorAIChatPanel.tsx    # Doctor AI chat
│   ├── RecordCard.tsx           # Medical record display
│   ├── UploadRecordDialog.tsx   # File upload modal
│   ├── UpdateRecordDialog.tsx   # Record edit modal
│   ├── BookAppointmentDialog.tsx # Appointment booking
│   ├── AppointmentsList.tsx     # Appointments view
│   ├── PatientSearch.tsx        # Patient lookup
│   ├── OTPModal.tsx             # OTP verification
│   ├── DoctorOTPModal.tsx       # Doctor OTP
│   ├── DoctorApprovalCard.tsx   # Approval UI
│   ├── NotificationDropdown.tsx # Notifications
│   ├── DashboardHeader.tsx      # Header component
│   └── ui/                      # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       └── ...
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.tsx              # Authentication state
│   ├── usePatient.tsx           # Patient data
│   ├── useRecords.tsx           # Records CRUD
│   ├── useAppointments.tsx      # Appointments
│   └── useNotifications.tsx     # Notifications
│
├── lib/                          # Utilities
│   ├── api.ts                   # API client
│   ├── types.ts                 # TypeScript types
│   └── utils.ts                 # Helper functions
│
└── integrations/
    └── supabase/
        ├── client.ts            # Supabase client
        └── types.ts             # Database types


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              AI BACKEND ARCHITECTURE                                     │
│                                   (FastAPI + Python)                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘

ai-backend/
├── main.py                       # FastAPI application
│   ├── POST /analyze            # AI analysis endpoint
│   ├── POST /process-pdf        # PDF processing
│   └── GET /health              # Health check
│
├── services/
│   ├── langgraph_workflow.py    # LangGraph workflow
│   │   ├── AIGuardrails         # EU AI Act guardrails
│   │   ├── EUAIActCompliance    # Compliance handler
│   │   └── MedicalAnalysisWorkflow
│   │       ├── classify_query()
│   │       ├── retrieve_records()
│   │       ├── analyze_records()
│   │       ├── generate_recommendations()
│   │       └── summarize()
│   │
│   ├── pdf_processor.py         # PDF text extraction
│   ├── embeddings.py            # HuggingFace embeddings
│   └── vector_store.py          # ChromaDB operations
│
├── requirements.txt              # Python dependencies
└── Dockerfile                    # Container config


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE BACKEND ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘

supabase/
├── config.toml                   # Supabase configuration
│
├── functions/                    # Edge Functions (Deno)
│   ├── upload-record/           # Record upload handler
│   ├── update-record/           # Record update handler
│   ├── search-records/          # Record search
│   ├── approve-doctor/          # Doctor approval
│   ├── generate-otp/            # OTP generation
│   ├── verify-otp/              # OTP verification
│   ├── send-otp-sms/            # SMS sending
│   └── audit-log/               # Audit logging
│
└── migrations/                   # Database migrations
    ├── 20251114_initial.sql
    ├── 20251126_roles.sql
    ├── 20251128_records.sql
    ├── 20251129_appointments.sql
    └── 20251205_advanced_appointments.sql
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY LAYERS                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: AUTHENTICATION                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  • Supabase Auth (Email/Password)                                                │    │
│  │  • JWT Token Management                                                          │    │
│  │  • OTP Verification for Sensitive Actions                                        │    │
│  │  • Session Management                                                            │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: AUTHORIZATION (Row Level Security)                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  PATIENT POLICY:                                                                 │    │
│  │    SELECT: WHERE patient_id = auth.uid()                                        │    │
│  │    INSERT: WHERE patient_id = auth.uid()                                        │    │
│  │                                                                                  │    │
│  │  DOCTOR POLICY:                                                                  │    │
│  │    SELECT: WHERE doctor_id IN (assigned_patients) AND approved = true           │    │
│  │                                                                                  │    │
│  │  HOSPITAL MANAGER POLICY:                                                        │    │
│  │    SELECT/UPDATE: WHERE hospital_id = manager.hospital_id                       │    │
│  │                                                                                  │    │
│  │  ADMIN POLICY:                                                                   │    │
│  │    ALL: true (full access)                                                      │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: AI GUARDRAILS (EU AI Act Compliance)                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  INPUT VALIDATION:                                                               │    │
│  │    • Emergency detection → Redirect to 911                                       │    │
│  │    • High-risk keyword flagging                                                  │    │
│  │    • Query sanitization                                                          │    │
│  │                                                                                  │    │
│  │  OUTPUT VALIDATION:                                                              │    │
│  │    • Prohibited content blocking (diagnoses, prescriptions)                      │    │
│  │    • Hallucination detection                                                     │    │
│  │    • Grounding verification                                                      │    │
│  │    • Mandatory disclaimers                                                       │    │
│  │                                                                                  │    │
│  │  AUDIT LOGGING:                                                                  │    │
│  │    • All violations logged                                                       │    │
│  │    • Traceability for Article 12                                                │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: DATA PROTECTION                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  • Encrypted storage (Supabase)                                                  │    │
│  │  • Secure file upload (signed URLs)                                              │    │
│  │  • Soft delete for records                                                       │    │
│  │  • Audit trail for all actions                                                   │    │
│  │  • HIPAA-aligned practices                                                       │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                TECHNOLOGY STACK                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│         FRONTEND             │  │         STYLING              │
├──────────────────────────────┤  ├──────────────────────────────┤
│  • React 18                  │  │  • Tailwind CSS              │
│  • TypeScript                │  │  • shadcn/ui                 │
│  • Vite                      │  │  • Lucide Icons              │
│  • React Router              │  │  • Radix UI Primitives       │
│  • TanStack Query            │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│         BACKEND              │  │         AI/ML                │
├──────────────────────────────┤  ├──────────────────────────────┤
│  • Supabase                  │  │  • LangGraph                 │
│  • PostgreSQL                │  │  • LangChain                 │
│  • Deno (Edge Functions)     │  │  • Google Gemini 1.5 Flash   │
│  • FastAPI (Python)          │  │  • HuggingFace Transformers  │
│  • Docker                    │  │  • ChromaDB                  │
└──────────────────────────────┘  └──────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│       INFRASTRUCTURE         │  │        COMPLIANCE            │
├──────────────────────────────┤  ├──────────────────────────────┤
│  • Supabase Cloud            │  │  • EU AI Act                 │
│  • Docker Compose            │  │  • HIPAA Guidelines          │
│  • Nginx (production)        │  │  • GDPR Principles           │
│  • SSL/TLS                   │  │  • Audit Logging             │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## � Compliance Policies & Standards

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        SUPPORTED POLICIES & COMPLIANCE STANDARDS                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 🇪🇺 EU AI ACT COMPLIANCE (High-Risk Medical AI)

This project is classified as a **High-Risk AI System** under the EU AI Act and implements the following articles:

| Article | Title | Implementation |
|---------|-------|----------------|
| **Article 9** | Risk Management System | • Input validation for dangerous queries<br>• Emergency detection (redirects to 911)<br>• High-risk keyword flagging<br>• Automatic risk assessment |
| **Article 10** | Data & Data Governance | • Only uses verified patient medical records<br>• Data quality validation<br>• Source verification for all AI claims<br>• No synthetic data generation |
| **Article 11** | Technical Documentation | • Full architecture documentation<br>• API documentation<br>• Code comments and docstrings |
| **Article 12** | Record Keeping | • Comprehensive audit logging<br>• All AI interactions logged<br>• Guardrail violations tracked<br>• Timestamps on all actions |
| **Article 13** | Transparency | • AI disclosure at start of responses<br>• Clear AI vs human distinction<br>• Source citations for all claims<br>• Confidence levels displayed |
| **Article 14** | Human Oversight | • Flags cases needing human review<br>• Never replaces medical professionals<br>• Always recommends doctor consultation<br>• Human approval for sensitive actions |
| **Article 15** | Accuracy, Robustness, Cybersecurity | • Anti-hallucination guardrails<br>• Grounding verification<br>• Low temperature LLM settings<br>• Output sanitization |
| **Article 52** | Transparency Obligations | • Mandatory AI disclosure statements<br>• Compliance footer on all responses<br>• Clear labeling of AI-generated content |

---

### 🏥 HIPAA COMPLIANCE (Health Insurance Portability and Accountability Act)

| Rule | Implementation |
|------|----------------|
| **Privacy Rule** | • Patient data only visible to authorized users<br>• Row Level Security (RLS) policies<br>• Role-based access control<br>• Minimum necessary data principle |
| **Security Rule** | • Encrypted data storage (Supabase)<br>• Secure authentication (JWT tokens)<br>• OTP verification for sensitive actions<br>• Audit trails for all access |
| **Breach Notification** | • Audit logging for security events<br>• Violation logging system<br>• Traceability for all data access |

---

### 🇪🇺 GDPR COMPLIANCE (General Data Protection Regulation)

| Principle | Implementation |
|-----------|----------------|
| **Lawfulness, Fairness, Transparency** | • Clear consent during signup<br>• Transparent AI usage disclosure<br>• Fair data processing practices |
| **Purpose Limitation** | • Data used only for healthcare purposes<br>• No unauthorized data sharing<br>• Clear purpose for each data collection |
| **Data Minimization** | • Only collect necessary information<br>• AI only accesses relevant records<br>• Minimal data in AI prompts |
| **Accuracy** | • Data validation on input<br>• Record update capabilities<br>• Error correction mechanisms |
| **Storage Limitation** | • Soft delete for records<br>• Data retention policies<br>• Archival capabilities |
| **Integrity & Confidentiality** | • Encrypted storage<br>• Secure transmission (HTTPS)<br>• Access controls |
| **Accountability** | • Comprehensive audit logs<br>• Data processing records<br>• Compliance documentation |

#### GDPR Data Subject Rights:

| Right | Implementation |
|-------|----------------|
| **Right to Access** | Patients can view all their records |
| **Right to Rectification** | Update/edit record functionality |
| **Right to Erasure** | Soft delete with status='deleted' |
| **Right to Data Portability** | Export records capability |
| **Right to Object** | Opt-out mechanisms available |

---

### 🔐 SECURITY POLICIES

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY POLICY MATRIX                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  AUTHENTICATION POLICIES                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  ✓ Email/Password authentication via Supabase Auth                              │    │
│  │  ✓ JWT token-based session management                                           │    │
│  │  ✓ OTP verification for sensitive operations                                    │    │
│  │  ✓ Session timeout after inactivity                                             │    │
│  │  ✓ Secure password requirements                                                 │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  AUTHORIZATION POLICIES (Row Level Security)                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                                  │    │
│  │  PATIENT ROLE:                                                                   │    │
│  │    ├── Can view own medical records only                                        │    │
│  │    ├── Can upload records to own profile                                        │    │
│  │    ├── Can book appointments                                                    │    │
│  │    ├── Can use AI chat for own records                                          │    │
│  │    └── Cannot access other patients' data                                       │    │
│  │                                                                                  │    │
│  │  DOCTOR ROLE:                                                                    │    │
│  │    ├── Can view assigned patients' records (after OTP)                          │    │
│  │    ├── Can update records for patients                                          │    │
│  │    ├── Can use AI chat for patient analysis                                     │    │
│  │    ├── Must be approved by Hospital Manager                                     │    │
│  │    └── Cannot access unassigned patients                                        │    │
│  │                                                                                  │    │
│  │  HOSPITAL MANAGER ROLE:                                                          │    │
│  │    ├── Can view all records in their hospital                                   │    │
│  │    ├── Can approve/reject doctors                                               │    │
│  │    ├── Can manage appointments                                                  │    │
│  │    ├── Can upload/update/delete hospital records                                │    │
│  │    └── Cannot access other hospitals' data                                      │    │
│  │                                                                                  │    │
│  │  ADMIN ROLE:                                                                     │    │
│  │    ├── Full system access                                                       │    │
│  │    ├── Can manage all users                                                     │    │
│  │    ├── Can view audit logs                                                      │    │
│  │    ├── Can manage hospitals                                                     │    │
│  │    └── System configuration access                                              │    │
│  │                                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DATA PROTECTION POLICIES                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  ✓ All data encrypted at rest (Supabase)                                        │    │
│  │  ✓ TLS/SSL encryption in transit                                                │    │
│  │  ✓ Secure file storage with signed URLs                                         │    │
│  │  ✓ No plaintext sensitive data in logs                                          │    │
│  │  ✓ Soft delete preserves data integrity                                         │    │
│  │  ✓ Backup and recovery procedures                                               │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🤖 AI GUARDRAIL POLICIES

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AI GUARDRAIL POLICIES                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  INPUT VALIDATION POLICIES                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  🚨 EMERGENCY DETECTION:                                                         │   │
│  │     • "heart attack" → Redirect to 911                                          │   │
│  │     • "can't breathe" → Redirect to 911                                         │   │
│  │     • "severe bleeding" → Redirect to 911                                       │   │
│  │     • "unconscious" → Redirect to 911                                           │   │
│  │     • "suicide/self-harm" → Crisis intervention                                 │   │
│  │                                                                                  │   │
│  │  ⚠️ HIGH-RISK FLAGGING:                                                          │   │
│  │     • Cancer, tumor, malignant                                                  │   │
│  │     • Terminal, fatal, life-threatening                                         │   │
│  │     • Emergency, urgent, critical                                               │   │
│  │     → Flags for human oversight                                                 │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  OUTPUT VALIDATION POLICIES                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  🚫 PROHIBITED CONTENT (Auto-blocked):                                           │   │
│  │     • Diagnosis statements ("you have X disease")                               │   │
│  │     • Prescription advice ("take X mg of medication")                           │   │
│  │     • Dangerous advice ("ignore this symptom")                                  │   │
│  │     • Absolute certainty ("100% certain", "guaranteed")                         │   │
│  │     • Treatment orders ("stop taking medication")                               │   │
│  │                                                                                  │   │
│  │  🔍 HALLUCINATION DETECTION:                                                     │   │
│  │     • Generic claims without citations                                          │   │
│  │     • "Studies show" without specific source                                    │   │
│  │     • "Doctors recommend" without record reference                              │   │
│  │     • Information not grounded in patient records                               │   │
│  │                                                                                  │   │
│  │  ✅ REQUIRED ELEMENTS:                                                           │   │
│  │     • AI disclosure statement                                                   │   │
│  │     • Source citations for claims                                               │   │
│  │     • Confidence level indicators                                               │   │
│  │     • Healthcare provider consultation reminder                                 │   │
│  │     • EU AI Act compliance footer                                               │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ANTI-HALLUCINATION POLICIES                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  RULE 1: GROUNDING REQUIREMENT                                                   │   │
│  │     → Every claim must cite a specific source record                            │   │
│  │     → Format: "According to [Record Name, Date]..."                             │   │
│  │                                                                                  │   │
│  │  RULE 2: UNCERTAINTY ACKNOWLEDGMENT                                             │   │
│  │     → Must state when information is not in records                             │   │
│  │     → "This information is not available in your records"                       │   │
│  │                                                                                  │   │
│  │  RULE 3: CONFIDENCE LEVELS                                                       │   │
│  │     → HIGH: Directly stated in records                                          │   │
│  │     → MEDIUM: Logically inferable from records                                  │   │
│  │     → LOW: Limited supporting data                                              │   │
│  │                                                                                  │   │
│  │  RULE 4: NO PREDICTIONS                                                          │   │
│  │     → Cannot predict medical outcomes                                           │   │
│  │     → Cannot suggest unrecorded treatments                                      │   │
│  │                                                                                  │   │
│  │  RULE 5: CONSERVATIVE GENERATION                                                 │   │
│  │     → LLM Temperature: 0.1 (very low)                                           │   │
│  │     → Top-P: 0.8 (nucleus sampling)                                             │   │
│  │     → Top-K: 40 (vocabulary limit)                                              │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 📋 AUDIT POLICY

| Audit Category | What is Logged |
|----------------|----------------|
| **User Actions** | Login, logout, registration, profile updates |
| **Record Operations** | Create, read, update, delete (with before/after) |
| **AI Interactions** | Queries, responses, guardrail violations |
| **Access Control** | Permission checks, OTP verifications |
| **Security Events** | Failed logins, unauthorized access attempts |
| **System Events** | Errors, warnings, configuration changes |

---

### 🏛️ GOVERNANCE POLICIES

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              GOVERNANCE FRAMEWORK                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│   DATA GOVERNANCE         │  │   AI GOVERNANCE           │  │   ACCESS GOVERNANCE       │
├───────────────────────────┤  ├───────────────────────────┤  ├───────────────────────────┤
│ • Data classification     │  │ • Model versioning        │  │ • Role definitions        │
│ • Data lineage tracking   │  │ • Prompt management       │  │ • Permission matrix       │
│ • Quality standards       │  │ • Output monitoring       │  │ • Approval workflows      │
│ • Retention policies      │  │ • Bias detection          │  │ • Access reviews          │
│ • Disposal procedures     │  │ • Performance metrics     │  │ • Segregation of duties   │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
```

---

### 📊 POLICY COMPLIANCE SUMMARY

| Policy/Standard | Status | Coverage |
|-----------------|--------|----------|
| 🇪🇺 EU AI Act | ✅ Compliant | Articles 9, 10, 11, 12, 13, 14, 15, 52 |
| 🏥 HIPAA | ✅ Aligned | Privacy, Security, Breach Notification Rules |
| 🇪🇺 GDPR | ✅ Compliant | All 7 principles + Data Subject Rights |
| 🔐 OAuth 2.0 | ✅ Implemented | JWT-based authentication |
| 📝 Audit Logging | ✅ Implemented | Full traceability |
| 🤖 AI Guardrails | ✅ Implemented | Input/Output validation |
| 🛡️ Data Encryption | ✅ Implemented | At-rest and in-transit |
| 👁️ Human Oversight | ✅ Implemented | Review flags and approvals |

---

## �📊 Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    profiles     │     │   user_roles    │     │    patients     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │────►│ id (PK)         │     │ id (PK)         │
│ email           │     │ user_id (FK)    │◄────│ user_id (FK)    │
│ full_name       │     │ role            │     │ date_of_birth   │
│ phone           │     │ created_at      │     │ gender          │
│ created_at      │     └─────────────────┘     │ blood_group     │
└─────────────────┘                             │ address         │
                                                │ emergency_contact│
                                                └─────────────────┘
                                                        │
                        ┌───────────────────────────────┴───────────────────────────────┐
                        │                               │                               │
                        ▼                               ▼                               ▼
              ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
              │    records      │             │  appointments   │             │   audit_logs    │
              ├─────────────────┤             ├─────────────────┤             ├─────────────────┤
              │ id (PK)         │             │ id (PK)         │             │ id (PK)         │
              │ patient_id (FK) │             │ patient_id (FK) │             │ user_id (FK)    │
              │ title           │             │ doctor_id (FK)  │             │ action          │
              │ file_type       │             │ date            │             │ resource_type   │
              │ file_url        │             │ time_slot       │             │ resource_id     │
              │ file_path       │             │ appointment_type│             │ details         │
              │ hospital_id     │             │ duration_minutes│             │ ip_address      │
              │ status          │             │ status          │             │ created_at      │
              │ created_at      │             │ notes           │             └─────────────────┘
              │ updated_at      │             │ created_at      │
              └─────────────────┘             └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    doctors      │     │hospital_managers│     │ doctor_         │
├─────────────────┤     ├─────────────────┤     │ availability    │
│ id (PK)         │     │ id (PK)         │     ├─────────────────┤
│ user_id (FK)    │     │ user_id (FK)    │     │ id (PK)         │
│ specialization  │     │ hospital_name   │     │ doctor_id (FK)  │
│ license_number  │     │ hospital_id     │     │ day_of_week     │
│ hospital_id     │     │ position        │     │ start_time      │
│ approved        │     │ created_at      │     │ end_time        │
│ approved_by     │     └─────────────────┘     │ is_available    │
│ created_at      │                             └─────────────────┘
└─────────────────┘
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            DEPLOYMENT ARCHITECTURE                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   CLOUDFLARE    │
                              │   (CDN + WAF)   │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   LOAD BALANCER │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
                    ▼                                      ▼
          ┌─────────────────┐                    ┌─────────────────┐
          │  FRONTEND       │                    │  AI BACKEND     │
          │  (Vercel/       │                    │  (Docker/       │
          │   Netlify)      │                    │   Railway)      │
          │                 │                    │                 │
          │  • Static Files │                    │  • FastAPI      │
          │  • React SPA    │                    │  • LangGraph    │
          │  • CDN Cache    │                    │  • ChromaDB     │
          └────────┬────────┘                    └────────┬────────┘
                   │                                      │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │   SUPABASE      │
                            │   (Cloud)       │
                            │                 │
                            │  • PostgreSQL   │
                            │  • Auth         │
                            │  • Storage      │
                            │  • Edge Funcs   │
                            │  • Realtime     │
                            └─────────────────┘
```

---

## 📝 Version Information

| Component | Version |
|-----------|---------|
| React | 18.x |
| TypeScript | 5.x |
| Vite | 5.x |
| Supabase | Latest |
| FastAPI | 0.104+ |
| LangGraph | 0.0.x |
| Gemini | 1.5 Flash |
| ChromaDB | 0.4.x |
| Tailwind CSS | 3.x |

---

**Created**: December 2025  
**Author**: Care Access Pro Team  
**License**: MIT

<!-- Ashmit contribution -->

<!-- Ashmit contribution -->
