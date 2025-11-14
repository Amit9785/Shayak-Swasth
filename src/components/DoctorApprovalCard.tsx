import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface DoctorApprovalCardProps {
  doctor: {
    id: string;
    license_number: string;
    specialization: string;
    qualification: string;
    experience_years: number | null;
    approval_status: string;
    user_id: string;
  };
  profile: {
    first_name: string;
    last_name: string;
  };
  onApprovalChange: () => void;
}

export function DoctorApprovalCard({ doctor, profile, onApprovalChange }: DoctorApprovalCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update doctor status directly
      const { error } = await supabase
        .from('doctors')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', doctor.id);

      if (error) throw error;

      // Log to audit (optional - don't fail if this fails)
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'approve_doctor',
          resource: 'doctors',
          resource_id: doctor.id,
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      toast.success(`Dr. ${profile.first_name} ${profile.last_name} approved successfully`);
      onApprovalChange();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(error.message || 'Failed to approve doctor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update doctor status directly
      const { error } = await supabase
        .from('doctors')
        .update({
          approval_status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', doctor.id);

      if (error) throw error;

      // Log to audit (optional)
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'reject_doctor',
          resource: 'doctors',
          resource_id: doctor.id,
          details: { reason },
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      toast.success(`Application from Dr. ${profile.first_name} ${profile.last_name} rejected`);
      onApprovalChange();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(error.message || 'Failed to reject doctor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Dr. {profile.first_name} {profile.last_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{doctor.specialization}</p>
          </div>
          <Badge variant={doctor.approval_status === 'pending' ? 'secondary' : 'outline'}>
            {doctor.approval_status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <p><strong>License:</strong> {doctor.license_number}</p>
          <p><strong>Qualification:</strong> {doctor.qualification}</p>
          {doctor.experience_years && (
            <p><strong>Experience:</strong> {doctor.experience_years} years</p>
          )}
        </div>

        {doctor.approval_status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleApprove}
              size="sm"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
            <Button 
              onClick={handleReject}
              size="sm"
              variant="destructive"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// Ashmit contribution
