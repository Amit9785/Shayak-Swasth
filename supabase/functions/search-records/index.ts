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

    const { query, patientId } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    // Build search query
    let recordsQuery = supabase
      .from('records')
      .select(`
        *,
        patients!inner(*)
      `)
      .eq('status', 'active')
      .or(`title.ilike.%${query}%,file_type.ilike.%${query}%`);

    // Filter by patient if specified
    if (patientId) {
      recordsQuery = recordsQuery.eq('patient_id', patientId);
    }

    const { data: records, error: searchError } = await recordsQuery;

    if (searchError) {
      console.error('Search error:', searchError);
      throw searchError;
    }

    // Log search action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'search_records',
      resource: 'records',
      details: { query, patient_id: patientId },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: records || [],
        count: records?.length || 0 
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
