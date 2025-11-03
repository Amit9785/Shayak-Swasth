import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RecordData {
  id: string;
  patient_id: string;
  title: string;
  file_type: string;
  file_url: string;
  uploaded_by: string;
  upload_date: string;
  status: string;
  created_at: string;
}

export function useRecords(patientId?: string) {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecords();
  }, [patientId]);

  const fetchRecords = async () => {
    try {
      let query = supabase
        .from('records')
        .select('*')
        .eq('status', 'active')
        .order('upload_date', { ascending: false });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load medical records',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadRecord = async (
    patientId: string,
    title: string,
    file: File
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error('Not authenticated');

      // Upload file directly to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${patientId}/${crypto.randomUUID()}.${fileExt}`;
      
      console.log('Uploading file:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('medical-records')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // If bucket doesn't exist, provide helpful message
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket')) {
          toast({
            title: 'Storage Error',
            description: 'Storage bucket "medical-records" not found. Please create it in Supabase Dashboard > Storage.',
            variant: 'destructive',
          });
        }
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('medical-records')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Create record in database
      const { data: record, error: recordError } = await supabase
        .from('records')
        .insert({
          patient_id: patientId,
          title,
          file_type: fileExt || 'unknown',
          file_url: publicUrl,
          uploaded_by: session.user.id,
          status: 'active',
        })
        .select()
        .single();

      if (recordError) {
        console.error('Record creation error:', recordError);
        toast({
          title: 'Database Error',
          description: recordError.message || 'Failed to save record to database',
          variant: 'destructive',
        });
        throw recordError;
      }

      // Embed the record for AI RAG (don't fail if this fails)
      try {
        const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://localhost:8000";
        await fetch(`${AI_BACKEND_URL}/embed-record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record_id: record.id,
            patient_id: patientId,
            title: title,
            file_url: publicUrl,
            file_type: fileExt || 'unknown'
          })
        });
        console.log('Record embedded for AI analysis');
      } catch (embedError) {
        console.warn('AI embedding failed (non-critical):', embedError);
      }

      // Log audit trail (don't fail if this fails)
      try {
        await supabase.from('audit_logs').insert({
          user_id: session.user.id,
          action: 'upload_record',
          resource: 'records',
          resource_id: record.id,
          details: { title, patient_id: patientId },
        });
      } catch (auditError) {
        console.warn('Audit log failed:', auditError);
      }

      toast({
        title: 'Success',
        description: 'Record uploaded successfully',
      });

      await fetchRecords();
      return record;
    } catch (error: any) {
      console.error('Error uploading record:', error);
      // Only show generic error if not already shown
      if (!error.message?.includes('Bucket') && !error.message?.includes('bucket')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to upload record',
          variant: 'destructive',
        });
      }
      throw error;
    }
  };

  const deleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('records')
        .update({ status: 'deleted' })
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Record deleted successfully',
      });

      await fetchRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete record',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const shareRecord = async (
    recordId: string,
    shareWithUserId: string,
    expiresAt?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shared_access')
        .insert({
          record_id: recordId,
          shared_with_user_id: shareWithUserId,
          shared_by_user_id: user.id,
          expires_at: expiresAt,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Record shared successfully',
      });
    } catch (error) {
      console.error('Error sharing record:', error);
      toast({
        title: 'Error',
        description: 'Failed to share record',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    records,
    loading,
    uploadRecord,
    deleteRecord,
    shareRecord,
    refreshRecords: fetchRecords,
  };
}
// Ashmit contribution
