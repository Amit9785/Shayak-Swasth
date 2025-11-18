import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Send, Stethoscope, User as UserIcon, FileText, Loader2, 
  Lightbulb, AlertTriangle, Download, X, Layers, 
  TrendingUp, BarChart3, Clock
} from "lucide-react";
import { toast } from "sonner";
import type { Record } from "@/lib/types";

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "analysis";
}

interface DoctorMultiAnalysisPanelProps {
  records: Record[];
  patientId: string;
  patientName: string;
  onClose: () => void;
}

const DoctorMultiAnalysisPanel = ({ 
  records, 
  patientId,
  patientName,
  onClose 
}: DoctorMultiAnalysisPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Record[]>(records);
  const [analysisType, setAnalysisType] = useState<"comprehensive" | "comparative" | "timeline">("comprehensive");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleRecordSelection = (record: Record) => {
    setSelectedRecords(prev => {
      const isSelected = prev.some(r => r.id === record.id);
      if (isSelected) {
        return prev.filter(r => r.id !== record.id);
      } else {
        return [...prev, record];
      }
    });
  };

  const getSignedUrl = async (record: Record): Promise<string> => {
    if (record.file_url.startsWith('http')) {
      return record.file_url;
    }
    // For Supabase storage URLs, we need to get a signed URL
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.storage
      .from("medical-records")
      .createSignedUrl(record.file_url, 3600);
    return data?.signedUrl || record.file_url;
  };

  // Analyze multiple PDFs
  const analyzeMultiplePDFs = async () => {
    if (selectedRecords.length === 0) {
      toast.error("Please select at least one record");
      return;
    }

    setIsAnalyzing(true);
    setMessages(prev => [...prev, {
      role: "user",
      content: `Analyze ${selectedRecords.length} selected reports (${analysisType} analysis)`
    }]);

    try {
      // Get signed URLs for all selected records
      const filesWithUrls = await Promise.all(
        selectedRecords.map(async (record) => ({
          file_url: await getSignedUrl(record),
          title: record.title
        }))
      );

      const response = await fetch(`${AI_BACKEND_URL}/analyze-multiple-pdfs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: filesWithUrls,
          patient_id: patientId,
          analysis_type: analysisType
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.analysis,
          type: "analysis"
        }]);
        toast.success(`Analyzed ${data.documents_analyzed} documents`);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.analysis || "Could not complete analysis. Please try again."
        }]);
        toast.error("Analysis failed");
      }
    } catch (error) {
      console.error("Multi-analysis error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Failed to connect to AI service. Please try again."
      }]);
      toast.error("Connection error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Chat with AI about multiple reports
  const handleSend = async () => {
    if (!input.trim() || isLoading || selectedRecords.length === 0) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Get signed URLs for all selected records
      const filesWithUrls = await Promise.all(
        selectedRecords.map(async (record) => ({
          file_url: await getSignedUrl(record),
          title: record.title
        }))
      );

      const response = await fetch(`${AI_BACKEND_URL}/multi-pdf-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          files: filesWithUrls,
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
MULTI-REPORT CLINICAL ANALYSIS
==============================
Patient: ${patientName}
Reports Analyzed: ${selectedRecords.map(r => r.title).join(", ")}
Analysis Type: ${analysisType}
Date: ${new Date().toLocaleString()}

ANALYSIS NOTES:
${messages.map(m => `${m.role === 'user' ? 'Doctor' : 'AI Assistant'}: ${m.content}`).join('\n\n')}

---
Generated from Care Access Pro
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MultiReport_Analysis_${patientName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Analysis exported!");
  };

  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case "comparative": return <BarChart3 className="h-4 w-4" />;
      case "timeline": return <Clock className="h-4 w-4" />;
      default: return <Layers className="h-4 w-4" />;
    }
  };

  return (
    <Card 
      className="w-full max-w-4xl mx-auto shadow-xl border-0 bg-white max-h-[95vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="h-6 w-6" />
            <div>
              <CardTitle className="text-lg font-semibold">Multi-Report Analysis</CardTitle>
              <p className="text-purple-100 text-sm mt-1">
                Patient: {patientName} • {selectedRecords.length} report(s) selected
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-white hover:bg-purple-500/30"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
        {/* Record Selection */}
        <div className="mb-4 pb-4 border-b">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            Select Reports to Analyze
          </h4>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {records.map((record) => (
              <div
                key={record.id}
                onClick={() => toggleRecordSelection(record)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer text-sm transition-all ${
                  selectedRecords.some(r => r.id === record.id)
                    ? 'bg-purple-100 border-purple-300 border-2 text-purple-700'
                    : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Checkbox 
                  checked={selectedRecords.some(r => r.id === record.id)}
                  className="h-3 w-3"
                />
                <span className="truncate max-w-[150px]">{record.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Type Selection */}
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
          <span className="text-sm font-medium text-gray-600 mr-2 self-center">Analysis Type:</span>
          
          <Button
            onClick={() => setAnalysisType("comprehensive")}
            variant={analysisType === "comprehensive" ? "default" : "outline"}
            size="sm"
            className={analysisType === "comprehensive" 
              ? "bg-purple-600 hover:bg-purple-700" 
              : "hover:bg-purple-50"}
          >
            <Layers className="h-4 w-4 mr-1" />
            Comprehensive
          </Button>
          
          <Button
            onClick={() => setAnalysisType("comparative")}
            variant={analysisType === "comparative" ? "default" : "outline"}
            size="sm"
            className={analysisType === "comparative" 
              ? "bg-blue-600 hover:bg-blue-700" 
              : "hover:bg-blue-50"}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Comparative
          </Button>
          
          <Button
            onClick={() => setAnalysisType("timeline")}
            variant={analysisType === "timeline" ? "default" : "outline"}
            size="sm"
            className={analysisType === "timeline" 
              ? "bg-green-600 hover:bg-green-700" 
              : "hover:bg-green-50"}
          >
            <Clock className="h-4 w-4 mr-1" />
            Timeline
          </Button>

          <div className="flex-1" />
          
          <Button
            onClick={analyzeMultiplePDFs}
            disabled={isAnalyzing || isLoading || selectedRecords.length === 0}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Analyze {selectedRecords.length} Report{selectedRecords.length !== 1 ? 's' : ''}
          </Button>
        </div>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto pr-2 scrollbar-visible"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#9333ea #f1f5f9'
          }}
        >
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Multi-Report AI Analysis</p>
              <p className="text-sm mt-2">
                Select reports above, choose analysis type, and click "Analyze" to get started.
              </p>
              <div className="mt-4 text-xs text-gray-400 space-y-1">
                <p>• <strong>Comprehensive</strong>: Full analysis of all findings</p>
                <p>• <strong>Comparative</strong>: Compare values across reports</p>
                <p>• <strong>Timeline</strong>: Track health progression over time</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : msg.type === 'analysis'
                        ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200'
                        : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === 'user' ? (
                        <UserIcon className="h-4 w-4" />
                      ) : msg.type === 'analysis' ? (
                        getAnalysisTypeIcon(analysisType)
                      ) : (
                        <Stethoscope className="h-4 w-4 text-purple-600" />
                      )}
                      <span className="text-xs font-medium opacity-70">
                        {msg.role === 'user' ? 'You' : 
                         msg.type === 'analysis' ? `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis` : 
                         'AI Assistant'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
              {(isLoading || isAnalyzing) && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Button */}
        {messages.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={exportConversation}
              variant="outline"
              size="sm"
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Analysis
            </Button>
          </div>
        )}

        {/* Chat Input Area */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={selectedRecords.length === 0 
              ? "Select reports first..." 
              : "Ask questions about the selected reports..."}
            disabled={isLoading || isAnalyzing || selectedRecords.length === 0}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading || isAnalyzing || selectedRecords.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-500 flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>AI-assisted multi-report analysis for clinical reference only. Always apply professional medical judgment.</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorMultiAnalysisPanel;

// Ashmit contribution
