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

    const body = await req.json();
    const { otp_code, otp, action_type, patient_id, purpose } = body;
    
    // Support both old format (otp_code, action_type) and new format (otp, patient_id, purpose)
    const otpValue = otp_code || otp;
    
    if (!otpValue) {
      throw new Error('OTP code is required');
    }

    // Check if this is a doctor/access verification or manager verification
    if (patient_id || purpose === 'doctor_access' || purpose === 'record_access') {
      // Doctor/Access OTP verification using access_otp table
      const { data: otpRecord, error: otpError } = await supabase
        .from('access_otp')
        .select('*')
        .eq('requester_id', user.id)
        .eq('otp_code', otpValue)
        .eq('used', false)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        console.error('Invalid or expired access OTP:', otpError);
        throw new Error('Invalid or expired OTP');
      }

      // Mark OTP as verified and used
      const { error: updateError } = await supabase
        .from('access_otp')
        .update({ verified: true, used: true })
        .eq('id', otpRecord.id);

      if (updateError) {
        console.error('Error updating access OTP:', updateError);
        throw updateError;
      }

      console.log('Access OTP verified successfully for:', user.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OTP verified successfully',
          otp_id: otpRecord.id,
          patient_id: otpRecord.patient_id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Manager OTP verification (legacy flow)
    if (!action_type) {
      throw new Error('Action type is required for manager verification');
    }

    // Find valid OTP in manager_otp table
    const { data: otpRecord, error: otpError } = await supabase
      .from('manager_otp')
      .select('*')
      .eq('manager_id', user.id)
      .eq('otp_code', otpValue)
      .eq('action_type', action_type)
      .eq('used', false)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      console.error('Invalid or expired OTP:', otpError);
      throw new Error('Invalid or expired OTP');
    }

    // Mark OTP as verified and used
    const { error: updateError } = await supabase
      .from('manager_otp')
      .update({ verified: true, used: true })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('Error updating OTP:', updateError);
      throw updateError;
    }

    console.log('OTP verified successfully for manager:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP verified successfully',
        otp_id: otpRecord.id,
        resource_id: otpRecord.resource_id
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
