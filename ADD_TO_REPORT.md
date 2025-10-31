# 📝 CONTENT TO ADD IN MAJOR PROJECT REPORT

## Copy these sections directly into your report

---

# 1. EU AI ACT COMPLIANCE

## Add this as a NEW SECTION after "Security & HIPAA Compliance"

---

### EU AI Act Compliance (High-Risk Medical AI System)

The Smart Healthcare System is classified as a **High-Risk AI System** under the European Union Artificial Intelligence Act (EU AI Act, Regulation 2024/1689) because it processes sensitive health data and assists in medical decision-making. The system implements comprehensive compliance measures for the following articles:

#### Article 9 - Risk Management System

The system implements a continuous risk management framework:

| Risk Category | Implementation |
|---------------|----------------|
| Emergency Detection | Automatic detection of life-threatening keywords (heart attack, stroke, suicide) with immediate 911 redirection |
| High-Risk Flagging | Queries containing critical terms (cancer, tumor, terminal) are flagged for human oversight |
| Input Validation | All user queries are validated before AI processing to prevent harmful requests |
| Risk Logging | All detected risks are logged with timestamps for audit purposes |

**Code Implementation:**
```python
HIGH_RISK_KEYWORDS = [
    "emergency", "urgent", "severe", "critical", "life-threatening",
    "suicide", "self-harm", "overdose", "heart attack", "stroke",
    "cancer", "tumor", "malignant", "terminal", "fatal"
]
```

#### Article 10 - Data Governance

The system ensures high-quality data governance:

- **Source Verification**: AI only uses verified patient medical records from the database
- **Data Minimization**: Only relevant records are retrieved for each query
- **Quality Standards**: All uploaded documents undergo validation before storage
- **No Synthetic Data**: The system never generates or uses fabricated medical information

#### Article 13 - Transparency and Provision of Information

Every AI response includes mandatory transparency elements:

1. **AI Disclosure Statement**: Every response begins with:
   ```
   🤖 AI ASSISTANT DISCLOSURE (EU AI Act Article 52)
   I am an artificial intelligence system designed to analyze your medical records.
   My responses are generated based on documented information in your records only.
   I am NOT a replacement for professional medical advice, diagnosis, or treatment.
   ```

2. **Source Citations**: All claims must reference specific records:
   ```
   "According to your Blood Test Report dated 2025-01-15, your glucose level was..."
   ```

3. **Confidence Levels**: Each statement includes confidence indicators:
   - **HIGH**: Directly stated in medical records
   - **MEDIUM**: Logically inferable from documented information
   - **LOW**: Limited supporting data available

4. **Compliance Footer**: Every response ends with:
   ```
   🔒 EU AI Act Compliance Information:
   - AI System Classification: High-Risk Medical AI
   - Records Analyzed: [count]
   - Compliance Standard: EU AI Act Articles 9, 10, 13, 14, 15, 52
   - Timestamp: [datetime]
   ```

#### Article 14 - Human Oversight

The system ensures human professionals remain in control:

| Mechanism | Description |
|-----------|-------------|
| Doctor-Only Recommendations | Treatment suggestions are visible only to verified doctors |
| OTP Verification | Doctors must verify identity via OTP before accessing patient records |
| Hospital Manager Approval | All doctor registrations require manager approval |
| Audit Trail | Every AI interaction is logged for professional review |
| No Autonomous Decisions | AI provides information only; all decisions require human action |

**Human Oversight Triggers:**
- High-risk keywords detected → Flags for medical professional review
- Emergency situations → Redirects to emergency services
- Low confidence responses → Recommends doctor consultation

#### Article 15 - Accuracy, Robustness, and Cybersecurity

The system implements multiple measures to ensure accuracy:

1. **Low Temperature Setting**: LLM temperature set to 0.1 for factual, conservative responses
2. **Grounding Verification**: All AI outputs verified against source documents
3. **Anti-Hallucination Rules**: Strict prompts prevent fabricated information
4. **Output Validation**: Responses checked for prohibited content before delivery

**Accuracy Parameters:**
```python
self.llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0.1,  # Very low for factual accuracy
    top_p=0.8,        # Nucleus sampling for controlled generation
    top_k=40          # Vocabulary limit for consistency
)
```

#### Article 52 - Transparency Obligations for AI Systems

As required for high-risk AI systems interacting with humans:

- **Clear AI Identification**: Users are informed they are interacting with AI at the start of every conversation
- **Capability Disclosure**: System clearly states what it can and cannot do
- **Limitation Acknowledgment**: AI explicitly states when information is unavailable or uncertain
- **Traceability**: Every response includes metadata for verification

---

# 2. AI GUARDRAILS SYSTEM

## Add this as a NEW SECTION after "AI Integration"

---

### AI Guardrails System

The system implements a comprehensive `AIGuardrails` class that enforces safety constraints on all AI interactions, ensuring compliance with EU AI Act requirements and preventing potentially harmful outputs.

#### 2.1 Input Validation Guardrails

Before any query is processed by the AI, it passes through input validation:

**Emergency Detection:**
```python
EMERGENCY_PATTERNS = [
    r"having a heart attack",
    r"can't breathe",
    r"chest pain",
    r"severe bleeding",
    r"unconscious",
    r"seizure right now",
    r"overdosed",
    r"want to kill myself",
    r"going to hurt myself"
]
```

**Response for Emergencies:**
```
🚨 EMERGENCY DETECTED: Please call emergency services (911) immediately.
This AI cannot provide emergency medical assistance.
```

**High-Risk Keyword Flagging:**
| Keyword Category | Examples | Action |
|------------------|----------|--------|
| Life-threatening | emergency, urgent, critical | Flag for human oversight |
| Serious conditions | cancer, tumor, stroke | Requires doctor verification |
| Mental health | suicide, self-harm | Crisis intervention message |

#### 2.2 Output Validation Guardrails

All AI responses are validated before being shown to users:

**Prohibited Content Patterns (Auto-blocked):**

| Category | Blocked Patterns | Reason |
|----------|------------------|--------|
| Diagnostic Claims | "you have [disease]", "I diagnose you with" | AI cannot make diagnoses |
| Prescription Orders | "take [X] mg", "stop taking your medication" | AI cannot prescribe |
| Dangerous Advice | "don't see a doctor", "ignore this symptom" | Could cause harm |
| False Certainty | "100% certain", "guaranteed", "definitely" | Misleading confidence |

**Code Implementation:**
```python
PROHIBITED_PATTERNS = [
    r"you have \w+",
    r"you are suffering from",
    r"i diagnose you with",
    r"take this medication",
    r"stop taking your",
    r"don't see a doctor",
    r"i am 100% certain",
    r"guaranteed to"
]
```

#### 2.3 Hallucination Detection

The system actively detects and prevents AI hallucination:

**Hallucination Indicators (Flagged):**
```python
HALLUCINATION_INDICATORS = [
    r"as everyone knows",
    r"it is well known that",
    r"studies have shown",      # Without specific citation
    r"research indicates",       # Without specific citation
    r"doctors recommend",        # Generic without source
    r"according to medical science"  # Too vague
]
```

**Grounding Verification:**
- Every claim must reference a `[SOURCE X]` from retrieved records
- Claims without sources are flagged as potential hallucinations
- Grounding score calculated: `overlap of response terms with source documents`

#### 2.4 Mandatory Response Elements

Every AI response must include:

| Element | Purpose |
|---------|---------|
| AI Disclosure | Identifies the response as AI-generated |
| Source Citations | Links claims to specific medical records |
| Confidence Level | Indicates certainty (HIGH/MEDIUM/LOW) |
| Information Gaps | States what data was NOT available |
| Disclaimer | Reminds user to consult healthcare providers |
| Compliance Footer | EU AI Act compliance metadata |

#### 2.5 Response Sanitization

If violations are detected, the response is automatically sanitized:

```python
def _sanitize_response(self, response, violations):
    # Add warning header
    warning = "⚠️ GUARDRAIL ALERT: This response has been modified for safety."
    
    # Remove prohibited content
    for violation in violations:
        response = re.sub(violation["pattern"], 
            "[Content removed - please consult healthcare provider]", 
            response)
    
    # Add missing disclaimer
    if missing_disclaimer:
        response += "\n⚕️ Please consult with qualified healthcare professionals."
    
    return warning + response
```

#### 2.6 Violation Logging

All guardrail violations are logged for audit (EU AI Act Article 12):

```python
log_entry = {
    "timestamp": datetime.now().isoformat(),
    "violation_type": violation["type"],
    "severity": violation["severity"],
    "article": violation["article"],
    "query_hash": hash(query),  # Privacy-preserving
    "guardrail_version": "v1.0-EU-AI-Act"
}
```

---

# 3. ROW LEVEL SECURITY (RLS)

## Add this to the "Security & HIPAA Compliance" section

---

### Row Level Security (RLS) Implementation

The system implements PostgreSQL Row Level Security policies through Supabase to ensure data access is strictly controlled at the database level. This provides defense-in-depth security that cannot be bypassed by application-level vulnerabilities.

#### 3.1 RLS Policy Overview

| Role | Table Access | Policy |
|------|--------------|--------|
| Patient | records | Own records only (`patient_id = auth.uid()`) |
| Patient | appointments | Own appointments only |
| Doctor | records | Assigned patients after OTP verification |
| Doctor | patients | Assigned patients only |
| Hospital Manager | records | Hospital-scoped (`hospital_id = manager.hospital_id`) |
| Hospital Manager | appointments | Hospital appointments only |
| Admin | ALL | Full access (`true`) |

#### 3.2 Patient RLS Policies

```sql
-- Patients can only view their own records
CREATE POLICY "Patients view own records" ON records
    FOR SELECT
    USING (
        patient_id = auth.uid()
        AND status = 'active'
    );

-- Patients can only insert their own records
CREATE POLICY "Patients insert own records" ON records
    FOR INSERT
    WITH CHECK (patient_id = auth.uid());

-- Patients can view their own appointments
CREATE POLICY "Patients view own appointments" ON appointments
    FOR SELECT
    USING (patient_id = auth.uid());
```

#### 3.3 Doctor RLS Policies

```sql
-- Doctors can view assigned patients' records (after approval)
CREATE POLICY "Doctors view assigned patient records" ON records
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM doctors
            WHERE doctors.user_id = auth.uid()
            AND doctors.approved = true
            AND records.patient_id IN (
                SELECT patient_id FROM doctor_patient_assignments
                WHERE doctor_id = doctors.id
            )
        )
        AND status = 'active'
    );

-- Doctors can update patient records
CREATE POLICY "Doctors update patient records" ON records
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM doctors
            WHERE doctors.user_id = auth.uid()
            AND doctors.approved = true
        )
    );
```

#### 3.4 Hospital Manager RLS Policies

```sql
-- Managers can view all records in their hospital
CREATE POLICY "Managers view hospital records" ON records
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM hospital_managers
            WHERE hospital_managers.user_id = auth.uid()
            AND records.hospital_id = hospital_managers.hospital_id
        )
    );

-- Managers can update/delete hospital records
CREATE POLICY "Managers manage hospital records" ON records
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM hospital_managers
            WHERE hospital_managers.user_id = auth.uid()
            AND records.hospital_id = hospital_managers.hospital_id
        )
    );
```

#### 3.5 Admin RLS Policies

```sql
-- Admins have full access to all tables
CREATE POLICY "Admins full access" ON records
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );
```

#### 3.6 Soft Delete Implementation

Records are never permanently deleted; instead, they use soft delete:

```sql
-- Update status instead of delete
UPDATE records 
SET status = 'deleted', updated_at = NOW()
WHERE id = record_id;

-- All queries filter by active status
SELECT * FROM records WHERE status = 'active';
```

This ensures:
- Data recovery is possible
- Audit trail is maintained
- HIPAA 7-year retention compliance
- Referential integrity preserved

---

# 4. ADVANCED APPOINTMENT SYSTEM

## Add this as a NEW SECTION or expand "Core Features"

---

### Advanced Appointment Booking System

The system implements a sophisticated appointment scheduling system with dynamic time slots, duration-based booking, and emergency handling capabilities.

#### 4.1 Appointment Types and Durations

| Appointment Type | Duration | Description |
|------------------|----------|-------------|
| Consultation | 5 minutes | Quick medical consultation |
| Follow-up | 10 minutes | Follow-up on previous visit |
| Checkup | 10 minutes | Routine health checkup |
| Emergency | 5-60 minutes (custom) | Urgent medical attention |

**Implementation:**
```typescript
const APPOINTMENT_TYPES = [
  { value: "consultation", label: "Consultation", duration: 5 },
  { value: "follow_up", label: "Follow-up", duration: 10 },
  { value: "checkup", label: "Checkup", duration: 10 },
  { value: "emergency", label: "Emergency", duration: null }  // Custom
];
```

#### 4.2 Dynamic Time Slot Generation

Time slots are generated based on:
- Doctor's availability schedule
- Appointment type duration
- Existing bookings
- Hospital operating hours (9:00 AM - 5:00 PM)

```typescript
function generateTimeSlots(startTime: string, endTime: string, duration: number) {
  const slots = [];
  let current = parseTime(startTime);
  const end = parseTime(endTime);
  
  while (current + duration <= end) {
    slots.push(formatTime(current));
    current += duration;
  }
  return slots;
}
```

#### 4.3 Emergency Appointment Handling

Emergency appointments receive special treatment:

| Feature | Implementation |
|---------|----------------|
| Custom Duration | Patient can select 5-60 minutes via slider |
| Priority Booking | Emergency slots bypass normal queue |
| Auto-Confirmation | Emergency appointments auto-confirm (no manager approval) |
| Conflict Resolution | Existing appointments can be rescheduled |

**Emergency Mode UI:**
```typescript
{isEmergency && (
  <div className="space-y-2">
    <Label>Emergency Duration: {emergencyDuration} minutes</Label>
    <Slider
      value={[emergencyDuration]}
      onValueChange={(value) => setEmergencyDuration(value[0])}
      min={5}
      max={60}
      step={5}
    />
  </div>
)}
```

#### 4.4 Hospital Manager Approval Workflow

Non-emergency appointments require manager approval:

```
Patient Books → Status: "pending" → Manager Reviews → 
    ├── Approve → Status: "confirmed" → Notification to Patient
    └── Reject → Status: "cancelled" → Notification with Reason
```

**Appointment Status Flow:**
```
┌─────────┐     ┌─────────┐     ┌───────────┐
│ pending │ ──► │confirmed│ ──► │ completed │
└─────────┘     └─────────┘     └───────────┘
     │               │
     ▼               ▼
┌─────────┐     ┌─────────┐
│cancelled│     │ missed  │
└─────────┘     └─────────┘
```

#### 4.5 Missed Appointment Rescheduling

Appointments marked as "missed" can be automatically rescheduled:

```sql
-- Function to handle missed appointments
CREATE OR REPLACE FUNCTION handle_missed_appointment(
    p_appointment_id UUID
) RETURNS void AS $$
BEGIN
    -- Mark as missed
    UPDATE appointments 
    SET status = 'missed' 
    WHERE id = p_appointment_id;
    
    -- Create rescheduled appointment for next available slot
    INSERT INTO appointments (patient_id, doctor_id, date, time_slot, status)
    SELECT patient_id, doctor_id, 
           date + INTERVAL '1 day',
           time_slot,
           'pending'
    FROM appointments 
    WHERE id = p_appointment_id;
END;
$$ LANGUAGE plpgsql;
```

#### 4.6 Doctor Availability Management

Doctors can set their weekly availability:

| Field | Type | Description |
|-------|------|-------------|
| doctor_id | UUID | Reference to doctor |
| day_of_week | INTEGER | 0 (Sunday) to 6 (Saturday) |
| start_time | TIME | Availability start |
| end_time | TIME | Availability end |
| is_available | BOOLEAN | Whether available that day |

```sql
CREATE TABLE doctor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 5. ADDITIONAL REFERENCES TO ADD

## Add these to your References section

---

### EU AI Act and Compliance

1. European Parliament. (2024). *Regulation (EU) 2024/1689 - Artificial Intelligence Act*. Official Journal of the European Union. https://eur-lex.europa.eu/eli/reg/2024/1689

2. European Commission. (2024). *AI Act: High-Risk AI Systems in Healthcare*. https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai

### Technical Documentation

3. LangChain. (2024). *LangGraph: Building Stateful Multi-Agent Applications*. https://langchain-ai.github.io/langgraph/

4. Google. (2024). *Gemini API Documentation*. https://ai.google.dev/docs

5. Supabase. (2024). *Row Level Security Policies*. https://supabase.com/docs/guides/auth/row-level-security

6. ChromaDB. (2024). *Vector Database Documentation*. https://docs.trychroma.com/

### AI Safety and Hallucination

7. Ji, Z., et al. (2023). *Survey of Hallucination in Natural Language Generation*. ACM Computing Surveys. https://doi.org/10.1145/3571730

8. Weidinger, L., et al. (2022). *Taxonomy of Risks Posed by Language Models*. FAccT '22. https://doi.org/10.1145/3531146.3533088

---

# 📋 SUMMARY CHECKLIST

Use this to track what you've added:

| Section | Added? |
|---------|--------|
| EU AI Act Article 9 (Risk Management) | ☐ |
| EU AI Act Article 10 (Data Governance) | ☐ |
| EU AI Act Article 13 (Transparency) | ☐ |
| EU AI Act Article 14 (Human Oversight) | ☐ |
| EU AI Act Article 15 (Accuracy) | ☐ |
| EU AI Act Article 52 (Transparency Obligations) | ☐ |
| AI Guardrails - Input Validation | ☐ |
| AI Guardrails - Output Validation | ☐ |
| AI Guardrails - Hallucination Detection | ☐ |
| AI Guardrails - Response Sanitization | ☐ |
| RLS - Patient Policies | ☐ |
| RLS - Doctor Policies | ☐ |
| RLS - Manager Policies | ☐ |
| RLS - Admin Policies | ☐ |
| RLS - Soft Delete | ☐ |
| Appointments - Types & Durations | ☐ |
| Appointments - Emergency Handling | ☐ |
| Appointments - Manager Approval | ☐ |
| Appointments - Doctor Availability | ☐ |
| Additional References | ☐ |

---

**Document Created:** December 5, 2025
**For:** Major Project Report Update
**Project:** Smart Healthcare System / Care Access Pro

<!-- Ashmit contribution -->

<!-- Ashmit contribution -->
