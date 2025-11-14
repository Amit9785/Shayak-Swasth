import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRecords } from "@/hooks/useRecords";
import { useAppointments } from "@/hooks/useAppointments";
import DashboardHeader from "@/components/DashboardHeader";
import RecordCard from "@/components/RecordCard";
import { PatientSearch } from "@/components/PatientSearch";
import { UploadRecordDialog } from "@/components/UploadRecordDialog";
import UpdateRecordDialog from "@/components/UpdateRecordDialog";
import { AppointmentsList } from "@/components/AppointmentsList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building, FileText, AlertCircle, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const HospitalManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const { records, loading: recordsLoading, refreshRecords, deleteRecord } = useRecords(selectedPatient?.id);
  const { appointments, loading: appointmentsLoading } = useAppointments();
  const [stats, setStats] = useState({ totalRecords: 0, activePatients: 0 });
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("appointments"); // Default to appointments

  // Count pending appointments for the badge
  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  useEffect(() => {
    if (!loading && !roles.includes('hospital_manager')) {
      toast.error("Access denied. Hospital manager role required.");
      navigate("/");
    }
  }, [loading, roles, navigate]);

  useEffect(() => {
    if (roles.includes('hospital_manager')) {
      fetchStats();
    }
  }, [roles]);

  const fetchStats = async () => {
    console.log('Fetching stats for hospital manager...');
    
    const { data: recordData, error: recordError } = await supabase
      .from("records")
      .select("id", { count: 'exact' });
    
    console.log('Records query result:', { data: recordData, error: recordError });
    
    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("id", { count: 'exact' });

    console.log('Patients query result:', { data: patientData, error: patientError });

    setStats({
      totalRecords: recordData?.length || 0,
      activePatients: patientData?.length || 0,
    });
  };

  const handleDelete = async (recordId: string) => {
    if (confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      await deleteRecord(recordId);
      refreshRecords();
    }
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
  };

  const handleEditSuccess = () => {
    refreshRecords();
    setEditingRecord(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Hospital Manager Portal" role="hospital_manager" />
      
      <main className="container mx-auto px-4 py-8">
        {/* Security Notice */}
        <Card className="mb-8 border-accent shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-accent" />
              <CardTitle className="text-accent">Secure Access Mode</CardTitle>
            </div>
            <CardDescription>
              All sensitive operations require proper authentication for security compliance
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
              <div className="text-2xl font-bold">{stats.totalRecords}</div>
              <p className="text-xs text-muted-foreground">Across all departments</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePatients}</div>
              <p className="text-xs text-muted-foreground">Currently in system</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Appointments</CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingAppointments.length}</div>
              <p className="text-xs text-muted-foreground">Require approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Patient Search */}
        <Card className="mb-8 shadow-soft">
          <CardHeader>
            <CardTitle>Patient Search</CardTitle>
            <CardDescription>Search for patients to view their basic information. Access to medical records requires patient authorization.</CardDescription>
          </CardHeader>
          <CardContent>
            <PatientSearch onSelectPatient={setSelectedPatient} />
          </CardContent>
        </Card>

        {selectedPatient && (
          <Card className="mb-6 shadow-soft border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedPatient.profiles?.first_name 
                      ? `${selectedPatient.profiles.first_name} ${selectedPatient.profiles.last_name}`
                      : `Patient ${selectedPatient.medical_id}`}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{selectedPatient.medical_id}</span>
                    <span className="capitalize">{selectedPatient.gender}</span>
                    <span>Born: {new Date(selectedPatient.date_of_birth).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <UploadRecordDialog 
                    patientId={selectedPatient.id}
                    onSuccess={refreshRecords}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Access Notice</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      You can view basic patient information. To access detailed medical records, the patient must grant you authorization.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Appointments
              {pendingAppointments.length > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5">
                  {pendingAppointments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="patient">Patient Records</TabsTrigger>
            <TabsTrigger value="all">All Records</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-teal-600" />
                  Appointment Requests
                </CardTitle>
                <CardDescription>
                  Review and approve/reject patient appointment requests with doctors
                </CardDescription>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  </div>
                ) : (
                  <AppointmentsList 
                    appointments={appointments} 
                    isManager={true}
                    loading={appointmentsLoading}
                    onBookNew={() => {}}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patient">
            {!selectedPatient ? (
              <Card className="shadow-soft">
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    Search and select a patient to view their medical records
                  </p>
                </CardContent>
              </Card>
            ) : recordsLoading ? (
              <p>Loading records...</p>
            ) : records.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    No records found for this patient
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {records.map((record) => (
                  <RecordCard
                    key={record.id}
                    id={record.id}
                    title={record.title}
                    type="report"
                    uploadedBy="Hospital Manager"
                    uploadDate={new Date(record.upload_date).toLocaleDateString()}
                    status="processed"
                    canDelete={true}
                    canEdit={true}
                    onView={() => window.open(record.file_url, '_blank')}
                    onDownload={() => window.open(record.file_url, '_blank')}
                    onEdit={() => handleEdit(record)}
                    onDelete={() => handleDelete(record.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>All System Records</CardTitle>
                <CardDescription>Overview of all medical records in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Total records: {stats.totalRecords}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {editingRecord && (
        <UpdateRecordDialog
          open={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          record={editingRecord}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
};

export default HospitalManagerDashboard;
// Ashmit contribution
