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

    const body = await req.json();
    const { logType = 'app_open', platform, deviceInfo, message, deviceId = null } = body;

    let userId = null;
    let userName = null;
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

    // If user is authenticated, get their ID and resolve a human-readable name
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;

        // Prefer the display_name stored in user_subscriptions, fall back to email
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();

        userName =
          sub?.display_name ||
          (user.user_metadata as Record<string, any>)?.display_name ||
          (user.user_metadata as Record<string, any>)?.full_name ||
          user.email ||
          null;
      }
    }

    // Insert log entry.
    // For logged-in users we record user_name; for guests/anonymous we record device_id.
    const { data, error } = await supabase
      .from('app_logs')
      .insert({
        user_id: userId,
        user_name: userName,
        device_id: deviceId,
        log_type: logType,
        platform: platform,
        device_info: deviceInfo || {},
        message: message,
      })
      .select();

    if (error) {
      throw error;
    }

    console.log(
      `[App Logs] Logged ${logType} on ${platform || 'unknown'} for ${
        userName ? `user "${userName}"` : `device ${deviceId || 'unknown'}`
      }`
    );

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in log-app-open:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
