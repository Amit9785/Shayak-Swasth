import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email?: string;
  phone?: string;
  roles: string[];
  patientId?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: any) => void;
  logout: () => void;
  getPatientId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (userData: any) => {
    // Extract user info from backend response
    const userObj: User = {
      id: userData.id,
      email: userData.email,
      phone: userData.phone,
      roles: userData.roles || [],
    };

    // If user is a patient, fetch patient profile to get patient_id
    if (userData.roles?.includes("patient")) {
      try {
        const { data } = await api.get<any>("/patients/me");
        if (data) {
          userObj.patientId = data.id;
        }
      } catch (error) {
        console.error("Failed to fetch patient profile:", error);
      }
    }

    setUser(userObj);
    localStorage.setItem("user", JSON.stringify(userObj));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    api.clearToken();
  };

  const getPatientId = (): string | null => {
    return user?.patientId || null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getPatientId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

