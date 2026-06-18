import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users who accessed data in the last hour (indicating they opened the app)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Query users from activity table (scan_history, user_subscriptions, etc.)
    // This approach identifies users who opened the app by checking if they queried data
    const { data: activeUsers, error } = await supabase
      .from('scan_history')
      .select('user_id, created_at')
      .gt('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get unique user IDs
    const uniqueUserIds = [...new Set(activeUsers?.map(r => r.user_id) || [])];

    console.log(`Found ${uniqueUserIds.length} active users in the last hour`);

    // For each active user, check if we already logged their session
    for (const userId of uniqueUserIds) {
      // Check if user has a session log from the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: recentLog } = await supabase
        .from('app_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('log_type', 'app_session_detected')
        .gt('logged_at', thirtyMinutesAgo)
        .limit(1);

      // Only log if no recent session
      if (!recentLog || recentLog.length === 0) {
        const { error: insertError } = await supabase
          .from('app_logs')
          .insert({
            user_id: userId,
            log_type: 'app_session_detected',
            platform: 'mobile',
            device_info: {
              detection_method: 'user_activity_check',
              timestamp: new Date().toISOString(),
            },
            message: 'User app activity detected',
          });

        if (insertError) {
          console.error(`Error logging activity for user ${userId}:`, insertError);
        } else {
          console.log(`Logged app session for user: ${userId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, usersLogged: uniqueUserIds.length }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in log-hourly-active-users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
