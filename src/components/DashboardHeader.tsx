import { Button } from "@/components/ui/button";
import { Activity, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NotificationDropdown from "./NotificationDropdown";

interface DashboardHeaderProps {
  title: string;
  role: string;
}

const DashboardHeader = ({ title, role }: DashboardHeaderProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="border-b bg-card sticky top-0 z-50 shadow-soft">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground capitalize">{role} Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationDropdown />
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;

// Ashmit contribution
