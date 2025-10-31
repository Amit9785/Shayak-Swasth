import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Phone, Shield, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useRecords } from '@/hooks/useRecords';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadRecordDialogProps {
  patientId: string;
  onSuccess?: () => void;
}

export function UploadRecordDialog({ patientId, onSuccess }: UploadRecordDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { uploadRecord } = useRecords();
  const { user, roles } = useAuth();
  
  // OTP verification states
  const [otpStep, setOtpStep] = useState<'form' | 'otp' | 'verified'>('form');
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpId, setOtpId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const isManager = roles.includes('hospital_manager');

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Fetch manager's phone number
  useEffect(() => {
    const fetchPhone = async () => {
      if (user && isManager) {
        const { data } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();
        
        if (data?.phone) {
          setPhoneNumber(data.phone);
        }
      }
    };
    fetchPhone();
  }, [user, isManager]);

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendOTP = async () => {
    if (!user || !phoneNumber) {
      toast.error('Phone number not found. Please update your profile.');
      return;
    }

    setOtpSending(true);
    try {
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      // Store OTP in database
      const { data, error } = await supabase
        .from('manager_otp')
        .insert({
          manager_id: user.id,
          otp_code: otpCode,
          action_type: 'upload_record',
          resource_id: patientId,
          expires_at: expiresAt.toISOString(),
          verified: false,
          used: false
        })
        .select()
        .single();

      if (error) throw error;

      setOtpId(data.id);

      // Try to send SMS via Supabase Edge Function
      try {
        const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-otp-sms', {
          body: { 
            phone: phoneNumber, 
            otp: otpCode,
            action: 'upload_record'
          }
        });

        if (smsError) {
          console.log('SMS service not configured, showing OTP in toast');
          // Show OTP in toast for development/testing
          toast.info(`Development Mode - OTP: ${otpCode}`, { duration: 15000 });
        } else if (smsResult?.dev_mode) {
          // SMS not configured, show in toast
          toast.info(`Development Mode - OTP: ${otpCode}`, { duration: 15000 });
        }
      } catch (smsErr) {
        console.log('SMS function not deployed, showing OTP in toast');
        // Show OTP in toast for development/testing
        toast.info(`Development Mode - OTP: ${otpCode}`, { duration: 15000 });
      }

      toast.success(`OTP sent to ${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-3)}`);
      
      setOtpStep('otp');
      setCountdown(60); // 60 second countdown for resend
    } catch (error: any) {
      console.error('Failed to send OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOTP = async () => {
    if (!otpId || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setOtpVerifying(true);
    try {
      // Verify OTP from database
      const { data, error } = await supabase
        .from('manager_otp')
        .select('*')
        .eq('id', otpId)
        .eq('otp_code', otp)
        .eq('verified', false)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        toast.error('Invalid or expired OTP. Please try again.');
        return;
      }

      // Mark OTP as verified
      await supabase
        .from('manager_otp')
        .update({ verified: true })
        .eq('id', otpId);

      toast.success('OTP verified successfully!');
      setOtpStep('verified');
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !title) return;

    // For managers, require OTP verification first
    if (isManager && otpStep !== 'verified') {
      toast.error('Please verify OTP before uploading');
      return;
    }

    setUploading(true);
    try {
      // Mark OTP as used
      if (otpId) {
        await supabase
          .from('manager_otp')
          .update({ used: true })
          .eq('id', otpId);
      }

      await uploadRecord(patientId, title, file);
      
      // Reset all states
      setOpen(false);
      setTitle('');
      setFile(null);
      setOtpStep('form');
      setOtp('');
      setOtpId(null);
      
      onSuccess?.();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset states when closing
      setOtpStep('form');
      setOtp('');
      setOtpId(null);
      setTitle('');
      setFile(null);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Record
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isManager && otpStep === 'otp' ? (
              <>
                <Phone className="h-5 w-5 text-primary" />
                Phone OTP Verification
              </>
            ) : isManager && otpStep === 'verified' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Verified - Upload Record
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Upload Medical Record
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isManager && otpStep === 'otp' 
              ? "Enter the 6-digit OTP sent to your phone number for verification."
              : "Upload a medical record for this patient."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Form (for non-managers, this is the only step) */}
        {(otpStep === 'form' || otpStep === 'verified') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Show verified badge for managers */}
            {isManager && otpStep === 'verified' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium">Identity verified via Phone OTP</span>
              </div>
            )}

            <div>
              <Label htmlFor="title">Record Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Blood Test Results"
                required
              />
            </div>
            <div>
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Supported formats: PDF, JPG, PNG, DOC, DOCX
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              
              {/* For managers who haven't verified OTP yet */}
              {isManager && otpStep === 'form' ? (
                <Button 
                  type="button" 
                  onClick={sendOTP}
                  disabled={otpSending || !file || !title}
                >
                  {otpSending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Verify & Upload
                    </>
                  )}
                </Button>
              ) : (
                <Button type="submit" disabled={uploading || !file || !title}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              )}
            </div>
          </form>
        )}

        {/* Step 2: OTP Verification (only for managers) */}
        {isManager && otpStep === 'otp' && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Phone className="h-10 w-10 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                OTP sent to <strong>{phoneNumber?.slice(0, 3)}****{phoneNumber?.slice(-3)}</strong>
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="otp-input">Enter 6-digit OTP</Label>
              <Input
                id="otp-input"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={sendOTP}
                disabled={countdown > 0 || otpSending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${otpSending ? 'animate-spin' : ''}`} />
                {countdown > 0 ? `Resend (${countdown}s)` : 'Resend OTP'}
              </Button>
              <Button
                className="flex-1"
                onClick={verifyOTP}
                disabled={otp.length !== 6 || otpVerifying}
              >
                {otpVerifying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Verify OTP
                  </>
                )}
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setOtpStep('form')}
            >
              ← Back to form
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
// Ashmit contribution
