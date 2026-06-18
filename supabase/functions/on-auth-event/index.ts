import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the webhook payload from Supabase Auth
    const payload = await req.json();
    const { type, user } = payload;

    console.log(`Auth event: ${type} for user: ${user?.id}`);

    // Log only on user sign-in events
    if (type === 'user_signed_up' || type === 'user_signin') {
      const { error } = await supabase
        .from('app_logs')
        .insert({
          user_id: user.id,
          log_type: 'user_login',
          platform: user.user_metadata?.platform || 'web',
          device_info: {
            user_agent: req.headers.get('user-agent'),
            timestamp: new Date().toISOString(),
          },
          message: `User ${type === 'user_signed_up' ? 'signed up' : 'logged in'}`,
        });

      if (error) {
        throw error;
      }

      console.log(`[App Logs] Logged ${type} for user: ${user.id}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in on-auth-event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
