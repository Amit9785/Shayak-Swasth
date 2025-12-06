import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments } from "@/hooks/useAppointments";
import DashboardHeader from "@/components/DashboardHeader";
import RecordCard from "@/components/RecordCard";
import { PatientSearch } from "@/components/PatientSearch";
import DoctorOTPModal from "@/components/DoctorOTPModal";
import DoctorAIChatPanel from "@/components/DoctorAIChatPanel";
import DoctorMultiAnalysisPanel from "@/components/DoctorMultiAnalysisPanel";
import AppointmentsList from "@/components/AppointmentsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Users, FileText, TrendingUp, Shield, Lock, Eye, 
  Stethoscope, Calendar, User, Loader2, BookOpen, CalendarCheck, Layers
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Record } from "@/lib/types";

interface PatientAccess {
  patientId: string;
  grantedAt: Date;
  expiresAt: Date;
}

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const { appointments, loading: appointmentsLoading } = useAppointments();
  const [activeTab, setActiveTab] = useState("patients");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [patientAccesses, setPatientAccesses] = useState<Map<string, PatientAccess>>(new Map());
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showMultiAnalysisPanel, setShowMultiAnalysisPanel] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);

  useEffect(() => {
    if (!loading && !roles.includes('doctor')) {
      toast.error("Access denied. Doctor role required.");
      navigate("/");
    }
  }, [loading, roles, navigate]);

  // Lock body scroll when AI panel is open
  useEffect(() => {
    if (showAIPanel || showMultiAnalysisPanel) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAIPanel, showMultiAnalysisPanel]);

  useEffect(() => {
    if (user) {
      fetchDoctorProfile();
    }
  }, [user]);

  const fetchDoctorProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) {
      setDoctorProfile(data);
    }
  };

  const fetchRecords = async (patientId: string) => {
    setRecordsLoading(true);
    try {
      const { data, error } = await supabase
        .from("records")
        .select("*")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .order("upload_date", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast.error("Failed to load records");
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setRecords([]);
    const existingAccess = patientAccesses.get(patient.id);
    if (existingAccess && new Date() < existingAccess.expiresAt) {
      setAccessGranted(true);
      fetchRecords(patient.id);
    } else {
      setAccessGranted(false);
    }
  };

  const handleRequestAccess = () => {
    console.log('Selected patient:', selectedPatient);
    console.log('Patient profiles:', selectedPatient?.profiles);
    console.log('Patient phone:', selectedPatient?.profiles?.phone);
    
    // If phone is available, it will be used. If not, the modal allows manual entry
    setShowOTPModal(true);
  };

  const handleAccessGranted = () => {
    setShowOTPModal(false);
    setAccessGranted(true);
    const access: PatientAccess = {
      patientId: selectedPatient.id,
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    };
    setPatientAccesses(prev => new Map(prev).set(selectedPatient.id, access));
    fetchRecords(selectedPatient.id);
    toast.success("Access granted!");
  };

  const handleViewRecord = async (record: Record) => {
    if (record.file_url.startsWith('http')) {
      window.open(record.file_url, "_blank");
    } else {
      const { data } = await supabase.storage
        .from("medical-records")
        .createSignedUrl(record.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    }
  };

  const handleAnalyzeRecord = (record: Record) => {
    setSelectedRecord(record);
    setShowAIPanel(true);
  };

  const getDoctorName = () => {
    if (doctorProfile) {
      return "Dr. " + (doctorProfile.first_name || "") + " " + (doctorProfile.last_name || "");
    }
    return "Doctor";
  };

  const getPatientName = () => {
    if (selectedPatient?.profiles) {
      return (selectedPatient.profiles.first_name || "") + " " + (selectedPatient.profiles.last_name || "");
    }
    return selectedPatient?.medical_id || "Patient";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50">
      <DashboardHeader title="Doctor Portal" role="doctor" />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <Stethoscope className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Welcome, {getDoctorName()}</h1>
                <p className="text-teal-100 mt-1">Search for patients and access records with OTP verification</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Patients Accessed</CardTitle>
              <Users className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{patientAccesses.size}</div>
              <p className="text-xs text-muted-foreground">With verified consent</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Records Reviewed</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{records.length}</div>
              <p className="text-xs text-muted-foreground">Current patient</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Consultations</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">This session</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="patients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Patients
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Appointments
              {appointments.filter(a => a.status === 'confirmed').length > 0 && (
                <Badge className="ml-1 bg-teal-500 text-white text-xs px-1.5 py-0.5">
                  {appointments.filter(a => a.status === 'confirmed').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="patients" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                  Search Patients
                </CardTitle>
                <CardDescription>Search by medical ID. Access requires patient OTP verification.</CardDescription>
              </CardHeader>
              <CardContent>
                <PatientSearch onSelectPatient={handleSelectPatient} />
              </CardContent>
            </Card>

            {selectedPatient && (
              <Card className="border-0 shadow-lg border-l-4 border-l-teal-500">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-teal-100 flex items-center justify-center">
                        <User className="h-7 w-7 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{getPatientName()}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="font-mono">{selectedPatient.medical_id}</Badge>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(selectedPatient.date_of_birth).toLocaleDateString()}
                          </span>
                          <span className="capitalize">{selectedPatient.gender}</span>
                        </div>
                      </div>
                    </div>
                    {!accessGranted ? (
                      <Button onClick={handleRequestAccess} className="bg-teal-600 hover:bg-teal-700">
                        <Lock className="h-4 w-4 mr-2" />
                        Request Access (OTP)
                      </Button>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 px-3 py-1">
                        <Shield className="h-4 w-4 mr-1" />
                        Access Granted
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                {!accessGranted && (
                  <CardContent>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800">Authorization Required</h4>
                          <p className="text-sm text-amber-700 mt-1">
                            Click "Request Access" to send OTP to patient's phone. Patient must share OTP with you.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {selectedPatient && accessGranted && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Medical Records
                      </CardTitle>
                      <CardDescription>{getPatientName()}'s health documents</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {records.filter(r => r.file_type === 'pdf' || r.file_type === 'report').length > 1 && (
                        <Button
                          onClick={() => setShowMultiAnalysisPanel(true)}
                          variant="outline"
                          size="sm"
                          className="bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-purple-200"
                        >
                          <Layers className="h-4 w-4 mr-2 text-purple-600" />
                          <span className="text-purple-700">Multi-Report Analysis</span>
                        </Button>
                      )}
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <Eye className="h-3 w-3 mr-1" />
                        View Only
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {recordsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                    </div>
                  ) : records.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No records found for this patient</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {records.map((record) => (
                        <div key={record.id} className="space-y-2">
                          <RecordCard
                            id={record.id}
                            title={record.title}
                            type={record.file_type as "pdf" | "image" | "report" | "dicom"}
                            uploadedBy="Hospital Staff"
                            uploadDate={new Date(record.upload_date || "").toLocaleDateString()}
                            status={record.status as "processed" | "processing" | "pending"}
                            canShare={false}
                            onView={() => handleViewRecord(record)}
                            onDownload={() => handleViewRecord(record)}
                          />
                          {(record.file_type === 'pdf' || record.file_type === 'report') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAnalyzeRecord(record)}
                              className="w-full bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 border-teal-200"
                            >
                              <BookOpen className="mr-2 h-4 w-4 text-teal-600" />
                              <span className="text-teal-700">Analyze with AI</span>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedPatient && (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <h3 className="text-lg font-medium mb-2">No Patient Selected</h3>
                  <p className="text-muted-foreground">Search for a patient above to view their records</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-teal-600" />
                  My Appointments
                </CardTitle>
                <CardDescription>View your confirmed appointments and mark them as complete</CardDescription>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  </div>
                ) : (
                  <AppointmentsList 
                    appointments={appointments.filter(a => a.status === 'confirmed' || a.status === 'completed')} 
                    isDoctor={true}
                    loading={appointmentsLoading}
                    onBookNew={() => {}}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <DoctorOTPModal
        isOpen={showOTPModal}
        onClose={() => setShowOTPModal(false)}
        onVerified={handleAccessGranted}
        patientId={selectedPatient?.id || ""}
        patientName={getPatientName()}
        patientPhone={selectedPatient?.profiles?.phone || ""}
        doctorId={user?.id || ""}
        doctorName={getDoctorName()}
      />

      {showAIPanel && selectedRecord && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-hidden"
          onClick={(e) => {
            // Close when clicking outside the panel
            if (e.target === e.currentTarget) {
              setShowAIPanel(false);
              setSelectedRecord(null);
            }
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <DoctorAIChatPanel
            recordId={selectedRecord.id}
            recordTitle={selectedRecord.title}
            recordFileUrl={selectedRecord.file_url}
            recordFileType={selectedRecord.file_type}
            patientId={selectedPatient?.id || ""}
            patientName={getPatientName()}
            onClose={() => {
              setShowAIPanel(false);
              setSelectedRecord(null);
            }}
          />
        </div>
      )}

      {showMultiAnalysisPanel && records.length > 0 && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMultiAnalysisPanel(false);
            }
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <DoctorMultiAnalysisPanel
            records={records.filter(r => r.file_type === 'pdf' || r.file_type === 'report')}
            patientId={selectedPatient?.id || ""}
            patientName={getPatientName()}
            onClose={() => setShowMultiAnalysisPanel(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
