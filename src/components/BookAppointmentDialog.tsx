import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, Clock, Stethoscope, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { format, addDays, startOfToday, getDay } from "date-fns";
import { useAppointments } from "@/hooks/useAppointments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BookAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface AvailableSlot {
  slot_time: string;
  is_available: boolean;
  consecutive_slots: number;
}

// Appointment types with their durations
const APPOINTMENT_TYPES = [
  { value: 'consultation', label: '🩺 Consultation', duration: 5, description: '5 min - Quick medical advice' },
  { value: 'follow_up', label: '🔄 Follow-up', duration: 10, description: '10 min - Review previous treatment' },
  { value: 'checkup', label: '✅ Regular Checkup', duration: 10, description: '10 min - Routine health check' },
  { value: 'emergency', label: '🚨 Emergency', duration: null, description: 'Variable - Urgent care (shifts other appointments)' },
];

// Default time slots (fallback if RPC function not available)
const DEFAULT_TIME_SLOTS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
];

// Generate next 14 working days for date selection (excluding weekends)
const getNextDays = () => {
  const days = [];
  const today = startOfToday();
  let daysAdded = 0;
  let i = 1;
  
  while (daysAdded < 14) {
    const date = addDays(today, i);
    const dayOfWeek = getDay(date);
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push({
        value: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE, MMM d'),
        dayOfWeek,
      });
      daysAdded++;
    }
    i++;
  }
  return days;
};

// Format time for display
const formatTimeDisplay = (timeStr: string) => {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parts[1] || '00';
  const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
};

export function BookAppointmentDialog({ isOpen, onClose, onSuccess }: BookAppointmentDialogProps) {
  const { doctors, bookAppointment } = useAppointments();
  const { toast } = useToast();
  
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [appointmentType, setAppointmentType] = useState<string>("consultation");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Emergency specific fields
  const [emergencyDuration, setEmergencyDuration] = useState<number>(15);

  const availableDates = getNextDays();
  const selectedAppointmentType = APPOINTMENT_TYPES.find(t => t.value === appointmentType);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDoctor("");
      setSelectedDate("");
      setSelectedTime("");
      setAppointmentType("consultation");
      setReason("");
      setAvailableSlots([]);
      setEmergencyDuration(15);
    }
  }, [isOpen]);

  // Reset time when date or type changes
  useEffect(() => {
    setSelectedTime("");
  }, [selectedDate, appointmentType]);

  // Fetch available slots when doctor and date are selected
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedDoctor || !selectedDate) {
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        // Try to use the RPC function (cast to any to handle missing type)
        const { data, error } = await (supabase.rpc as any)('get_available_slots', {
          p_doctor_id: selectedDoctor,
          p_date: selectedDate,
          p_appointment_type: appointmentType
        });

        if (error) {
          console.log('RPC not available, using fallback slots:', error.message);
          // Fallback to default time slots
          const fallbackSlots: AvailableSlot[] = DEFAULT_TIME_SLOTS.map(slot => ({
            slot_time: slot.value + ':00',
            is_available: true,
            consecutive_slots: 12 // Assume all slots available in fallback
          }));
          setAvailableSlots(fallbackSlots);
        } else if (Array.isArray(data)) {
          setAvailableSlots(data as AvailableSlot[]);
        } else {
          // Fallback if data is not an array
          const fallbackSlots: AvailableSlot[] = DEFAULT_TIME_SLOTS.map(slot => ({
            slot_time: slot.value + ':00',
            is_available: true,
            consecutive_slots: 12
          }));
          setAvailableSlots(fallbackSlots);
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
        // Use fallback
        const fallbackSlots: AvailableSlot[] = DEFAULT_TIME_SLOTS.map(slot => ({
          slot_time: slot.value + ':00',
          is_available: true,
          consecutive_slots: 12
        }));
        setAvailableSlots(fallbackSlots);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
  }, [selectedDoctor, selectedDate, appointmentType]);

  const handleSubmit = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) return;

    setIsLoading(true);
    try {
      const duration = appointmentType === 'emergency' 
        ? emergencyDuration 
        : (selectedAppointmentType?.duration || 10);
      
      // Try to use the advanced booking function for emergencies
      if (appointmentType === 'emergency') {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (!patientData) {
          toast({
            title: "Error",
            description: "Patient record not found",
            variant: "destructive"
          });
          return;
        }

        // Try RPC function first (cast to any for missing types)
        const { data, error } = await (supabase.rpc as any)('book_appointment', {
          p_patient_id: patientData.id,
          p_doctor_id: selectedDoctor,
          p_date: selectedDate,
          p_time: selectedTime,
          p_type: appointmentType,
          p_reason: reason || null,
          p_emergency_duration: emergencyDuration
        });

        if (error) {
          console.log('RPC not available, using standard booking:', error.message);
          // Fallback to standard booking
          const success = await bookAppointment({
            doctor_id: selectedDoctor,
            appointment_date: selectedDate,
            appointment_time: selectedTime.includes(':00:') ? selectedTime : selectedTime + ':00',
            appointment_type: appointmentType,
            reason: reason || undefined
          });

          if (success) {
            toast({
              title: "🚨 Emergency Appointment Booked!",
              description: "Your emergency appointment has been confirmed.",
            });
            onSuccess?.();
            onClose();
          }
        } else {
          toast({
            title: "🚨 Emergency Appointment Booked!",
            description: "Other appointments have been shifted to accommodate your emergency.",
          });
          onSuccess?.();
          onClose();
        }
      } else {
        // Regular appointment booking - needs manager approval
        const success = await bookAppointment({
          doctor_id: selectedDoctor,
          appointment_date: selectedDate,
          appointment_time: selectedTime.includes(':00:') ? selectedTime : selectedTime + ':00',
          appointment_type: appointmentType,
          reason: reason || undefined
        });

        if (success) {
          toast({
            title: "✅ Appointment Request Sent!",
            description: "Your appointment is pending approval from the hospital manager.",
          });
          onSuccess?.();
          onClose();
        }
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: "Error",
        description: "Failed to book appointment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDoctorData = doctors.find(d => d.id === selectedDoctor);
  const selectedDateLabel = availableDates.find(d => d.value === selectedDate)?.label;
  const selectedTimeLabel = selectedTime ? formatTimeDisplay(selectedTime) : '';

  // Get duration for current appointment type
  const duration = appointmentType === 'emergency' ? emergencyDuration : (selectedAppointmentType?.duration || 10);
  const slotsNeeded = Math.ceil(duration / 5);
  
  // Filter slots that have enough consecutive availability
  const bookableSlots = availableSlots.filter(slot => 
    slot.is_available && slot.consecutive_slots >= slotsNeeded
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">📅 Book Appointment</DialogTitle>
          <DialogDescription>
            Fill in the details to schedule your appointment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Step 1: Select Appointment Type */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <span className="bg-teal-100 text-teal-700 rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
              Appointment Type
            </Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col items-start">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Duration info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 p-2 rounded-lg">
              <Info className="h-4 w-4" />
              {appointmentType === 'emergency' ? (
                <span>Emergency appointments are confirmed immediately and may shift other appointments</span>
              ) : (
                <span>Duration: {selectedAppointmentType?.duration} minutes • Requires manager approval</span>
              )}
            </div>

            {/* Emergency duration input */}
            {appointmentType === 'emergency' && (
              <div className="mt-3 p-3 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Emergency Appointment</span>
                </div>
                <Label className="text-sm text-red-600">How long do you need? (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  max={60}
                  step={5}
                  value={emergencyDuration}
                  onChange={(e) => setEmergencyDuration(Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Other appointments may be shifted by 30 minutes to accommodate your emergency
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Select Doctor */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <span className="bg-teal-100 text-teal-700 rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
              Select Doctor
            </Label>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Choose a doctor..." />
              </SelectTrigger>
              <SelectContent>
                {doctors.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No doctors available
                  </div>
                ) : (
                  doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-teal-600" />
                        <span>Dr. {doctor.first_name} {doctor.last_name}</span>
                        {doctor.specialization && (
                          <span className="text-xs text-muted-foreground">
                            ({doctor.specialization})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Step 3: Select Date */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <span className="bg-teal-100 text-teal-700 rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
              Select Date
            </Label>
            <Select value={selectedDate} onValueChange={setSelectedDate} disabled={!selectedDoctor}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder={selectedDoctor ? "Choose a date..." : "Select a doctor first"} />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((date) => (
                  <SelectItem key={date.value} value={date.value}>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-teal-600" />
                      <span>{date.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 4: Select Time */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <span className="bg-teal-100 text-teal-700 rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
              Select Time
              {loadingSlots && <Loader2 className="h-4 w-4 animate-spin text-teal-600" />}
            </Label>
            
            {selectedDoctor && selectedDate ? (
              loadingSlots ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading available slots...
                </div>
              ) : bookableSlots.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-yellow-600" />
                  <p>No available slots for a {duration}-minute appointment on this date.</p>
                  <p className="text-sm">Try selecting a different date or doctor.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1">
                  {bookableSlots.map((slot) => (
                    <Button
                      key={slot.slot_time}
                      type="button"
                      variant={selectedTime === slot.slot_time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(slot.slot_time)}
                      className={`text-xs ${selectedTime === slot.slot_time ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
                    >
                      {formatTimeDisplay(slot.slot_time)}
                    </Button>
                  ))}
                </div>
              )
            ) : (
              <div className="p-4 text-center text-muted-foreground bg-gray-50 rounded-lg">
                Select a doctor and date to see available times
              </div>
            )}
          </div>

          {/* Step 5: Reason */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <span className="bg-gray-100 text-gray-500 rounded-full w-6 h-6 flex items-center justify-center text-sm">5</span>
              Reason {appointmentType !== 'emergency' && '(Optional)'}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={appointmentType === 'emergency' 
                ? "Please describe your emergency condition..."
                : "Briefly describe why you need this appointment..."}
              rows={2}
              className="resize-none"
              required={appointmentType === 'emergency'}
            />
          </div>

          {/* Summary Card */}
          {selectedDoctor && selectedDate && selectedTime && (
            <div className={`border rounded-xl p-4 ${
              appointmentType === 'emergency' 
                ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
                : 'bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200'
            }`}>
              <h4 className={`font-semibold mb-3 ${
                appointmentType === 'emergency' ? 'text-red-800' : 'text-teal-800'
              }`}>
                {appointmentType === 'emergency' ? '🚨 Emergency Appointment' : '✅ Appointment Summary'}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Doctor:</span>
                  <span className="font-medium">Dr. {selectedDoctorData?.first_name} {selectedDoctorData?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{selectedDateLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium">{selectedTimeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{selectedAppointmentType?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{duration} minutes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={appointmentType === 'emergency' ? 'destructive' : 'secondary'}>
                    {appointmentType === 'emergency' ? 'Immediate Confirmation' : 'Pending Approval'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedDoctor || !selectedDate || !selectedTime || (appointmentType === 'emergency' && !reason)}
            className={`flex-1 ${
              appointmentType === 'emergency' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Booking...
              </>
            ) : appointmentType === 'emergency' ? (
              "🚨 Book Emergency"
            ) : (
              "✓ Request Appointment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BookAppointmentDialog;
