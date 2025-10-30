import { useState, useEffect } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import RecordCard from "@/components/RecordCard";
import AIChatPanel from "@/components/AIChatPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, User, FileText, Bot } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const PatientDashboard = () => {
  const [mockRecords, setMockRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const { getPatientId } = useAuth();

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const { data, error } = await api.get<any[]>("/records/");
    if (error) {
      toast.error(error);
      return;
    }
    if (data) setMockRecords(data);
  };

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      
      const patientId = getPatientId();
      if (!patientId) {
        toast.error("Patient profile not found. Please complete your profile or re-login.");
        return;
      }
      const title = prompt("Enter a title for this medical record:", file.name) || file.name;
      
      toast.info("Uploading and processing with AI agents...");
      
      const { data, error } = await api.uploadMedicalRecord(file, patientId, title);
      if (error) {
        toast.error(error);
        return;
      }
      
      toast.success(
        data?.message || "Record uploaded! AI agents are processing your document.",
        { duration: 5000 }
      );
      fetchRecords();
    };
    input.click();
  };

  const handleAskAI = (record?: any) => {
    setSelectedRecord(record || null);
    setShowAIChat(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Patient Portal" role="patient" notificationCount={3} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Profile Summary */}
        <Card className="mb-8 shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <CardTitle>John Doe</CardTitle>
                <CardDescription>Medical ID: PT-2024-001</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-semibold">January 15, 1990</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-semibold">Male</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Blood Type</p>
                <p className="font-semibold">A+</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mb-8 flex gap-4 flex-wrap">
          <Button onClick={handleUpload} className="flex-1 min-w-[200px]">
            <Upload className="mr-2 h-4 w-4" />
            Upload Report
          </Button>
          <Button 
            onClick={() => handleAskAI()} 
            variant="outline"
            className="flex-1 min-w-[200px]"
          >
            <Bot className="mr-2 h-4 w-4" />
            Ask AI About My Records
          </Button>
        </div>

        {/* AI Chat Panel */}
        {showAIChat && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">AI Medical Assistant</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAIChat(false)}>
                Close
              </Button>
            </div>
            <div className="h-[500px]">
              <AIChatPanel 
                recordId={selectedRecord?.id}
                recordTitle={selectedRecord?.title}
              />
            </div>
          </div>
        )}

        {/* Records */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Records</TabsTrigger>
            <TabsTrigger value="shared">Shared with Doctors</TabsTrigger>
            <TabsTrigger value="uploaded">My Uploads</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockRecords.map((record) => (
                <div key={record.id}>
                  <RecordCard
                    {...record}
                    canShare={true}
                    onView={() => toast.info(`Viewing ${record.title}`)}
                    onDownload={() => toast.info(`Downloading ${record.title}`)}
                    onShare={() => toast.info(`Sharing ${record.title}`)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAskAI(record)}
                    className="w-full mt-2"
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Ask AI About This Report
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shared">
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No records shared with doctors yet</p>
            </div>
          </TabsContent>

          <TabsContent value="uploaded">
            <div className="text-center py-12 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No uploaded records yet</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PatientDashboard;
