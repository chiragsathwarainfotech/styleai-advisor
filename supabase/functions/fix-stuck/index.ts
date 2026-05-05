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

    // Get user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    const targetUser = users?.users.find(u => u.email === 'bhavesh1@yopmail.com');
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'User bhavesh1@yopmail.com not found' }), { headers: corsHeaders });
    }

    const userId = targetUser.id;

    // Get last 5 iap_transactions for this user
    const { data: txs } = await supabase
      .from('iap_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get last 5 purchase_store_logs
    const { data: logs } = await supabase
      .from('purchase_store_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get current subscription total
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('credits_total')
      .eq('user_id', userId)
      .maybeSingle();

    return new Response(JSON.stringify({ 
      userId,
      email: 'bhavesh1@yopmail.com',
      credits_total: sub?.credits_total,
      transactions: txs,
      webhook_logs: logs
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
