import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { DoctorApprovalCard } from "@/components/DoctorApprovalCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Activity, Database, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, activeSessions: 0 });

  useEffect(() => {
    if (!loading && !roles.includes('admin')) {
      toast.error("Access denied. Admin role required.");
      navigate("/");
    }
  }, [loading, roles, navigate]);

  useEffect(() => {
    if (roles.includes('admin')) {
      fetchUsers();
      fetchPendingDoctors();
      fetchAuditLogs();

      // Set up real-time subscription for doctors table
      const doctorsChannel = supabase
        .channel('doctors-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'doctors'
          },
          (payload) => {
            console.log('Doctor change detected:', payload);
            fetchPendingDoctors();
          }
        )
        .subscribe();

      // Cleanup on unmount
      return () => {
        supabase.removeChannel(doctorsChannel);
      };
    }
  }, [roles]);

  const fetchUsers = async () => {
    // Fetch profiles first
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*");
    
    if (profilesError) {
      toast.error("Failed to fetch users");
      console.error("Profiles error:", profilesError);
      return;
    }

    // Fetch user roles separately
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      console.error("Roles error:", rolesError);
    }

    // Merge roles into profiles
    const usersWithRoles = (profilesData || []).map(profile => {
      const userRoles = (rolesData || []).filter(r => r.user_id === profile.id);
      return {
        ...profile,
        user_roles: userRoles
      };
    });

    setUsers(usersWithRoles);
    setStats(prev => ({ ...prev, totalUsers: usersWithRoles.length }));
  };

  const fetchPendingDoctors = async () => {
    // Fetch pending doctors
    const { data: doctorsData, error: doctorsError } = await supabase
      .from("doctors")
      .select("*")
      .eq('approval_status', 'pending');
    
    if (doctorsError) {
      console.error("Failed to fetch pending doctors:", doctorsError);
      return;
    }

    // Get user IDs to fetch profiles
    const userIds = (doctorsData || []).map(d => d.user_id);
    
    if (userIds.length === 0) {
      setPendingDoctors([]);
      return;
    }

    // Fetch profiles for these doctors
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in('id', userIds);

    if (profilesError) {
      console.error("Failed to fetch doctor profiles:", profilesError);
    }

    // Merge profiles into doctors
    const doctorsWithProfiles = (doctorsData || []).map(doctor => {
      const profile = (profilesData || []).find(p => p.id === doctor.user_id);
      return {
        ...doctor,
        profiles: profile || { first_name: 'Unknown', last_name: '' }
      };
    });

    setPendingDoctors(doctorsWithProfiles);
  };

  const fetchAuditLogs = async () => {
    // Fetch audit logs
    const { data: logsData, error: logsError } = await supabase
      .from("audit_logs")
      .select("*")
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (logsError) {
      console.error("Failed to fetch audit logs:", logsError);
      return;
    }

    // Get unique user IDs from logs
    const userIds = [...new Set((logsData || []).map(log => log.user_id).filter(Boolean))];
    
    let profilesData: any[] = [];
    if (userIds.length > 0) {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in('id', userIds);
      
      if (profilesError) {
        console.error("Failed to fetch log profiles:", profilesError);
      }
      profilesData = data || [];
    }

    // Merge profiles into logs
    const logsWithProfiles = (logsData || []).map(log => {
      const profile = profilesData.find(p => p.id === log.user_id);
      return {
        ...log,
        profiles: profile || null
      };
    });

    setAuditLogs(logsWithProfiles);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Admin Portal" role="admin" />
      
      <main className="container mx-auto px-4 py-8">
        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Total registered</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingDoctors.length}</div>
              <p className="text-xs text-muted-foreground">Doctor applications</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">Optimal</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{auditLogs.length}</div>
              <p className="text-xs text-muted-foreground">Recent activities</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="doctors" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="doctors">Doctor Approvals</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Doctor Approvals Tab */}
          <TabsContent value="doctors">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Pending Doctor Approvals</CardTitle>
                <CardDescription>Review and approve doctor applications</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingDoctors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending doctor applications</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingDoctors.map((doctor) => (
                      <DoctorApprovalCard
                        key={doctor.id}
                        doctor={doctor}
                        profile={doctor.profiles}
                        onApprovalChange={fetchPendingDoctors}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage all system users and their access levels</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.first_name} {profile.last_name}
                        </TableCell>
                        <TableCell className="text-xs">{profile.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          {profile.user_roles?.map((ur: any) => (
                            <Badge key={ur.role} variant="outline" className="capitalize mr-1">
                              {ur.role.replace("_", " ")}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-secondary text-secondary-foreground">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => toast.info(`Viewing ${profile.first_name}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>System activity and security logs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {log.profiles?.first_name} {log.profiles?.last_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{log.resource}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
// Ashmit contribution
