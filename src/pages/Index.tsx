import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // Redirect based on user role
      if (roles.includes("admin")) {
        navigate("/admin");
      } else if (roles.includes("hospital_manager")) {
        navigate("/hospital-manager");
      } else if (roles.includes("doctor")) {
        navigate("/doctor");
      } else if (roles.includes("patient")) {
        navigate("/patient");
      }
    }
  }, [user, roles, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <Activity className="h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="flex justify-center mb-8">
          <Activity className="h-20 w-20 text-primary animate-pulse" />
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight">
          Healthcare Records System
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Secure, efficient medical record management with role-based access for patients, doctors, and administrators.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="text-lg px-8"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-lg bg-card border">
            <h3 className="font-semibold text-lg mb-2">For Patients</h3>
            <p className="text-muted-foreground">Access and manage your medical records securely from anywhere.</p>
          </div>
          <div className="p-6 rounded-lg bg-card border">
            <h3 className="font-semibold text-lg mb-2">For Doctors</h3>
            <p className="text-muted-foreground">View patient records and upload new medical documents efficiently.</p>
          </div>
          <div className="p-6 rounded-lg bg-card border">
            <h3 className="font-semibold text-lg mb-2">For Administrators</h3>
            <p className="text-muted-foreground">Manage users, approve doctors, and oversee system operations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ashmit contribution
