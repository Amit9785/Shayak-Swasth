import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User as UserIcon, Sparkles, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// AI Backend URL - change this in production
const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  analysisType?: string;
  recordsUsed?: number;
}

interface AIChatPanelProps {
  recordId?: string;
  recordTitle?: string;
  recordFileUrl?: string;
  recordFileType?: string;
  patientId?: string;
}

const AIChatPanel = ({ recordId, recordTitle, recordFileUrl, recordFileType, patientId }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Function to summarize a PDF report
  const summarizePDF = async () => {
    if (!recordFileUrl) {
      toast.error("No file URL available for this record");
      return;
    }

    setIsSummarizing(true);
    setMessages(prev => [...prev, { 
      role: "user", 
      content: `Please summarize my report: ${recordTitle || 'Medical Report'}` 
    }]);

    try {
      const response = await fetch(`${AI_BACKEND_URL}/summarize-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: recordFileUrl,
          title: recordTitle,
          patient_id: patientId || user?.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.summary,
          analysisType: "PDF Summary",
          recordsUsed: 1
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.summary || "I couldn't summarize this PDF. It might be an image-based PDF or have restricted access."
        }]);
      }
    } catch (error) {
      console.error("PDF summarization error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I apologize, but I couldn't connect to the AI service to summarize this PDF. Please ensure the AI backend is running."
      }]);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    
    // Check if user is asking to summarize the current report
    const summarizeKeywords = ['summarize', 'summary', 'explain', 'what does', 'analyze', 'tell me about', 'what is in'];
    const isAskingToSummarize = summarizeKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword) && 
      (userMessage.toLowerCase().includes('report') || 
       userMessage.toLowerCase().includes('document') || 
       userMessage.toLowerCase().includes('pdf') ||
       userMessage.toLowerCase().includes('record') ||
       userMessage.toLowerCase().includes('this'))
    );

    // If asking to summarize and we have a PDF file, use the summarize endpoint
    if (isAskingToSummarize && recordFileUrl && recordFileType?.toLowerCase() === 'pdf') {
      setInput("");
      await summarizePDF();
      return;
    }

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Prepare chat history for context
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call our LangGraph AI backend
      const response = await fetch(`${AI_BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage,
          patient_id: patientId || user?.id || "unknown",
          chat_history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.response,
          analysisType: data.analysis_type,
          recordsUsed: data.records_used
        }]);
      } else {
        // Fallback: Try simple chat endpoint
        const fallbackResponse = await fetch(`${AI_BACKEND_URL}/simple-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userMessage,
            patient_id: patientId || user?.id || "unknown",
            chat_history: []
          })
        });

        const fallbackData = await fallbackResponse.json();
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: fallbackData.response || "I apologize, but I couldn't process your request. Please try again."
        }]);
      }
    } catch (error) {
      console.error("AI Chat error:", error);
      
      // Provide a helpful fallback message
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `I apologize, but I'm having trouble connecting to the AI service. 

**To set up the AI backend:**
1. Navigate to the \`ai-backend\` folder
2. Install dependencies: \`pip install -r requirements.txt\`
3. Add your Gemini API key to \`.env\`
4. Run: \`python main.py\`

In the meantime, please consult with your healthcare provider for medical questions.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = recordId && recordFileUrl ? [
    "Summarize this report",
    "What are the key findings?",
    "Are there any concerning values?",
    "Explain this in simple terms"
  ] : [
    "What does my latest report say?",
    "Explain my test results",
    "What lifestyle changes should I consider?",
    "Summarize my medical history"
  ];

  return (
    <Card className="h-full flex flex-col bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-2">
              AI Medical Assistant
              <Badge variant="secondary" className="text-xs">
                Gemini 2.0 + RAG
              </Badge>
            </span>
            {recordTitle && (
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Analyzing: {recordTitle}
              </span>
            )}
          </div>
        </CardTitle>
        {/* Quick Summarize Button for PDFs */}
        {recordFileUrl && recordFileType?.toLowerCase() === 'pdf' && (
          <Button 
            onClick={summarizePDF} 
            disabled={isSummarizing || isLoading}
            className="mt-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Summarize This Report
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-6">
              <div className="relative">
                <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <Sparkles className="h-4 w-4 text-yellow-500 absolute top-0 right-1/3 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">
                  {recordId 
                    ? "Ask me anything about this medical report"
                    : "How can I help you understand your health today?"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Powered by Gemini 1.5 with RAG-based medical record analysis
                </p>
              </div>
              
              {/* Suggested Questions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.map((question, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setInput(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.role === "assistant" && (msg.analysisType || msg.recordsUsed) && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                        {msg.analysisType && (
                          <Badge variant="outline" className="text-xs">
                            {msg.analysisType}
                          </Badge>
                        )}
                        {msg.recordsUsed !== undefined && msg.recordsUsed > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {msg.recordsUsed} records analyzed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Analyzing with Gemini 1.5</span>
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
          <div className="flex gap-2">
            <Input
              placeholder={
                recordId
                  ? "Ask about this report..."
                  : "Ask me about your health..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()}
              disabled={isLoading}
              className="rounded-full px-4"
            />
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()}
              className="rounded-full"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">
            AI responses are for informational purposes only. Always consult your healthcare provider.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIChatPanel;

// Ashmit contribution
