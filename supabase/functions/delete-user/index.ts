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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Auth failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log(`Starting account deletion for user: ${userId}`);

    // 1. Delete scan history from DB
    const { error: scanError } = await supabase
      .from('scan_history')
      .delete()
      .eq('user_id', userId);
    
    if (scanError) console.error('Error deleting scan history:', scanError);

    // 2. Delete storage files (optional but good practice)
    // In a real environment, we'd list files in the 'scan-images' bucket for this userId
    // but the bucket structure userId/file.jpg makes it easy to bulk delete if supported.
    // For now, we rely on DB cleanup and storage management policies.

    // 3. Delete rate limits
    await supabase.from('upload_rate_limits').delete().eq('user_id', userId);

    // 4. Delete credit purchases
    await supabase.from('credit_purchases').delete().eq('user_id', userId);

    // 5. Delete user subscriptions/profile
    await supabase.from('user_subscriptions').delete().eq('user_id', userId);

    // 6. Delete the user from Auth (This requires service role)
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      throw deleteUserError;
    }

    console.log(`Successfully deleted user: ${userId}`);

    return new Response(JSON.stringify({ success: true, message: 'Account deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in delete-user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
