import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2, Download, X, CheckCircle2, AlertCircle, Info, Pill, Calendar, Stethoscope } from "lucide-react";
import { toast } from "sonner";

// Backend URL
const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://localhost:8000";

interface ReportSummaryProps {
  recordId: string;
  recordTitle: string;
  recordFileUrl: string;
  recordFileType: string;
  patientId: string;
  onClose: () => void;
}

interface SummarySection {
  title: string;
  icon: React.ReactNode;
  content: string;
}

const ReportSummary = ({ 
  recordId, 
  recordTitle, 
  recordFileUrl, 
  recordFileType, 
  patientId,
  onClose 
}: ReportSummaryProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [sections, setSections] = useState<SummarySection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseSummaryIntoSections = (summaryText: string): SummarySection[] => {
    const sectionsList: SummarySection[] = [];
    
    // Try to parse structured sections from the summary
    const overviewMatch = summaryText.match(/(?:📋|OVERVIEW|What This Report Is About)[:\s]*([^📌🔬💊📅⚠️]*)/i);
    const findingsMatch = summaryText.match(/(?:🔬|KEY FINDINGS|Main Findings)[:\s]*([^📌💊📅⚠️]*)/i);
    const medicationsMatch = summaryText.match(/(?:💊|MEDICATIONS|Medicines)[:\s]*([^📌🔬📅⚠️]*)/i);
    const nextStepsMatch = summaryText.match(/(?:📅|NEXT STEPS|What To Do Next)[:\s]*([^📌🔬💊⚠️]*)/i);
    const importantMatch = summaryText.match(/(?:⚠️|IMPORTANT|Things to Watch)[:\s]*([^📌🔬💊📅]*)/i);

    if (overviewMatch || findingsMatch || medicationsMatch || nextStepsMatch || importantMatch) {
      if (overviewMatch && overviewMatch[1]?.trim()) {
        sectionsList.push({
          title: "What This Report Is About",
          icon: <Info className="h-5 w-5 text-blue-500" />,
          content: overviewMatch[1].trim()
        });
      }
      if (findingsMatch && findingsMatch[1]?.trim()) {
        sectionsList.push({
          title: "Main Findings",
          icon: <Stethoscope className="h-5 w-5 text-green-500" />,
          content: findingsMatch[1].trim()
        });
      }
      if (medicationsMatch && medicationsMatch[1]?.trim()) {
        sectionsList.push({
          title: "Medicines & Treatments",
          icon: <Pill className="h-5 w-5 text-purple-500" />,
          content: medicationsMatch[1].trim()
        });
      }
      if (nextStepsMatch && nextStepsMatch[1]?.trim()) {
        sectionsList.push({
          title: "What To Do Next",
          icon: <Calendar className="h-5 w-5 text-orange-500" />,
          content: nextStepsMatch[1].trim()
        });
      }
      if (importantMatch && importantMatch[1]?.trim()) {
        sectionsList.push({
          title: "Important Things to Watch",
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          content: importantMatch[1].trim()
        });
      }
    }

    return sectionsList;
  };

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    setSections([]);

    try {
      const response = await fetch(`${AI_BACKEND_URL}/summarize-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: recordFileUrl,
          title: recordTitle,
          patient_id: patientId
        })
      });

      const data = await response.json();

      if (data.success && data.summary) {
        setSummary(data.summary);
        const parsedSections = parseSummaryIntoSections(data.summary);
        setSections(parsedSections);
      } else {
        setError(data.summary || "Could not read this report. Please try again.");
      }
    } catch (err) {
      console.error("Summary error:", err);
      setError("Could not connect to the service. Please check your internet connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const exportSummary = () => {
    if (!summary) return;

    const exportContent = `
MEDICAL REPORT SUMMARY
======================
Report: ${recordTitle}
Date: ${new Date().toLocaleDateString()}

${summary}

---
This summary is for informational purposes only.
Always consult with your healthcare provider for medical advice.
    `.trim();

    const blob = new Blob([exportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Summary_${recordTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Summary downloaded successfully!");
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-0 bg-white">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6" />
            <div>
              <CardTitle className="text-lg font-semibold">Report Summary</CardTitle>
              <p className="text-blue-100 text-sm mt-1 truncate max-w-xs">{recordTitle}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-white hover:bg-blue-400/30"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {!summary && !isLoading && !error && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-10 w-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Get Easy-to-Read Summary
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Click below to get a simple summary of your medical report in plain language
            </p>
            <Button 
              onClick={generateSummary}
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-base"
            >
              <FileText className="h-5 w-5 mr-2" />
              Generate Summary
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Reading your report...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a few seconds</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Couldn't Read Report
            </h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button 
              onClick={generateSummary}
              variant="outline"
              className="mr-2"
            >
              Try Again
            </Button>
            <Button 
              onClick={onClose}
              variant="ghost"
            >
              Close
            </Button>
          </div>
        )}

        {summary && !isLoading && (
          <div className="space-y-4">
            {/* Success indicator */}
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Summary Ready</span>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              {/* If we have structured sections, show them nicely */}
              {sections.length > 0 ? (
                <div className="space-y-4">
                  {sections.map((section, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        {section.icon}
                        <h4 className="font-semibold text-gray-800">{section.title}</h4>
                      </div>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                /* Plain text summary if no structured sections detected */
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {summary}
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> This is a simplified summary to help you understand your report. 
                  Always discuss your results with your doctor for proper medical advice.
                </p>
              </div>
            </ScrollArea>

            {/* Export button */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={exportSummary}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Summary
              </Button>
              <Button 
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportSummary;

// Ashmit contribution
