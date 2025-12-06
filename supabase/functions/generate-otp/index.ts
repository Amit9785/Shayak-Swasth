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
      throw new Error('Only hospital managers can generate OTP');
    }

    const { action_type, resource_id } = await req.json();

    if (!action_type) {
      throw new Error('Action type is required');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: otpRecord, error: otpError } = await supabase
      .from('manager_otp')
      .insert({
        manager_id: user.id,
        otp_code: otp,
        action_type,
        resource_id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      throw otpError;
    }

    console.log('OTP generated for manager:', user.id, 'Action:', action_type);

    // TODO: Integrate with SMS/Email service to send OTP
    // For now, return OTP in response for development
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        otp: otp, // Remove this in production
        otp_id: otpRecord.id,
        expires_at: expiresAt
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
