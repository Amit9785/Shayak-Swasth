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

    // Check if user is hospital manager
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'hospital_manager')
      .single();

    if (!roles) {
      throw new Error('Only hospital managers can update records');
    }

    const { record_id, otp_id, updates } = await req.json();

    if (!record_id || !otp_id || !updates) {
      throw new Error('Record ID, OTP ID, and updates are required');
    }

    // Verify OTP was verified
    const { data: otpRecord, error: otpError } = await supabase
      .from('manager_otp')
      .select('*')
      .eq('id', otp_id)
      .eq('manager_id', user.id)
      .eq('verified', true)
      .eq('resource_id', record_id)
      .single();

    if (otpError || !otpRecord) {
      throw new Error('Invalid or unverified OTP');
    }

    // Get old record data for audit log
    const { data: oldRecord } = await supabase
      .from('records')
      .select('*')
      .eq('id', record_id)
      .single();

    // Update record
    const { data: updatedRecord, error: updateError } = await supabase
      .from('records')
      .update(updates)
      .eq('id', record_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating record:', updateError);
      throw updateError;
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'update_record',
      resource: 'records',
      resource_id: record_id,
      details: { 
        updates,
        otp_verified: true,
        otp_id: otp_id
      },
      old_value: oldRecord,
      new_value: updatedRecord,
    });

    console.log('Record updated successfully:', record_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        record: updatedRecord,
        message: 'Record updated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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
