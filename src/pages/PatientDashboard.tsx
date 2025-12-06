import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import RecordCard from "@/components/RecordCard";
import ReportSummary from "@/components/ReportSummary";
import BookAppointmentDialog from "@/components/BookAppointmentDialog";
import AppointmentsList from "@/components/AppointmentsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, FileText, Calendar, Heart, Activity, 
  Shield, Clock, TrendingUp, Phone, MapPin, Droplets,
  FileImage, FileType, Stethoscope, AlertCircle, BookOpen, CalendarCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments } from "@/hooks/useAppointments";
import type { Record } from "@/lib/types";

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const { appointments, loading: appointmentsLoading, fetchAppointments } = useAppointments();
  const [records, setRecords] = useState<Record[]>([]);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showBookAppointment, setShowBookAppointment] = useState(false);
  const [activeTab, setActiveTab] = useState("records");

  useEffect(() => {
    if (!loading && (!user || !roles.includes("patient"))) {
      navigate("/auth");
    }
  }, [user, roles, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPatientInfo();
      fetchRecords();
    }
  }, [user]);

  const fetchPatientInfo = async () => {
    if (!user) return;

    try {
      // Fetch patient data - use maybeSingle() to handle 0 or 1 result gracefully
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (patientError) {
        console.error("Error fetching patient:", patientError);
        toast.error("Failed to load patient information");
        return;
      }

      if (!patientData) {
        console.log("No patient record found for this user");
        return;
      }

      // Fetch profile data separately
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      }

      // Combine patient and profile data
      setPatientInfo({
        ...patientData,
        profiles: profileData || null
      });
    } catch (error) {
      console.error("Error in fetchPatientInfo:", error);
      toast.error("Failed to load patient information");
    }
  };

  const fetchRecords = async () => {
    if (!user) return;

    const { data: patientData } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!patientData) return;

    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("patient_id", patientData.id)
      .eq("status", "active")
      .order("upload_date", { ascending: false });

    if (error) {
      toast.error("Failed to load records");
      return;
    }
    setRecords(data || []);
  };


  const handleAskAI = (record?: Record) => {
    if (record) {
      setSelectedRecord(record);
      setShowSummary(true);
    }
  };

  const handleViewRecord = async (record: Record) => {
    // Check if file_url is already a full URL
    if (record.file_url.startsWith('http')) {
      window.open(record.file_url, "_blank");
      return;
    }
    
    // Otherwise, create a signed URL from the path
    const { data } = await supabase.storage
      .from("medical-records")
      .createSignedUrl(record.file_url, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Failed to open record");
    }
  };

  const handleDownloadRecord = async (record: Record) => {
    // Extract the file path from the URL if it's a full URL
    let filePath = record.file_url;
    if (filePath.startsWith('http')) {
      // Extract path after '/medical-records/'
      const match = filePath.match(/\/medical-records\/(.+)$/);
      if (match) {
        filePath = match[1];
      } else {
        // If it's a full public URL, just open it
        window.open(record.file_url, "_blank");
        return;
      }
    }
    
    const { data } = await supabase.storage
      .from("medical-records")
      .download(filePath);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.title;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error("Failed to download record");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalRecords = records.length;
  const recentRecords = records.filter(r => {
    const uploadDate = new Date(r.upload_date || "");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return uploadDate > thirtyDaysAgo;
  }).length;
  
  const recordTypes = {
    pdf: records.filter(r => r.file_type === 'pdf').length,
    image: records.filter(r => r.file_type === 'image').length,
    report: records.filter(r => r.file_type === 'report').length,
    dicom: records.filter(r => r.file_type === 'dicom').length,
  };

  // Calculate age
  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || 'P';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <DashboardHeader title="Patient Portal" role="patient" />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section with Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-2xl font-bold">
                    {patientInfo ? getInitials(patientInfo.profiles?.first_name, patientInfo.profiles?.last_name) : 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                      Welcome back, {patientInfo?.profiles?.first_name || 'Patient'}!
                    </h1>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Your health information is secure and up to date.
                  </p>
                  {patientInfo && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-full">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{calculateAge(patientInfo.date_of_birth)} years old</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-full">
                        <Droplets className="h-4 w-4 text-red-500" />
                        <span>{patientInfo.blood_type || 'Blood type N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                        <span className="capitalize">{patientInfo.gender}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => toast.info("Feature coming soon!")}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Health Resources
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowBookAppointment(true)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Book Appointment
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setActiveTab("appointments")}
              >
                <Stethoscope className="mr-2 h-4 w-4" />
                View Appointments
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-3xl font-bold text-primary">{totalRecords}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recent (30 days)</p>
                  <p className="text-3xl font-bold text-green-600">{recentRecords}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reports</p>
                  <p className="text-3xl font-bold text-blue-600">{recordTypes.report + recordTypes.pdf}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileType className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Images/Scans</p>
                  <p className="text-3xl font-bold text-orange-600">{recordTypes.image + recordTypes.dicom}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <FileImage className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patient Details Card */}
        {patientInfo && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Health Profile
              </CardTitle>
              <CardDescription>Your personal health information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <User className="h-4 w-4" />
                    Full Name
                  </div>
                  <p className="font-semibold">
                    {patientInfo.profiles?.first_name} {patientInfo.profiles?.last_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Shield className="h-4 w-4" />
                    Medical ID
                  </div>
                  <p className="font-semibold font-mono text-primary">{patientInfo.medical_id}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4" />
                    Date of Birth
                  </div>
                  <p className="font-semibold">
                    {new Date(patientInfo.date_of_birth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Droplets className="h-4 w-4" />
                    Blood Type
                  </div>
                  <div className="font-semibold">
                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                      {patientInfo.blood_type || "Not specified"}
                    </Badge>
                  </div>
                </div>
                {patientInfo.emergency_contact && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Phone className="h-4 w-4" />
                      Emergency Contact
                    </div>
                    <p className="font-semibold">{patientInfo.emergency_contact}</p>
                  </div>
                )}
                {patientInfo.address && (
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <MapPin className="h-4 w-4" />
                      Address
                    </div>
                    <p className="font-semibold">{patientInfo.address}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Summary Modal */}
        {showSummary && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <ReportSummary
              recordId={selectedRecord.id}
              recordTitle={selectedRecord.title}
              recordFileUrl={selectedRecord.file_url}
              recordFileType={selectedRecord.file_type}
              patientId={user?.id || ""}
              onClose={() => {
                setShowSummary(false);
                setSelectedRecord(null);
              }}
            />
          </div>
        )}

        {/* Main Content Tabs - Records & Appointments */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
                <TabsTrigger value="records" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Medical Records ({totalRecords})
                </TabsTrigger>
                <TabsTrigger value="appointments" className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  Appointments ({appointments.filter(a => a.status !== 'cancelled' && a.status !== 'completed').length})
                </TabsTrigger>
              </TabsList>

              {/* Records Tab */}
              <TabsContent value="records">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Medical Records
                  </h3>
                  <p className="text-sm text-muted-foreground">View and manage your health documents</p>
                </div>

                {records.length === 0 ? (
                  <div className="text-center py-16 bg-muted/30 rounded-lg">
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Records Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Your medical records will appear here once uploaded by your healthcare provider.
                    </p>
                    <Button variant="outline" onClick={() => toast.info("Contact your healthcare provider to upload records")}>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Learn More
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {records.map((record) => (
                      <div key={record.id} className="group">
                        <RecordCard
                          id={record.id}
                          title={record.title}
                          type={record.file_type as "pdf" | "image" | "report" | "dicom"}
                          uploadedBy="Healthcare Provider"
                          uploadDate={new Date(record.upload_date || "").toLocaleDateString()}
                          status={record.status as "processed" | "processing" | "pending"}
                          canShare={true}
                          onView={() => handleViewRecord(record)}
                          onDownload={() => handleDownloadRecord(record)}
                          onShare={() => toast.info(`Sharing ${record.title}`)}
                        />
                        {(record.file_type === 'pdf' || record.file_type === 'report') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAskAI(record)}
                            className="w-full mt-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200"
                          >
                            <BookOpen className="mr-2 h-4 w-4 text-blue-600" />
                            <span className="text-blue-600">Get Summary</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Appointments Tab */}
              <TabsContent value="appointments">
                <AppointmentsList
                  appointments={appointments}
                  loading={appointmentsLoading}
                  onBookNew={() => setShowBookAppointment(true)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Book Appointment Dialog */}
        <BookAppointmentDialog
          isOpen={showBookAppointment}
          onClose={() => setShowBookAppointment(false)}
          onSuccess={() => {
            fetchAppointments();
            setActiveTab("appointments");
          }}
        />

        {/* Health Tips Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Heart className="h-5 w-5" />
              Health Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/60 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">💧 Stay Hydrated</h4>
                <p className="text-sm text-green-700">Drink at least 8 glasses of water daily for optimal health.</p>
              </div>
              <div className="bg-white/60 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">🏃 Stay Active</h4>
                <p className="text-sm text-green-700">30 minutes of exercise daily can improve your overall wellbeing.</p>
              </div>
              <div className="bg-white/60 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">😴 Sleep Well</h4>
                <p className="text-sm text-green-700">Aim for 7-9 hours of quality sleep each night.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PatientDashboard;
