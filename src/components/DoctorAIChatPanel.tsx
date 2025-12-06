import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Send, Stethoscope, User as UserIcon, FileText, Loader2, 
  BookOpen, Lightbulb, AlertTriangle, Download, X 
} from "lucide-react";
import { toast } from "sonner";

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "summary" | "recommendation";
}

interface DoctorAIChatPanelProps {
  recordId: string;
  recordTitle: string;
  recordFileUrl: string;
  recordFileType: string;
  patientId: string;
  patientName: string;
  onClose: () => void;
}

const DoctorAIChatPanel = ({ 
  recordId, 
  recordTitle, 
  recordFileUrl, 
  recordFileType, 
  patientId,
  patientName,
  onClose 
}: DoctorAIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Get Summary
  const getSummary = async () => {
    setIsSummarizing(true);
    try {
      const response = await fetch(`${AI_BACKEND_URL}/summarize-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: recordFileUrl,
          title: recordTitle,
          patient_id: patientId
        })
      });
      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.summary,
          type: "summary"
        }]);
      } else {
        toast.error("Could not summarize the report");
      }
    } catch (error) {
      toast.error("Failed to connect to AI service");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Get Clinical Recommendations
  const getRecommendations = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, {
      role: "user",
      content: "Please provide clinical recommendations based on this report."
    }]);

    try {
      const response = await fetch(`${AI_BACKEND_URL}/doctor-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: recordFileUrl,
          title: recordTitle,
          patient_id: patientId
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.recommendations || data.response || "Could not generate recommendations.",
        type: "recommendation"
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Failed to get recommendations. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Chat with AI about the report
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${AI_BACKEND_URL}/doctor-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          file_url: recordFileUrl,
          title: recordTitle,
          patient_id: patientId,
          chat_history: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || "I couldn't process that request.",
        type: "chat"
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Connection error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Export conversation
  const exportConversation = () => {
    const content = `
MEDICAL CONSULTATION NOTES
==========================
Patient: ${patientName}
Report: ${recordTitle}
Date: ${new Date().toLocaleString()}

${summary ? `REPORT SUMMARY:\n${summary}\n\n` : ""}
CONSULTATION NOTES:
${messages.map(m => `${m.role === 'user' ? 'Doctor' : 'AI Assistant'}: ${m.content}`).join('\n\n')}

---
Generated from Care Access Pro
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Consultation_${patientName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Consultation notes exported!");
  };

  return (
    <Card 
      className="w-full max-w-3xl mx-auto shadow-xl border-0 bg-white max-h-[90vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <CardHeader className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-t-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-6 w-6" />
            <div>
              <CardTitle className="text-lg font-semibold">Clinical Analysis</CardTitle>
              <p className="text-teal-100 text-sm mt-1">
                Patient: {patientName} • {recordTitle}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-white hover:bg-teal-500/30"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
          <Button
            onClick={getSummary}
            disabled={isSummarizing || isLoading}
            variant="outline"
            size="sm"
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            {isSummarizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookOpen className="h-4 w-4 mr-2" />}
            Get Summary
          </Button>
          <Button
            onClick={getRecommendations}
            disabled={isLoading || isSummarizing}
            variant="outline"
            size="sm"
            className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
            Get Recommendations
          </Button>
          {messages.length > 0 && (
            <Button
              onClick={exportConversation}
              variant="outline"
              size="sm"
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Notes
            </Button>
          )}
        </div>

        {/* Messages Area - with visible scrollbar */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto pr-2 scrollbar-visible"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#14b8a6 #f1f5f9'
          }}
        >
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Clinical AI Assistant</p>
              <p className="text-sm mt-2">
                Get a summary, recommendations, or ask questions about this patient's report.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white'
                        : msg.type === 'summary'
                        ? 'bg-blue-50 border border-blue-200'
                        : msg.type === 'recommendation'
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === 'user' ? (
                        <UserIcon className="h-4 w-4" />
                      ) : msg.type === 'summary' ? (
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      ) : msg.type === 'recommendation' ? (
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Stethoscope className="h-4 w-4 text-teal-600" />
                      )}
                      <span className="text-xs font-medium opacity-70">
                        {msg.role === 'user' ? 'You' : 
                         msg.type === 'summary' ? 'Report Summary' :
                         msg.type === 'recommendation' ? 'Clinical Recommendations' : 'AI Assistant'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about this patient's report..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-500 flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>AI-assisted analysis for clinical reference only. Always apply professional medical judgment.</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorAIChatPanel;
