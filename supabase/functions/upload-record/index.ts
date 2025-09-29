import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const patientId = formData.get('patientId') as string;
    const title = formData.get('title') as string;

    if (!file || !patientId || !title) {
      throw new Error('Missing required fields');
    }

    // Check user has permission (doctor or hospital_manager)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPermission = roles?.some(r => 
      ['doctor', 'hospital_manager', 'admin'].includes(r.role)
    );

    if (!hasPermission) {
      throw new Error('Insufficient permissions');
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}/${crypto.randomUUID()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('medical-records')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('medical-records')
      .getPublicUrl(fileName);

    // Create record in database
    const { data: record, error: recordError } = await supabase
      .from('records')
      .insert({
        patient_id: patientId,
        title,
        file_type: fileExt || 'unknown',
        file_url: publicUrl,
        uploaded_by: user.id,
        status: 'active',
      })
      .select()
      .single();

    if (recordError) {
      console.error('Record creation error:', recordError);
      throw recordError;
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'upload_record',
      resource: 'records',
      resource_id: record.id,
      details: { title, patient_id: patientId },
    });

    return new Response(JSON.stringify({ success: true, record }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
// Ashmit contribution
