import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DoctorOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
}

const DoctorOTPModal = ({
  isOpen,
  onClose,
  onVerified,
  patientId,
  patientName,
  patientPhone,
  doctorId,
  doctorName
}: DoctorOTPModalProps) => {
  const [step, setStep] = useState<"request" | "verify" | "verified">("request");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setStep("request");
    setOtp("");
    setManualPhone("");
    setShowManualEntry(!patientPhone);
    onClose();
  };

  // On open, check if we need manual entry
  const getEffectivePhone = () => {
    if (patientPhone) return patientPhone;
    if (manualPhone) return manualPhone;
    return "";
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 4) return "****";
    return `****${phone.slice(-4)}`;
  };

  const requestOTP = async () => {
    const effectivePhone = getEffectivePhone();
    if (!effectivePhone) {
      toast.error("Please enter the patient's phone number");
      return;
    }

    setIsLoading(true);
    try {
      // Call the send-otp-sms edge function
      const { data, error } = await supabase.functions.invoke("send-otp-sms", {
        body: {
          patient_id: patientId,
          phone: effectivePhone,
          purpose: "doctor_access",
          requester_name: doctorName,
          requester_id: doctorId
        }
      });

      if (error) throw error;

      if (data?.success) {
        setMaskedPhone(maskPhone(effectivePhone));
        setStep("verify");
        toast.success("OTP sent to patient's phone");
      } else {
        throw new Error(data?.error || "Failed to send OTP");
      }
    } catch (error: any) {
      console.error("OTP request error:", error);
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: {
          patient_id: patientId,
          otp: otp,
          purpose: "doctor_access"
        }
      });

      if (error) throw error;

      if (data?.success) {
        setStep("verified");
        toast.success("Access granted!");
        
        // Log the access in audit trail (ignore errors)
        try {
          await supabase.from("audit_logs").insert({
            user_id: doctorId,
            action: "doctor_viewed_patient_records",
            resource: "patient_records",
            resource_id: patientId,
            details: {
              patient_id: patientId,
              patient_name: patientName,
              access_method: "otp_verified"
            }
          });
        } catch (e) {
          console.log("Audit log skipped");
        }

        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
        toast.error(data?.error || "Invalid OTP");
      }
    } catch (error: any) {
      console.error("OTP verify error:", error);
      toast.error(error.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600" />
            Patient Authorization Required
          </DialogTitle>
          <DialogDescription>
            To access {patientName}'s medical records, we need their consent via OTP verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "request" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">How it works:</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>An OTP will be sent to the patient's phone</li>
                  <li>Ask the patient to share the OTP with you</li>
                  <li>Enter the OTP to gain temporary access</li>
                </ol>
              </div>

              {patientPhone ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Patient's Phone</p>
                    <p className="text-xs text-gray-500">{maskPhone(patientPhone)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                      Patient phone not in system. Please enter manually.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manualPhone">Patient's Phone Number</Label>
                    <Input
                      id="manualPhone"
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the patient's phone number with country code (e.g., +91 for India)
                    </p>
                  </div>
                </div>
              )}

              <Button 
                onClick={requestOTP} 
                disabled={isLoading || (!patientPhone && !manualPhone)}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  "Request Patient Authorization"
                )}
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium">OTP Sent!</p>
                <p className="text-sm text-green-700 mt-1">
                  A 6-digit code was sent to {maskedPhone}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP from Patient</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <p className="text-xs text-gray-500 text-center">
                  Ask the patient to share the code they received
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep("request")}
                  className="flex-1"
                >
                  Resend OTP
                </Button>
                <Button 
                  onClick={verifyOTP}
                  disabled={isLoading || otp.length !== 6}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify & Access"
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "verified" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-800">Access Granted!</h3>
              <p className="text-sm text-gray-600 mt-2">
                You can now view {patientName}'s records
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DoctorOTPModal;
