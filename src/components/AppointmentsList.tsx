import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Calendar, Clock, User, Stethoscope, CheckCircle2, 
  XCircle, AlertCircle, Loader2, Plus, Ban
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { Appointment, useAppointments } from "@/hooks/useAppointments";

interface AppointmentsListProps {
  appointments: Appointment[];
  loading: boolean;
  onBookNew: () => void;
  isDoctor?: boolean;
  isManager?: boolean; // Hospital manager can approve/reject
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { 
    label: 'Pending Approval', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertCircle 
  },
  confirmed: { 
    label: 'Confirmed', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle2 
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle 
  },
  rejected: { 
    label: 'Rejected', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: Ban 
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: CheckCircle2 
  },
  no_show: { 
    label: 'No Show', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: XCircle 
  }
};

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  checkup: 'Checkup',
  emergency: 'Emergency',
  other: 'Other'
};

export function AppointmentsList({ 
  appointments, 
  loading, 
  onBookNew,
  isDoctor = false,
  isManager = false
}: AppointmentsListProps) {
  const { cancelAppointment, updateAppointmentStatus, managerUpdateAppointment } = useAppointments();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCancelClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelDialog(true);
  };

  const handleRejectClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowRejectDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;
    
    setActionLoading(selectedAppointment.id);
    await cancelAppointment(selectedAppointment.id, cancelReason);
    setShowCancelDialog(false);
    setCancelReason("");
    setSelectedAppointment(null);
    setActionLoading(null);
  };

  const handleConfirmReject = async () => {
    if (!selectedAppointment) return;
    
    setActionLoading(selectedAppointment.id);
    await managerUpdateAppointment(selectedAppointment.id, 'reject', rejectReason);
    setShowRejectDialog(false);
    setRejectReason("");
    setSelectedAppointment(null);
    setActionLoading(null);
  };

  const handleManagerApprove = async (appointmentId: string) => {
    setActionLoading(appointmentId);
    await managerUpdateAppointment(appointmentId, 'confirm');
    setActionLoading(null);
  };

  const handleStatusUpdate = async (appointmentId: string, status: Appointment['status']) => {
    setActionLoading(appointmentId);
    await updateAppointmentStatus(appointmentId, status);
    setActionLoading(null);
  };

  const upcomingAppointments = appointments.filter(a => 
    !isPast(parseISO(a.appointment_date)) || isToday(parseISO(a.appointment_date))
  ).filter(a => a.status !== 'cancelled' && a.status !== 'completed');

  const pastAppointments = appointments.filter(a => 
    isPast(parseISO(a.appointment_date)) && !isToday(parseISO(a.appointment_date))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Book Button */}
      {!isDoctor && (
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Your Appointments</h2>
          <Button onClick={onBookNew} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Book Appointment
          </Button>
        </div>
      )}

      {/* Upcoming Appointments */}
      <div>
        <h3 className="text-lg font-medium text-gray-700 mb-4">
          {isDoctor ? 'Upcoming Appointments' : 'Upcoming'}
        </h3>
        {upcomingAppointments.length === 0 ? (
          <Card className="bg-gray-50">
            <CardContent className="py-8 text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No upcoming appointments</p>
              {!isDoctor && (
                <Button 
                  variant="link" 
                  onClick={onBookNew}
                  className="text-teal-600 mt-2"
                >
                  Book your first appointment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {upcomingAppointments.map((appointment) => {
              const StatusIcon = STATUS_CONFIG[appointment.status].icon;
              const appointmentDate = parseISO(appointment.appointment_date);
              const isUpcoming = isToday(appointmentDate);

              return (
                <Card 
                  key={appointment.id} 
                  className={`${isUpcoming ? 'border-teal-300 bg-teal-50/30' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {isUpcoming && (
                            <Badge className="bg-teal-600">Today</Badge>
                          )}
                          <Badge className={STATUS_CONFIG[appointment.status].color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_CONFIG[appointment.status].label}
                          </Badge>
                          <Badge variant="outline">
                            {TYPE_LABELS[appointment.appointment_type]}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {format(appointmentDate, 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4" />
                            {appointment.appointment_time.slice(0, 5)}
                          </div>
                          {(isDoctor || isManager) ? (
                            <div className="flex items-center gap-2 text-gray-600">
                              <User className="h-4 w-4" />
                              {appointment.patient?.profiles?.first_name} {appointment.patient?.profiles?.last_name}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Stethoscope className="h-4 w-4" />
                              Dr. {appointment.doctor?.first_name} {appointment.doctor?.last_name}
                            </div>
                          )}
                          {isManager && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Stethoscope className="h-4 w-4" />
                              Dr. {appointment.doctor?.first_name} {appointment.doctor?.last_name}
                            </div>
                          )}
                        </div>

                        {appointment.reason && (
                          <p className="text-sm text-gray-500 mt-2">
                            <strong>Reason:</strong> {appointment.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {/* Manager actions - approve/reject pending appointments */}
                        {isManager && appointment.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleManagerApprove(appointment.id)}
                              disabled={actionLoading === appointment.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {actionLoading === appointment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectClick(appointment)}
                              disabled={actionLoading === appointment.id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}

                        {/* Doctor actions - only mark confirmed appointments as complete */}
                        {isDoctor && appointment.status === 'confirmed' && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                            disabled={actionLoading === appointment.id}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {actionLoading === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Mark Complete'
                            )}
                          </Button>
                        )}

                        {/* Patient actions - cancel pending appointments */}
                        {!isDoctor && !isManager && appointment.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelClick(appointment)}
                            disabled={actionLoading === appointment.id}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Past Appointments</h3>
          <div className="grid gap-3">
            {pastAppointments.slice(0, 5).map((appointment) => {
              const StatusIcon = STATUS_CONFIG[appointment.status].icon;
              
              return (
                <Card key={appointment.id} className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge className={STATUS_CONFIG[appointment.status].color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {STATUS_CONFIG[appointment.status].label}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {format(parseISO(appointment.appointment_date), 'MMM d, yyyy')}
                        </span>
                        {isDoctor ? (
                          <span className="text-sm text-gray-600">
                            {appointment.patient?.profiles?.first_name} {appointment.patient?.profiles?.last_name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-600">
                            Dr. {appointment.doctor?.first_name} {appointment.doctor?.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Reason for cancellation (optional)</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={actionLoading !== null}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Cancel Appointment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog for Managers */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Appointment Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this appointment request? The patient will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Reason for rejection (optional)</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for the patient..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={actionLoading !== null}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Reject Appointment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppointmentsList;
