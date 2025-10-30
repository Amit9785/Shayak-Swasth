import { useState, useEffect } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import RecordCard from "@/components/RecordCard";
import OTPModal from "@/components/OTPModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Search, Building, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const HospitalManagerDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [mockRecords, setMockRecords] = useState<any[]>([]);

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

  const handleSecureAction = async (action: string, file?: File, recordId?: string) => {
    setPendingAction(action);
    if (file) setPendingFile(file);
    if (recordId) setPendingRecordId(recordId);
    
    const { error } = await api.post("/manager/send-otp");
    if (error) {
      toast.error(error);
      return;
    }
    setShowOTPModal(true);
  };

  const handleOTPVerified = async (otp: string) => {
    const { error } = await api.post("/manager/verify-otp", { otp });
    if (error) {
      toast.error(error);
      return;
    }

    if (pendingAction.includes("Upload") && pendingFile) {
      // Get patient ID and title for upload
      const patientId = prompt("Enter Patient ID:");
      const title = prompt("Enter record title:", pendingFile.name) || pendingFile.name;
      
      if (!patientId) {
        toast.error("Patient ID is required");
        return;
      }
      
      const { error: uploadError } = await api.uploadMedicalRecord(
        pendingFile,
        patientId,
        title
      );
      if (uploadError) {
        toast.error(uploadError);
        return;
      }
      toast.success("Record uploaded and processing with AI agents!", { duration: 5000 });
      setPendingFile(null);
      fetchRecords();
    }
      const { error: deleteError } = await api.delete(`/records/${pendingRecordId}`);
      if (deleteError) {
        toast.error(deleteError);
        return;
      }
      toast.success("Record deleted successfully!");
      setPendingRecordId(null);
      fetchRecords();
    }
    
    setShowOTPModal(false);
    setPendingAction("");
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    const { data, error } = await api.get<any[]>(`/records/?search=${searchQuery}`);
    if (error) {
      toast.error(error);
      return;
    }
    if (data) setMockRecords(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Hospital Manager Portal" role="hospital_manager" notificationCount={8} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Security Notice */}
        <Card className="mb-8 border-accent shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-accent" />
              <CardTitle className="text-accent">Secure Access Mode</CardTitle>
            </div>
            <CardDescription>
              All sensitive operations require OTP verification for security compliance
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,284</div>
              <p className="text-xs text-muted-foreground">Across all departments</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">432</div>
              <p className="text-xs text-muted-foreground">Currently in system</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mb-8 flex gap-4 flex-wrap">
          <Button 
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.onchange = (e: any) => {
                const file = e.target?.files?.[0];
                if (file) handleSecureAction("Upload Record", file);
              };
              input.click();
            }}
            className="flex-1 min-w-[200px]"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Record (OTP Required)
          </Button>
          <div className="flex-1 min-w-[300px] flex gap-2">
            <Input
              placeholder="Search all records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Records */}
        <h2 className="text-2xl font-bold mb-6">All Patient Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockRecords.map((record) => (
            <RecordCard
              key={record.id}
              {...record}
              canDelete={true}
              onView={() => toast.info(`Viewing ${record.title}`)}
              onDownload={() => toast.info(`Downloading ${record.title}`)}
              onDelete={() => handleSecureAction(`Delete ${record.title}`, undefined, record.id)}
            />
          ))}
        </div>
      </main>

      <OTPModal
        open={showOTPModal}
        onClose={() => setShowOTPModal(false)}
        onVerify={handleOTPVerified}
        action={pendingAction}
      />
    </div>
  );
};

export default HospitalManagerDashboard;
