import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRODUCT_CREDIT_MAP: Record<string, { credits: number, name: string }> = {
  "styloren_quick_try_1": { credits: 10, name: "Quick Try" },
  "styloren_quick_try": { credits: 10, name: "Quick Try" },
  "styloren_monthly_value": { credits: 50, name: "Monthly Value" },
  "styloren_quarterly_saver": { credits: 100, name: "Quarterly Saver" },
};

async function getAccessToken(serviceAccount: any) {
  const { client_email, private_key, token_url } = serviceAccount;
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = {
    iss: client_email,
    sub: client_email,
    aud: token_url || "https://oauth2.googleapis.com/token",
    iat,
    exp,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  };

  // Note: For a real production app, we would use a proper JWT library.
  // In Deno Deploy, we can use 'npm:jsonwebtoken' or Web Crypto API.
  // For simplicity and to avoid complex deps in this environment, 
  // I'll recommend the user set up a separate microservice or use a simpler FCM v1 approach if possible.
  // However, I'll provide the logic for calling FCM.
}

import { GoogleAuth } from "https://esm.sh/google-auth-library@8.7.0";

async function sendPushNotification(userIdOrEmail: string, title: string, body: string, supabase: any) {
  try {
    let targetUserId = userIdOrEmail;
    
    // Check if it's an email (doesn't look like a UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrEmail);
    
    if (!isUuid && userIdOrEmail.includes('@')) {
      console.log(`[Push] Resolving email ${userIdOrEmail} to user ID...`);
      // Try to find user by email in auth.users (requires admin client)
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      if (!userError && userData?.users) {
        const foundUser = userData.users.find(u => u.email?.toLowerCase() === userIdOrEmail.toLowerCase());
        if (foundUser) {
          targetUserId = foundUser.id;
          console.log(`[Push] Resolved ${userIdOrEmail} to ${targetUserId}`);
        }
      }
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', targetUserId);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log(`[Push] No tokens found for user ${targetUserId} (original: ${userIdOrEmail})`);
      return;
    }

    console.log(`[Push] Sending notification to ${tokens.length} devices for user ${targetUserId}`);

    const firebaseConfigStr = Deno.env.get('FIREBASE_CONFIG');
    if (!firebaseConfigStr) {
      console.log('[Push] FIREBASE_CONFIG not set');
      return;
    }

    const firebaseConfig = JSON.parse(firebaseConfigStr);
    const auth = new GoogleAuth({
      credentials: {
        client_email: firebaseConfig.client_email,
        private_key: firebaseConfig.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      throw new Error('Failed to get FCM access token');
    }

    const projectId = firebaseConfig.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    for (const { token } of tokens) {
      try {
        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title: title,
                body: body,
              },
              data: {
                title: title,
                body: body,
                notification_foreground: 'true',
                type: 'purchase_success'
              },
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  click_action: 'FCM_PLUGIN_ACTIVITY',
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                  },
                },
              },
            },
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error(`[Push] FCM Error for token ${token.substring(0, 10)}:`, result);
        } else {
          console.log(`[Push] Successfully sent to token: ${token.substring(0, 10)}...`);
        }
      } catch (tokenErr) {
        console.error(`[Push] Error sending to token:`, tokenErr);
      }
    }
  } catch (e) {
    console.error('[Push] Global Error:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Security Check: Verify Authorization Header
    const authHeader = req.headers.get('Authorization');
    const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
    
    if (expectedAuth && authHeader !== expectedAuth) {
      console.error('Unauthorized webhook attempt blocked.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received RevenueCat webhook:', JSON.stringify(body));

    const event = body.event;
    const eventType = event.type;
    const appUserId = event.app_user_id;
    const productId = event.product_id;
    const transactionId = event.transaction_id;

    // 2. We only care about purchase events for credit processing
    // Logging is handled by the iap_transactions update/insert logic below


    // We only care about purchase events
    if (['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE'].includes(eventType)) {
      const planInfo = PRODUCT_CREDIT_MAP[productId];
      
      if (!planInfo) {
        console.error(`Unknown product ID: ${productId}`);
        return new Response(JSON.stringify({ error: 'Unknown product' }), { status: 400 });
      }

      // 1. Check if this transaction was already processed
      const { data: existing } = await supabase
        .from('credit_purchases')
        .select('id')
        .eq('transaction_id', transactionId)
        .maybeSingle();

      if (existing) {
        console.log(`Transaction ${transactionId} already processed. Forcing iap_transactions update.`);
        
        // Force update the pending transaction to clear the UI
        await supabase
          .from('iap_transactions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', appUserId)
          .eq('status', 'pending');

        return new Response(JSON.stringify({ status: 'already_processed' }), { status: 200 });
      }


      // 2. Add credits to credit_purchases
      const expiresAt = new Date("2100-01-01T00:00:00Z");
      const { error: insertError } = await supabase
        .from('credit_purchases')
        .insert({
          user_id: appUserId,
          credits_total: planInfo.credits,
          credits_used: 0,
          purchased_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          plan_name: planInfo.name,
          transaction_id: transactionId,
        });

      if (insertError) {
        console.error('Error inserting credits:', insertError);
        throw insertError;
      }
      console.log(`Successfully added ${planInfo.credits} credits to credit_purchases for ${appUserId}`);

      // 2b. Update user_subscriptions table (Upsert to be safe)
      try {
        // Fetch current total to increment
        const { data: currentSub } = await supabase
          .from('user_subscriptions')
          .select('credits_total')
          .eq('user_id', appUserId)
          .maybeSingle();
          
        const oldTotal = currentSub?.credits_total || 0;
        const newTotal = oldTotal + planInfo.credits;
        
        const { error: subError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: appUserId,
            credits_total: newTotal,
            credits_purchased_at: new Date().toISOString(),
            credits_expire_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (subError) throw subError;
        console.log(`Updated user_subscriptions for ${appUserId}. Total: ${oldTotal} -> ${newTotal}`);
      } catch (subErr) {
        console.error('Error updating user_subscriptions:', subErr);
      }

      // 3. Update IAP transaction record (THIS CLOSES THE POPUP)
      try {
        // Resolve DB user ID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
        let dbUserId = isUuid ? appUserId : null;

        // If not a UUID, try to find in iap_transactions or guest_users or by email
        if (!dbUserId) {
          console.log(`[Webhook] appUserId ${appUserId} is not a UUID, attempting lookup...`);
          
          // 1. Try iap_transactions
          const { data: txData } = await supabase
            .from('iap_transactions')
            .select('user_id')
            .eq('app_user_id', appUserId)
            .maybeSingle();
          
          if (txData?.user_id) {
            dbUserId = txData.user_id;
            console.log(`[Webhook] Found user ID ${dbUserId} in iap_transactions`);
          } else if (appUserId.includes('@')) {
            // 2. Try auth users by email
            const { data: userData } = await supabase.auth.admin.listUsers();
            const foundUser = userData?.users?.find(u => u.email?.toLowerCase() === appUserId.toLowerCase());
            if (foundUser) {
              dbUserId = foundUser.id;
              console.log(`[Webhook] Found user ID ${dbUserId} by email lookup`);
            }
          }
        }

        if (!dbUserId) {
          throw new Error(`Could not resolve user ID for appUserId: ${appUserId}`);
        }

        // First, try to find by transaction_id
        const { data: existingTx } = await supabase
          .from('iap_transactions')
          .select('id, status')
          .eq('transaction_id', transactionId)
          .maybeSingle();

        if (existingTx) {
          if (existingTx.status === 'pending') {
            await supabase
              .from('iap_transactions')
              .update({ 
                status: 'completed', 
                revenuecat_event: body,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingTx.id);
            console.log(`Updated transaction ${existingTx.id} by transaction_id`);
          }
        } else if (dbUserId) {
          // FALLBACK: If no transaction_id match, find the most recent pending for this user + product
          // This handles cases where the app generated a temporary ID
          const { data: recentPending } = await supabase
            .from('iap_transactions')
            .select('id')
            .eq('user_id', dbUserId)
            .eq('product_id', productId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (recentPending) {
            await supabase
              .from('iap_transactions')
              .update({ 
                status: 'completed', 
                transaction_id: transactionId,
                revenuecat_event: body,
                updated_at: new Date().toISOString()
              })
              .eq('id', recentPending.id);
            console.log(`Updated transaction ${recentPending.id} by user/product fallback`);
          } else {
            // If still no match, create a new completed record
            await supabase
              .from('iap_transactions')
              .insert({
                user_id: dbUserId,
                app_user_id: appUserId,
                product_id: productId,
                plan_name: planInfo.name,
                credits: planInfo.credits,
                status: 'completed',
                transaction_id: transactionId,
                revenuecat_event: body,
                updated_at: new Date().toISOString()
              });
            console.log(`Created new completed record for ${transactionId}`);
          }
        }
      } catch (txErr) {
        console.error('Error in iap_transactions logic:', txErr);
      }

      // 4. Send Push Notification
      await sendPushNotification(
        appUserId, 
        'Purchase Successful! 🎉', 
        `Your ${planInfo.credits} credits have been added to your account.`,
        supabase
      );

      return new Response(JSON.stringify({ status: 'success' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ status: 'ignored_event_type' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('Error in revenuecat-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
