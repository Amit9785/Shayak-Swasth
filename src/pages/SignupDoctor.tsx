import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function SignupDoctor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    phone: "",
    first_name: "",
    last_name: "",
    license_number: "",
    specialization: "",
    qualification: "",
    experience_years: "",
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
            role: 'doctor',
            license_number: formData.license_number,
            specialization: formData.specialization,
            qualification: formData.qualification,
            experience_years: formData.experience_years,
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
          role: 'doctor'
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.log('Role insert:', roleError.message);
      }

      // Create doctor record
      const { error: doctorError } = await supabase
        .from("doctors")
        .upsert({
          user_id: authData.user.id,
          license_number: formData.license_number,
          specialization: formData.specialization,
          qualification: formData.qualification,
          experience_years: parseInt(formData.experience_years) || null,
          approval_status: 'pending',
        }, { onConflict: 'user_id' });

      if (doctorError) {
        console.log('Doctor insert:', doctorError.message);
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

      toast.success("Application submitted! Please wait for admin approval.");
      navigate("/auth");
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-2xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/auth")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
        <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Doctor Application</CardTitle>
          <CardDescription>
            Submit your application. Admin approval is required before you can access the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-6">
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Professional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="license_number">Medical License Number</Label>
                  <Input
                    id="license_number"
                    value={formData.license_number}
                    onChange={(e) => handleChange("license_number", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => handleChange("specialization", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Textarea
                    id="qualification"
                    value={formData.qualification}
                    onChange={(e) => handleChange("qualification", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    min="0"
                    value={formData.experience_years}
                    onChange={(e) => handleChange("experience_years", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/auth")} className="flex-1">
                Back to Login
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
