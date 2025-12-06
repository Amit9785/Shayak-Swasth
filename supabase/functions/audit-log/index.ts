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

    const { action, resource, resource_id, details, old_value, new_value } = await req.json();

    if (!action || !resource) {
      throw new Error('Action and resource are required');
    }

    // Get client IP and user agent from headers
    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const user_agent = req.headers.get('user-agent') || 'unknown';

    // Generate session ID (you can make this more sophisticated)
    const session_id = req.headers.get('x-session-id') || `session-${Date.now()}`;

    // Create audit log entry
    const { data: logEntry, error: logError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action,
        resource,
        resource_id: resource_id || null,
        details: details || null,
        old_value: old_value || null,
        new_value: new_value || null,
        ip_address,
        user_agent,
        session_id,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating audit log:', logError);
      throw logError;
    }

    console.log('Audit log created:', logEntry.id, 'Action:', action);

    return new Response(
      JSON.stringify({ 
        success: true, 
        log_id: logEntry.id,
        message: 'Action logged successfully'
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
