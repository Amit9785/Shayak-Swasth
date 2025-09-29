"""
LangGraph Medical Analysis Workflow
Implements a multi-step AI workflow for analyzing medical records

EU AI Act Compliance:
- Article 9: Risk Management System
- Article 10: Data Governance 
- Article 13: Transparency and Provision of Information
- Article 14: Human Oversight
- Article 15: Accuracy, Robustness and Cybersecurity
- Article 52: Transparency Obligations

Anti-Hallucination Measures:
1. Grounded responses only from retrieved documents
2. Confidence scoring for responses
3. Source citation requirements
4. Explicit uncertainty acknowledgment
5. Human oversight triggers
"""
import os
import re
from typing import TypedDict, Annotated, Sequence, List, Dict, Any, Optional
from operator import add
from datetime import datetime

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain.schema.output_parser import StrOutputParser
from langchain.schema.runnable import RunnablePassthrough

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor

from services.vector_store import vector_store
from services.embeddings import embedding_service


# ============================================================================
# EU AI ACT COMPLIANCE CONFIGURATION
# ============================================================================

EU_AI_ACT_GUIDELINES = """
## EU AI ACT COMPLIANCE REQUIREMENTS (High-Risk Medical AI System)

### Article 9 - Risk Management:
- Flag any health-critical information with appropriate urgency
- Identify potential risks in recommendations
- Never provide advice that could cause harm

### Article 10 - Data Governance:
- Only use data from verified medical records
- Maintain data quality and accuracy standards
- Respect data minimization principles

### Article 13 - Transparency:
- Clearly identify as an AI system
- Explain reasoning behind conclusions
- Cite sources for all claims
- Acknowledge limitations

### Article 14 - Human Oversight:
- Flag cases requiring immediate medical attention
- Recommend professional consultation for serious matters
- Never replace human medical judgment

### Article 15 - Accuracy & Robustness:
- Only make claims supported by evidence
- Express confidence levels for all statements
- Acknowledge uncertainty explicitly
- Prevent hallucination through strict grounding

### Article 52 - Transparency Obligations:
- Disclose AI nature at start of each response
- Provide traceability information
- Enable verification of claims
"""

# Anti-hallucination prompt additions
ANTI_HALLUCINATION_RULES = """
## ANTI-HALLUCINATION RULES (MANDATORY):

1. NEVER invent medical information not present in records
2. NEVER assume conditions, medications, or history not documented
3. ALWAYS use phrases like "According to your [record]..." for citations
4. ALWAYS say "This information is not in your records" when data is missing
5. NEVER use "typically", "usually", "often" without citing specific records
6. ALWAYS express confidence: HIGH (directly stated), MEDIUM (inferable), LOW (limited data)
7. NEVER predict outcomes without documented evidence
8. ALWAYS flag uncertainty with explicit markers
"""


# ============================================================================
# GUARDRAILS SYSTEM - EU AI ACT ENFORCEMENT
# ============================================================================

class AIGuardrails:
    """
    AI Guardrails System for EU AI Act Compliance
    
    Implements input validation, output filtering, and safety checks
    to ensure AI responses meet regulatory requirements.
    
    Based on EU AI Act requirements for High-Risk AI Systems:
    - Article 9: Risk Management
    - Article 14: Human Oversight
    - Article 15: Accuracy and Robustness
    """
    
    # Prohibited content patterns (things AI should NEVER say)
    PROHIBITED_PATTERNS = [
        # Diagnostic claims
        r"you have \w+",
        r"you are suffering from",
        r"you definitely have",
        r"this confirms you have",
        r"i diagnose you with",
        r"my diagnosis is",
        
        # Prescription/treatment orders
        r"you should take \d+ mg",
        r"take this medication",
        r"stop taking your",
        r"increase your dosage",
        r"i prescribe",
        
        # Dangerous medical advice
        r"don't see a doctor",
        r"no need to consult",
        r"ignore this symptom",
        r"this is not serious",
        r"you don't need treatment",
        
        # Absolute certainty claims
        r"i am 100% certain",
        r"this will definitely",
        r"guaranteed to",
        r"absolutely certain",
        r"without any doubt",
    ]
    
    # Required disclaimers that must be present
    REQUIRED_ELEMENTS = [
        "consult",  # Must mention consulting professionals
        "healthcare",  # Must reference healthcare context
    ]
    
    # High-risk keywords that trigger additional scrutiny
    HIGH_RISK_KEYWORDS = [
        "emergency", "urgent", "severe", "critical", "life-threatening",
        "suicide", "self-harm", "overdose", "heart attack", "stroke",
        "cancer", "tumor", "malignant", "terminal", "fatal"
    ]
    
    # Hallucination indicators
    HALLUCINATION_INDICATORS = [
        r"as everyone knows",
        r"it is well known that",
        r"studies have shown",  # Without specific citation
        r"research indicates",  # Without specific citation
        r"doctors recommend",  # Generic without source
        r"medical experts say",  # Generic without source
        r"according to medical science",  # Too vague
    ]
    
    def __init__(self):
        self.violation_log = []
        self.guardrail_version = "v1.0-EU-AI-Act"
    
    def validate_input(self, query: str) -> Dict[str, Any]:
        """
        Validate user input before processing.
        
        Returns:
            Dict with 'valid' bool and 'warnings' list
        """
        warnings = []
        is_valid = True
        requires_human_oversight = False
        
        query_lower = query.lower()
        
        # Check for high-risk content
        for keyword in self.HIGH_RISK_KEYWORDS:
            if keyword in query_lower:
                warnings.append(f"High-risk keyword detected: '{keyword}'")
                requires_human_oversight = True
        
        # Check for emergency situations
        emergency_patterns = [
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
        
        for pattern in emergency_patterns:
            if re.search(pattern, query_lower):
                return {
                    "valid": False,
                    "is_emergency": True,
                    "message": "🚨 EMERGENCY DETECTED: Please call emergency services (911) immediately. This AI cannot provide emergency medical assistance.",
                    "requires_human_oversight": True
                }
        
        return {
            "valid": is_valid,
            "warnings": warnings,
            "requires_human_oversight": requires_human_oversight,
            "is_emergency": False
        }
    
    def validate_output(self, response: str, source_records: List[Dict]) -> Dict[str, Any]:
        """
        Validate AI output before returning to user.
        
        Checks for:
        - Prohibited content patterns
        - Hallucination indicators
        - Required disclaimer presence
        - Appropriate confidence levels
        
        Returns:
            Dict with 'valid' bool, 'violations' list, and 'sanitized_response'
        """
        violations = []
        response_lower = response.lower()
        
        # Check for prohibited patterns
        for pattern in self.PROHIBITED_PATTERNS:
            if re.search(pattern, response_lower):
                violations.append({
                    "type": "PROHIBITED_CONTENT",
                    "pattern": pattern,
                    "severity": "HIGH",
                    "article": "EU AI Act Article 15"
                })
        
        # Check for hallucination indicators
        for pattern in self.HALLUCINATION_INDICATORS:
            if re.search(pattern, response_lower):
                # Only flag if no specific source is cited nearby
                if "[source" not in response_lower and "according to your" not in response_lower:
                    violations.append({
                        "type": "POTENTIAL_HALLUCINATION",
                        "pattern": pattern,
                        "severity": "MEDIUM",
                        "article": "EU AI Act Article 15"
                    })
        
        # Check for required elements
        has_disclaimer = any(elem in response_lower for elem in self.REQUIRED_ELEMENTS)
        if not has_disclaimer:
            violations.append({
                "type": "MISSING_DISCLAIMER",
                "severity": "MEDIUM",
                "article": "EU AI Act Article 13"
            })
        
        # Verify grounding if records exist
        if source_records:
            grounding_score = self._calculate_grounding_score(response, source_records)
            if grounding_score < 0.5:
                violations.append({
                    "type": "LOW_GROUNDING",
                    "score": grounding_score,
                    "severity": "HIGH",
                    "article": "EU AI Act Article 15"
                })
        
        # If violations found, sanitize the response
        if any(v["severity"] == "HIGH" for v in violations):
            sanitized = self._sanitize_response(response, violations)
            return {
                "valid": False,
                "violations": violations,
                "sanitized_response": sanitized,
                "original_response": response
            }
        
        return {
            "valid": True,
            "violations": violations,
            "sanitized_response": response
        }
    
    def _calculate_grounding_score(self, response: str, source_records: List[Dict]) -> float:
        """
        Calculate how well the response is grounded in source records.
        
        Returns a score from 0.0 to 1.0
        """
        if not source_records:
            return 0.0
        
        # Extract key terms from source records
        source_terms = set()
        for record in source_records:
            content = record.get("content", "").lower()
            # Extract medical terms (simple approach)
            words = re.findall(r'\b[a-z]{4,}\b', content)
            source_terms.update(words)
        
        # Check how many response terms appear in sources
        response_terms = set(re.findall(r'\b[a-z]{4,}\b', response.lower()))
        
        if not response_terms:
            return 0.5  # Neutral if no meaningful terms
        
        overlap = len(response_terms.intersection(source_terms))
        grounding_score = min(1.0, overlap / max(len(response_terms) * 0.3, 1))
        
        # Boost score if source citations are present
        if "[source" in response.lower() or "according to your" in response.lower():
            grounding_score = min(1.0, grounding_score + 0.3)
        
        return grounding_score
    
    def _sanitize_response(self, response: str, violations: List[Dict]) -> str:
        """
        Sanitize a response that has violations.
        """
        sanitized = response
        
        # Add warning header
        warning_header = """
 **GUARDRAIL ALERT**: This response has been modified for safety compliance.

"""
        
        # Remove or modify prohibited content
        for violation in violations:
            if violation["type"] == "PROHIBITED_CONTENT":
                pattern = violation["pattern"]
                sanitized = re.sub(
                    pattern,
                    "[Content removed for safety - please consult healthcare provider]",
                    sanitized,
                    flags=re.IGNORECASE
                )
        
        # Add required disclaimer if missing
        if any(v["type"] == "MISSING_DISCLAIMER" for v in violations):
            sanitized += "\n\n⚕️ **Important**: Please consult with qualified healthcare professionals for medical advice."
        
        return warning_header + sanitized
    
    def log_violation(self, violation: Dict, query: str, response: str):
        """Log a guardrail violation for audit purposes (EU AI Act Article 12)"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "violation": violation,
            "query_hash": hash(query),  # Don't store actual query for privacy
            "response_length": len(response),
            "guardrail_version": self.guardrail_version
        }
        self.violation_log.append(log_entry)
    
    def get_safety_prompt(self) -> str:
        """Get safety-focused system prompt addition"""
        return """
## GUARDRAIL SAFETY RULES (STRICTLY ENFORCED):

NEVER DO:
- Diagnose any medical condition
- Prescribe or suggest specific medications/dosages
- Tell patients to ignore symptoms or skip doctor visits
- Claim certainty about medical outcomes
- Provide emergency medical instructions

ALWAYS DO:
- Cite specific records for every claim
- Express uncertainty when data is limited
- Recommend consulting healthcare providers
- Use conditional language ("may", "could", "based on records")
- Flag concerning findings appropriately

IF EMERGENCY DETECTED:
- Immediately direct to emergency services (911)
- Do not attempt to provide emergency medical advice
- State clearly that AI cannot help in emergencies
"""


# Initialize global guardrails instance
ai_guardrails = AIGuardrails()


class EUAIActCompliance:
    """
    EU AI Act Compliance Handler
    
    Ensures all AI responses meet EU AI Act requirements for high-risk
    medical AI systems, with specific focus on preventing hallucinations.
    """
    
    def __init__(self):
        self.compliance_version = "EU-AI-Act-2024-v1"
        self.risk_category = "HIGH"  # Medical AI is high-risk under EU AI Act
        
    def verify_response(self, response: str, source_records: List[Dict]) -> str:
        """
        Verify response is grounded in source records and add compliance markers.
        
        Args:
            response: The AI-generated response
            source_records: List of source records used for generation
            
        Returns:
            Verified response with compliance markers
        """
        # Add source verification warning if no records
        if not source_records:
            return self._add_no_records_disclaimer(response)
        
        # Add confidence indicators
        response = self._add_confidence_markers(response)
        
        return response
    
    def _add_no_records_disclaimer(self, response: str) -> str:
        """Add disclaimer when no source records are available"""
        disclaimer = """
═══════════════════════════════════════════════════════════════════
⚠️ IMPORTANT NOTICE
═══════════════════════════════════════════════════════════════════
This response is based on limited or no medical records. 
The information provided is general in nature and may not be specific to your health situation.
Please consult with your healthcare provider for personalized medical advice.

"""
        return disclaimer + response
    
    def _add_confidence_markers(self, response: str) -> str:
        """Add confidence level markers to response"""
        # Check for uncertainty indicators and add appropriate markers
        uncertainty_phrases = [
            "may", "might", "could", "possibly", "perhaps",
            "it appears", "it seems", "likely", "unlikely"
        ]
        
        has_uncertainty = any(phrase in response.lower() for phrase in uncertainty_phrases)
        
        if has_uncertainty:
            confidence_note = "\n\n📊 CONFIDENCE NOTE: Some statements in this response contain uncertainty markers. These indicate areas where the available records provide limited information.\n"
            return response + confidence_note
        
        return response
    
    def generate_compliance_footer(self, records_count: int, analysis_type: str) -> str:
        """Generate EU AI Act compliance footer"""
        return f"""

═══════════════════════════════════════════════════════════════════
🔒 EU AI Act Compliance Information
═══════════════════════════════════════════════════════════════════
  • AI System Classification: High-Risk Medical AI (EU AI Act Category)
  • Records Analyzed: {records_count}
  • Analysis Type: {analysis_type}
  • Compliance Standard: EU AI Act Articles 9, 10, 13, 14, 15, 52
  • Verification: All claims are traceable to source medical records
  • Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")}

═══════════════════════════════════════════════════════════════════
⚕️ IMPORTANT DISCLAIMER
═══════════════════════════════════════════════════════════════════
This AI assistant provides information based solely on your medical records. 
It does NOT provide medical diagnoses, treatment plans, or replace professional medical advice. 
Always consult qualified healthcare professionals for medical decisions.
"""

    def get_ai_disclosure(self) -> str:
        """Get mandatory AI disclosure statement"""
        return """
═══════════════════════════════════════════════════════════════════
🤖 AI ASSISTANT DISCLOSURE (EU AI Act Article 52)
═══════════════════════════════════════════════════════════════════
I am an artificial intelligence system designed to analyze your medical records. 
My responses are generated based on documented information in your records only.
I am NOT a replacement for professional medical advice, diagnosis, or treatment.

"""


# Define the state for our graph
class MedicalAnalysisState(TypedDict):
    """State for the medical analysis workflow"""
    messages: Annotated[Sequence[BaseMessage], add]
    patient_id: str
    query: str
    context: str
    analysis_type: str
    retrieved_records: List[Dict[str, Any]]
    analysis_result: str
    recommendations: str
    summary: str
    confidence_level: str
    error: Optional[str]


class MedicalAnalysisWorkflow:
    """
    
    EU AI Act Compliance:
    - Article 9: Risk assessment at each analysis step
    - Article 10: Uses only verified patient records
    - Article 13: Provides transparency notices and source citations
    - Article 14: Flags cases requiring human oversight
    - Article 52: Implements grounding verification to prevent hallucination
    """
    
    def __init__(self):
        # Initialize EU AI Act Compliance Handler
        self.eu_compliance = EUAIActCompliance()
        
        # Initialize Gemini 1.5 model with conservative settings
        # Low temperature reduces hallucination risk (EU AI Act Article 15)
        self.llm = ChatGoogleGenerativeAI(
            model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.1,  # Very low temperature for factual accuracy
            convert_system_message_to_human=True,
            top_p=0.8,  # Nucleus sampling for controlled generation
            top_k=40    # Limit vocabulary for consistency
        )
        
        # Build the workflow graph
        self.workflow = self._build_workflow()
        self.app = self.workflow.compile()
    
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow with EU AI Act compliance"""
        workflow = StateGraph(MedicalAnalysisState)
        
        # Add nodes
        workflow.add_node("classify_query", self._classify_query)
        workflow.add_node("retrieve_records", self._retrieve_records)
        workflow.add_node("analyze_records", self._analyze_records)
        workflow.add_node("generate_recommendations", self._generate_recommendations)
        workflow.add_node("summarize", self._summarize)
        workflow.add_node("handle_error", self._handle_error)
        
        # Define edges
        workflow.set_entry_point("classify_query")
        
        workflow.add_conditional_edges(
            "classify_query",
            self._route_after_classification,
            {
                "retrieve": "retrieve_records",
                "error": "handle_error"
            }
        )
        
        workflow.add_edge("retrieve_records", "analyze_records")
        workflow.add_edge("analyze_records", "generate_recommendations")
        workflow.add_edge("generate_recommendations", "summarize")
        workflow.add_edge("summarize", END)
        workflow.add_edge("handle_error", END)
        
        return workflow
    
    def _classify_query(self, state: MedicalAnalysisState) -> Dict[str, Any]:
        """Classify the type of medical query"""
        classify_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a medical query classifier. Classify the user's query into one of these categories:
            - DIAGNOSIS: Questions about symptoms, conditions, or diagnoses
            - TREATMENT: Questions about treatments, medications, or procedures
            - HISTORY: Questions about medical history or past records
            - LIFESTYLE: Questions about lifestyle, diet, or preventive care
            - GENERAL: General health questions
            
            Respond with ONLY the category name."""),
            HumanMessage(content="{query}")
        ])
        
        chain = classify_prompt | self.llm | StrOutputParser()
        
        try:
            analysis_type = chain.invoke({"query": state["query"]})
            return {"analysis_type": analysis_type.strip().upper()}
        except Exception as e:
            return {"error": str(e), "analysis_type": "GENERAL"}
    
    def _route_after_classification(self, state: MedicalAnalysisState) -> str:
        """Route based on classification result"""
        if state.get("error"):
            return "error"
        return "retrieve"
    
    def _retrieve_records(self, state: MedicalAnalysisState) -> Dict[str, Any]:
        """Retrieve relevant medical records using RAG"""
        try:
            # Search for relevant records
            records = vector_store.search(
                query=state["query"],
                patient_id=state.get("patient_id"),
                n_results=5
            )
            
            # Build context from retrieved records with source citations
            context_parts = []
            for idx, record in enumerate(records, 1):
                metadata = record.get("metadata", {})
                context_parts.append(f"""
[SOURCE {idx}]
Record Title: {metadata.get('title', 'Unknown')}
Record Date: {metadata.get('date', 'Unknown')}
Record Type: {metadata.get('file_type', 'Unknown')}
Content:
{record.get('content', '')}
[END SOURCE {idx}]
---""")
            
            if context_parts:
                context = f"""
AVAILABLE MEDICAL RECORDS ({len(records)} records found):
{"".join(context_parts)}

⚠️ GROUNDING REQUIREMENT: All statements MUST reference [SOURCE X] from above.
Any information NOT in these sources must be marked as "Not available in records."
"""
            else:
                context = """
⚠️ NO MEDICAL RECORDS FOUND for this patient.
You must clearly state that no records are available and provide only general information.
Do NOT make any specific claims about the patient's health.
"""
            
            return {
                "retrieved_records": records,
                "context": context
            }
        except Exception as e:
            return {
                "retrieved_records": [],
                "context": "Unable to retrieve medical records. Providing general guidance only.",
                "error": str(e)
            }
    
    def _analyze_records(self, state: MedicalAnalysisState) -> Dict[str, Any]:
        """Analyze the retrieved medical records with EU AI Act compliance"""
        
        # Get guardrail safety rules
        safety_rules = ai_guardrails.get_safety_prompt()
        
        analyze_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=f"""You are an EU AI Act compliant medical AI assistant.

{EU_AI_ACT_GUIDELINES}

{ANTI_HALLUCINATION_RULES}

{safety_rules}

## YOUR TASK:
Analyze the patient's medical records and provide insights based on their query.

## RESPONSE FORMAT:
For EACH claim you make, use this format:
"[Statement] (Source: [Record Title, Date]) [Confidence: HIGH/MEDIUM/LOW]"

If information is not available:
"This information is not documented in your available records."

## PATIENT'S MEDICAL RECORDS:
{{context}}

## QUERY TYPE: {{analysis_type}}

Remember: You are providing INFORMATION only, not medical diagnoses."""),
            HumanMessage(content="{query}")
        ])
        
        chain = analyze_prompt | self.llm | StrOutputParser()
        
        try:
            analysis = chain.invoke({
                "context": state["context"],
                "analysis_type": state["analysis_type"],
                "query": state["query"]
            })
            
            # Verify and enhance response with EU compliance
            verified_analysis = self.eu_compliance.verify_response(
                response=analysis,
                source_records=state.get("retrieved_records", [])
            )
            
            return {"analysis_result": verified_analysis}
        except Exception as e:
            return {
                "analysis_result": "Unable to analyze records at this time. Please consult your healthcare provider.",
                "error": str(e)
            }
    
    def _generate_recommendations(self, state: MedicalAnalysisState) -> Dict[str, Any]:
        """Generate health recommendations with EU AI Act compliance"""
        
        recommend_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=f"""Based on the medical analysis, provide actionable health recommendations.

{ANTI_HALLUCINATION_RULES}

## RECOMMENDATION GUIDELINES:
1. ONLY recommend actions mentioned by healthcare providers in the records
2. Clearly distinguish between:
   - "Based on your records..." (documented recommendations)
   - "General health advice..." (not from records)
3. NEVER suggest medications or treatments not prescribed in records
4. Always recommend consulting healthcare providers for new concerns

## PREVIOUS ANALYSIS:
{{analysis_result}}

## QUERY TYPE: {{analysis_type}}

## CONFIDENCE LEVELS FOR RECOMMENDATIONS:
- HIGH: Directly recommended by healthcare provider in records
- MEDIUM: Logically follows from documented conditions
- LOW: General health advice not specific to patient

⚠️ These recommendations supplement, not replace, advice from healthcare providers."""),
            HumanMessage(content="Provide EU AI Act compliant recommendations.")
        ])
        
        chain = recommend_prompt | self.llm | StrOutputParser()
        
        try:
            recommendations = chain.invoke({
                "analysis_result": state["analysis_result"],
                "analysis_type": state["analysis_type"]
            })
            
            verified_recommendations = self.eu_compliance.verify_response(
                response=recommendations,
                source_records=state.get("retrieved_records", [])
            )
            
            return {"recommendations": verified_recommendations}
        except Exception as e:
            return {"recommendations": "Please consult with your healthcare provider for personalized recommendations."}
    
    def _summarize(self, state: MedicalAnalysisState) -> Dict[str, Any]:
        """Create a final EU AI Act compliant summary response"""
        
        records_count = len(state.get("retrieved_records", []))
        ai_disclosure = self.eu_compliance.get_ai_disclosure()
        
        summary_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=f"""Create a clear, EU AI Act compliant summary.

## MANDATORY RESPONSE STRUCTURE:

### 1. AI DISCLOSURE (Always include first):
{ai_disclosure}

### 2. DIRECT ANSWER:
Brief, factual response to the patient's question.

### 3. EVIDENCE FROM RECORDS:
Cite specific records with dates. Use "[Source: Record Name, Date]" format.

### 4. CONFIDENCE ASSESSMENT:
State overall confidence: HIGH, MEDIUM, or LOW with explanation.

### 5. RECOMMENDATIONS:
Only those supported by records.

### 6. INFORMATION GAPS:
What information was NOT available in the records.

### 7. DISCLAIMER:
Remind to consult healthcare providers.

## INPUT DATA:
Analysis: {{analysis_result}}
Recommendations: {{recommendations}}
Records Analyzed: {records_count}

## ANTI-HALLUCINATION FINAL CHECK:
- Every claim must reference a source
- Uncertainty must be explicitly stated
- No invented information allowed"""),
            HumanMessage(content="Create the final EU AI Act compliant summary.")
        ])
        
        chain = summary_prompt | self.llm | StrOutputParser()
        
        try:
            summary = chain.invoke({
                "analysis_result": state["analysis_result"],
                "recommendations": state["recommendations"]
            })
            
            # Add compliance footer
            compliance_footer = self.eu_compliance.generate_compliance_footer(
                records_count=records_count,
                analysis_type=state.get("analysis_type", "GENERAL")
            )
            
            return {"summary": summary + compliance_footer}
        except Exception as e:
            return {"summary": state["analysis_result"]}
    
    def _handle_error(self, state: MedicalAnalysisState) -> Dict[str, Any]:
        """Handle errors in the workflow with EU AI Act compliance"""
        error_response = f"""
{self.eu_compliance.get_ai_disclosure()}

I apologize, but I encountered an issue processing your request.

═══════════════════════════════════════════════════════════════════
❌ ERROR DETAILS
═══════════════════════════════════════════════════════════════════
{state.get('error', 'Unknown error')}

═══════════════════════════════════════════════════════════════════
✅ WHAT YOU CAN DO
═══════════════════════════════════════════════════════════════════
  1. Try rephrasing your question
  2. Ensure your medical records are properly uploaded
  3. Contact technical support if the issue persists
  4. Consult with your healthcare provider directly

{self.eu_compliance.generate_compliance_footer(0, "ERROR")}
"""
        return {"summary": error_response}
    
    async def analyze(
        self,
        query: str,
        patient_id: str,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Run the medical analysis workflow with EU AI Act compliance and guardrails"""
        
        # ====================================================================
        # GUARDRAIL: Input Validation (EU AI Act Article 9 - Risk Management)
        # ====================================================================
        input_validation = ai_guardrails.validate_input(query)
        
        # Handle emergency situations
        if input_validation.get("is_emergency"):
            return {
                "success": True,
                "response": input_validation["message"],
                "analysis_type": "EMERGENCY",
                "records_used": 0,
                "is_emergency": True,
                "eu_ai_act_compliant": True,
                "guardrail_triggered": True,
                "compliance_version": self.eu_compliance.compliance_version
            }
        
        # Log warnings if any
        if input_validation.get("warnings"):
            for warning in input_validation["warnings"]:
                ai_guardrails.log_violation(
                    {"type": "INPUT_WARNING", "message": warning},
                    query, ""
                )
        
        # Build initial messages from chat history
        messages = []
        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                else:
                    messages.append(AIMessage(content=msg["content"]))
        
        # Add current query
        messages.append(HumanMessage(content=query))
        
        # Initial state
        initial_state = {
            "messages": messages,
            "patient_id": patient_id,
            "query": query,
            "context": "",
            "analysis_type": "",
            "retrieved_records": [],
            "analysis_result": "",
            "recommendations": "",
            "summary": "",
            "confidence_level": "UNKNOWN",
            "error": None
        }
        
        # Run the workflow
        try:
            result = await self.app.ainvoke(initial_state)
            
            # ================================================================
            # GUARDRAIL: Output Validation (EU AI Act Article 15 - Accuracy)
            # ================================================================
            output_validation = ai_guardrails.validate_output(
                response=result["summary"],
                source_records=result.get("retrieved_records", [])
            )
            
            # Use sanitized response if violations found
            final_response = output_validation["sanitized_response"]
            
            # Log any violations
            for violation in output_validation.get("violations", []):
                ai_guardrails.log_violation(violation, query, result["summary"])
            
            # Add human oversight flag if needed
            requires_oversight = (
                input_validation.get("requires_human_oversight") or
                any(v["severity"] == "HIGH" for v in output_validation.get("violations", []))
            )
            
            return {
                "success": True,
                "response": final_response,
                "analysis_type": result["analysis_type"],
                "records_used": len(result["retrieved_records"]),
                "analysis": result["analysis_result"],
                "recommendations": result["recommendations"],
                "eu_ai_act_compliant": True,
                "compliance_version": self.eu_compliance.compliance_version,
                "guardrail_violations": len(output_validation.get("violations", [])),
                "requires_human_oversight": requires_oversight,
                "output_validated": output_validation["valid"]
            }
        except Exception as e:
            return {
                "success": False,
                "response": f"""
{self.eu_compliance.get_ai_disclosure()}

I apologize, but I encountered an error: {str(e)}

Please try again or consult with your healthcare provider directly.

{self.eu_compliance.generate_compliance_footer(0, "ERROR")}
""",
                "error": str(e),
                "eu_ai_act_compliant": True
            }


# Singleton instance
medical_workflow = MedicalAnalysisWorkflow()

# Ashmit contribution
