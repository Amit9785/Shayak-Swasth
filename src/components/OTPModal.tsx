import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface OTPModalProps {
  open: boolean;
  onClose: () => void;
  onVerify: (otp: string) => void;
  action: string;
}

const OTPModal = ({ open, onClose, onVerify, action }: OTPModalProps) => {
  const [otp, setOtp] = useState("");
  const [isResending, setIsResending] = useState(false);

  const handleVerify = () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }
    onVerify(otp);
    setOtp("");
  };

  const handleResend = () => {
    setIsResending(true);
    setTimeout(() => {
      setIsResending(false);
      toast.success("New OTP sent!");
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent" />
            OTP Verification Required
          </DialogTitle>
          <DialogDescription>
            This action requires additional verification. Enter the OTP sent to your registered phone number.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="otp-input">
              Enter OTP to <strong>{action}</strong>
            </Label>
            <Input
              id="otp-input"
              type="text"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleResend}
              disabled={isResending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
              Resend OTP
            </Button>
            <Button
              className="flex-1"
              onClick={handleVerify}
              disabled={otp.length !== 6}
            >
              <Lock className="mr-2 h-4 w-4" />
              Verify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTPModal;
