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

    // Check user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');

    if (!isAdmin) {
      throw new Error('Only admins can approve doctors');
    }

    const { doctorId, action, rejectionReason } = await req.json();

    if (!doctorId || !action) {
      throw new Error('Missing required fields');
    }

    if (action === 'approve') {
      const { error } = await supabase
        .from('doctors')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', doctorId);

      if (error) throw error;

      // Log audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'approve_doctor',
        resource: 'doctors',
        resource_id: doctorId,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Doctor approved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'reject') {
      const { error } = await supabase
        .from('doctors')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason || 'Not specified',
        })
        .eq('id', doctorId);

      if (error) throw error;

      // Log audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'reject_doctor',
        resource: 'doctors',
        resource_id: doctorId,
        details: { reason: rejectionReason },
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Doctor rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid action');
    }
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