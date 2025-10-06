import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id?: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'rejected';
  appointment_type: 'consultation' | 'follow_up' | 'checkup' | 'emergency' | 'other';
  reason?: string;
  notes?: string;
  doctor_notes?: string;
  manager_notes?: string;
  approved_by?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    medical_id: string;
    user_id?: string;
    profiles?: {
      first_name: string;
      last_name: string;
      phone?: string;
    };
  };
  doctor?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  };
}

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  specialization?: string;
  hospital_name?: string;
  hospital_id?: string;
}

// Type assertion helper for tables not yet in generated types
const fromTable = (tableName: string) => {
  return (supabase as any).from(tableName);
};

export function useAppointments() {
  const { user, roles } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Force refresh function
  const forceRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Fetch appointments based on user role
  const fetchAppointments = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = fromTable('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Fetch related data
      if (data && data.length > 0) {
        // Get patient details
        const patientIds = [...new Set(data.map((a: any) => a.patient_id))];
        const { data: patients } = await supabase
          .from('patients')
          .select('id, medical_id, user_id')
          .in('id', patientIds as string[]);

        // Get profiles for patients
        if (patients) {
          const userIds = patients.map(p => p.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, phone')
            .in('id', userIds);

          // Get doctor profiles
          const doctorIds = [...new Set(data.map((a: any) => a.doctor_id))];
          const { data: doctorProfiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', doctorIds as string[]);

          // Merge data
          const enrichedAppointments = data.map((appointment: any) => {
            const patient = patients?.find(p => p.id === appointment.patient_id);
            const patientProfile = profiles?.find(pr => pr.id === patient?.user_id);
            const doctorProfile = doctorProfiles?.find(d => d.id === appointment.doctor_id);

            return {
              ...appointment,
              patient: patient ? {
                ...patient,
                profiles: patientProfile
              } : undefined,
              doctor: doctorProfile
            };
          }) as Appointment[];

          setAppointments(enrichedAppointments);
        } else {
          setAppointments(data as Appointment[]);
        }
      } else {
        setAppointments([]);
      }
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch available doctors (approved doctors only)
  const fetchDoctors = useCallback(async () => {
    try {
      console.log('Fetching doctors...');
      
      // Get approved doctors from doctors table
      const { data: approvedDoctors, error: doctorError } = await supabase
        .from('doctors')
        .select('user_id, specialization')
        .eq('approval_status', 'approved');

      console.log('Approved doctors result:', { approvedDoctors, doctorError });

      if (doctorError) {
        console.error('Error fetching doctors:', doctorError);
        // Fallback: try to get doctors from user_roles if doctors table fails
        const { data: doctorRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'doctor');
        
        if (doctorRoles && doctorRoles.length > 0) {
          const doctorIds = doctorRoles.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', doctorIds);
          
          console.log('Fallback profiles:', profiles);
          setDoctors((profiles || []).map(p => ({
            id: p.id,
            first_name: p.first_name || '',
            last_name: p.last_name || ''
          })));
        }
        return;
      }

      if (approvedDoctors && approvedDoctors.length > 0) {
        const doctorUserIds = approvedDoctors.map(d => d.user_id);
        
        // Get profiles for these doctors
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', doctorUserIds);

        console.log('Doctor profiles result:', { profiles, profileError });

        if (profileError) {
          console.error('Error fetching doctor profiles:', profileError);
          return;
        }

        // Merge doctor info with profiles
        const doctorList: Doctor[] = (profiles || []).map(profile => {
          const doctorInfo = approvedDoctors.find(d => d.user_id === profile.id);
          return {
            id: profile.id,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            specialization: doctorInfo?.specialization
          };
        });

        console.log('Final doctor list:', doctorList);
        setDoctors(doctorList);
      } else {
        console.log('No approved doctors found, trying fallback...');
        
        // Fallback: try to get doctors from user_roles
        const { data: doctorRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'doctor');
        
        if (doctorRoles && doctorRoles.length > 0) {
          const doctorIds = doctorRoles.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', doctorIds);
          
          console.log('Fallback profiles:', profiles);
          setDoctors((profiles || []).map(p => ({
            id: p.id,
            first_name: p.first_name || '',
            last_name: p.last_name || ''
          })));
        } else {
          setDoctors([]);
        }
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  }, []);

  // Get doctor availability
  const getDoctorAvailability = async (doctorId: string): Promise<DoctorAvailability[]> => {
    try {
      const { data, error } = await fromTable('doctor_availability')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('is_available', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching availability:', error);
      return [];
    }
  };

  // Get booked slots for a doctor on a specific date
  const getBookedSlots = async (doctorId: string, date: string): Promise<string[]> => {
    try {
      const { data, error } = await fromTable('appointments')
        .select('appointment_time')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;
      return data?.map((a: any) => a.appointment_time) || [];
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      return [];
    }
  };

  // Book a new appointment
  const bookAppointment = async (appointmentData: {
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    appointment_type: string;
    reason?: string;
    notes?: string;
  }): Promise<boolean> => {
    if (!user) return false;

    try {
      // Get patient ID for current user
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!patient) {
        toast.error('Patient profile not found');
        return false;
      }

      const { error } = await fromTable('appointments')
        .insert({
          patient_id: patient.id,
          ...appointmentData,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Appointment booked successfully!');
      await fetchAppointments();
      return true;
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      toast.error(error.message || 'Failed to book appointment');
      return false;
    }
  };

  // Update appointment status (for doctors - only completed status and notes)
  const updateAppointmentStatus = async (
    appointmentId: string, 
    status: Appointment['status'],
    doctorNotes?: string
  ): Promise<boolean> => {
    try {
      const updateData: any = { status };
      if (doctorNotes) updateData.doctor_notes = doctorNotes;

      // Optimistic update - update local state immediately
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status, ...(doctorNotes && { doctor_notes: doctorNotes }) }
          : apt
      ));

      const { error } = await fromTable('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success(`Appointment ${status}`);
      // Force refresh to get accurate data
      forceRefresh();
      return true;
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment');
      // Revert on error
      await fetchAppointments();
      return false;
    }
  };

  // Manager approve/reject appointment
  const managerUpdateAppointment = async (
    appointmentId: string,
    action: 'confirm' | 'reject',
    managerNotes?: string
  ): Promise<boolean> => {
    if (!user) return false;

    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected';

    try {
      const updateData: any = {
        status: newStatus,
        approved_by: user.id
      };
      if (managerNotes) updateData.manager_notes = managerNotes;

      // Optimistic update - update local state immediately
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status: newStatus as Appointment['status'], approved_by: user.id, ...(managerNotes && { manager_notes: managerNotes }) }
          : apt
      ));

      const { error } = await fromTable('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success(`Appointment ${action === 'confirm' ? 'approved' : 'rejected'}`);
      // Force refresh to get accurate data
      forceRefresh();
      return true;
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment');
      // Revert on error
      await fetchAppointments();
      return false;
    }
  };

  // Cancel appointment
  const cancelAppointment = async (
    appointmentId: string,
    reason?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Optimistic update
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status: 'cancelled' as Appointment['status'], cancelled_by: user.id, cancellation_reason: reason }
          : apt
      ));

      const { error } = await fromTable('appointments')
        .update({
          status: 'cancelled',
          cancelled_by: user.id,
          cancellation_reason: reason
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Appointment cancelled');
      forceRefresh();
      return true;
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      toast.error('Failed to cancel appointment');
      return false;
    }
  };

  // Update doctor availability
  const updateAvailability = async (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    isAvailable: boolean
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await fromTable('doctor_availability')
        .upsert({
          doctor_id: user.id,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          is_available: isAvailable
        }, {
          onConflict: 'doctor_id,day_of_week'
        });

      if (error) throw error;

      toast.success('Availability updated');
      return true;
    } catch (error: any) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchDoctors();
      
      // Set up real-time subscription for appointments
      const appointmentsChannel = supabase
        .channel('appointments-changes-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments'
          },
          (payload) => {
            console.log('Appointment change detected:', payload);
            // Force a refresh when any change happens
            setRefreshTrigger(prev => prev + 1);
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(appointmentsChannel);
      };
    }
  }, [user]);

  // Separate effect for refreshing based on trigger
  useEffect(() => {
    if (user && refreshTrigger > 0) {
      fetchAppointments();
    }
  }, [refreshTrigger, user, fetchAppointments]);

  return {
    appointments,
    loading,
    doctors,
    fetchAppointments,
    fetchDoctors,
    forceRefresh,
    getDoctorAvailability,
    getBookedSlots,
    bookAppointment,
    updateAppointmentStatus,
    managerUpdateAppointment,
    cancelAppointment,
    updateAvailability
  };
}

// Ashmit contribution
