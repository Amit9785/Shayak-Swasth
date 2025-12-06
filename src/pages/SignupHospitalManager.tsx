import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Building } from "lucide-react";

export default function SignupHospitalManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    phone: "",
    first_name: "",
    last_name: "",
    hospital_name: "",
    department: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            role: 'hospital_manager',
            hospital_name: formData.hospital_name,
            department: formData.department,
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Wait a moment for the auth to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({
          user_id: authData.user.id,
          role: 'hospital_manager'
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.log('Role insert:', roleError.message);
      }

      // Create hospital manager record
      const { error: managerError } = await supabase
        .from("hospital_managers")
        .upsert({
          user_id: authData.user.id,
          hospital_name: formData.hospital_name || 'Default Hospital',
          department: formData.department || null,
        }, { onConflict: 'user_id' });

      if (managerError) {
        console.log('Manager insert:', managerError.message);
      }

      // Update profile with phone
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone: formData.phone,
          first_name: formData.first_name,
          last_name: formData.last_name,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.log('Profile update:', profileError.message);
      }

      toast.success("Hospital manager account created! You can now login.");
      navigate("/auth");
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/auth")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Building className="h-12 w-12 text-primary" />
            </div>
            <CardTitle>Hospital Manager Registration</CardTitle>
            <CardDescription>
              Create a hospital manager account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hospital_name">Hospital Name *</Label>
                <Input
                  id="hospital_name"
                  value={formData.hospital_name}
                  onChange={(e) => handleChange("hospital_name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department (Optional)</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Create Manager Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
