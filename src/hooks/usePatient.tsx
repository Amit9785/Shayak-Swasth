import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PatientData {
  id: string;
  user_id: string;
  medical_id: string;
  date_of_birth: string;
  gender: string;
  blood_type: string | null;
  emergency_contact: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export function usePatient() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPatient();
  }, []);

  const fetchPatient = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      setPatient(data);
    } catch (error) {
      console.error('Error fetching patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patient data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createPatient = async (patientData: {
    date_of_birth: string;
    gender: string;
    blood_type?: string;
    emergency_contact?: string;
    address?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      // Generate medical ID
      const medicalId = `PT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const { data, error } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          medical_id: medicalId,
          ...patientData,
        })
        .select()
        .single();

      if (error) throw error;

      setPatient(data);
      toast({
        title: 'Success',
        description: 'Patient profile created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to create patient profile',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updatePatient = async (updates: Partial<PatientData>) => {
    try {
      if (!patient) throw new Error('No patient profile found');

      const { data, error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', patient.id)
        .select()
        .single();

      if (error) throw error;

      setPatient(data);
      toast({
        title: 'Success',
        description: 'Patient profile updated successfully',
      });

      return data;
    } catch (error) {
      console.error('Error updating patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to update patient profile',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    patient,
    loading,
    createPatient,
    updatePatient,
    refreshPatient: fetchPatient,
  };
}