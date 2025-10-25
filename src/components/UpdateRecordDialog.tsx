import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import OTPModal from "./OTPModal";

interface UpdateRecordDialogProps {
  open: boolean;
  onClose: () => void;
  record: {
    id: string;
    title: string;
    status: string;
  };
  onSuccess: () => void;
}

const UpdateRecordDialog = ({ open, onClose, record, onSuccess }: UpdateRecordDialogProps) => {
  const [title, setTitle] = useState(record.title);
  const [status, setStatus] = useState(record.status);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [otpId, setOtpId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestOTP = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-otp', {
        body: {
          action_type: 'update_record',
          resource_id: record.id,
        },
      });

      if (error) throw error;

      setOtpId(data.otp_id);
      setIsOTPModalOpen(true);
      toast.success("OTP sent successfully");
      // In development, show OTP
      if (data.otp) {
        toast.info(`Development OTP: ${data.otp}`);
      }
    } catch (error) {
      console.error('Error requesting OTP:', error);
      toast.error("Failed to send OTP");
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-otp', {
        body: {
          otp_code: otp,
          action_type: 'update_record',
        },
      });

      if (verifyError) throw verifyError;

      // Update record
      const { error: updateError } = await supabase.functions.invoke('update-record', {
        body: {
          record_id: record.id,
          otp_id: verifyData.otp_id,
          updates: {
            title,
            status,
          },
        },
      });

      if (updateError) throw updateError;

      toast.success("Record updated successfully");
      setIsOTPModalOpen(false);
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error updating record:', error);
      toast.error("Failed to update record");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Medical Record</DialogTitle>
            <DialogDescription>
              Update record information. This action requires OTP verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Record Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter record title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRequestOTP} className="w-full" disabled={isSubmitting}>
              Request OTP & Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OTPModal
        open={isOTPModalOpen}
        onClose={() => setIsOTPModalOpen(false)}
        onVerify={handleVerifyOTP}
        action="update this record"
      />
    </>
  );
};

export default UpdateRecordDialog;

// Ashmit contribution
