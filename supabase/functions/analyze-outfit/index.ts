import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_UPLOADS = 25;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB in characters (base64)
const MAX_USERNAME_LENGTH = 100;

// Sanitize text to prevent prompt injection
function sanitizeText(str: string): string {
  if (!str) return '';
  return str.replace(/[<>"'`${}\\]/g, '').trim().slice(0, MAX_USERNAME_LENGTH);
}

// Validate base64 image
function validateImage(imageBase64: string): { valid: boolean; error?: string } {
  if (!imageBase64) {
    return { valid: false, error: 'No image provided' };
  }
  if (imageBase64.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image too large. Maximum size is 10MB.' };
  }
  // Check for valid base64 data URL pattern
  if (!imageBase64.startsWith('data:image/')) {
    return { valid: false, error: 'Invalid image format' };
  }
  return { valid: true };
}

async function checkRateLimit(supabase: any, userId: string): Promise<{ allowed: boolean; count: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('upload_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('uploaded_at', windowStart);

  if (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, count: 0 };
  }

  return { allowed: (count || 0) < RATE_LIMIT_MAX_UPLOADS, count: count || 0 };
}

async function recordUpload(supabase: any, userId: string): Promise<void> {
  const { error } = await supabase
    .from('upload_rate_limits')
    .insert({ user_id: userId });

  if (error) {
    console.error('Error recording upload:', error);
  }

  if (Math.random() < 0.1) {
    try {
      await supabase.rpc('cleanup_old_rate_limits');
    } catch (cleanupError) {
      console.log('Cleanup skipped:', cleanupError);
    }
  }
}

const getFashionPrompt = (userName?: string) => {
  const safeUserName = userName ? sanitizeText(userName) : '';
  const greeting = safeUserName 
    ? `You are an expert AI fashion stylist. The user's name is ${safeUserName}, so address them by name in a friendly way.`
    : `You are an expert AI fashion stylist.`;
  
  return `${greeting}
Analyze the outfit in the uploaded photo. Provide:

**Overall Style Analysis** – fabric, colors, vibe (casual, formal, festive, etc.).

**Compatibility Check** – tell whether the selected accessories in the photo (bag, shoes, earrings, bangles, necklace, watch, belt etc.) match the outfit or not.

**Colour & Style Rules** – explain why they match or don't match based on colour palette, contrast, undertones, texture, patterns, metal type, and occasion.

**Accessory-by-Accessory Verdict** – for each accessory, give a clear verdict:
- "Perfect Match" ✓
- "Good but could be better" ~
- "Not a good match" ✗

**Best Accessory Recommendation** – suggest the most suitable accessories that would elevate the look (specific colours, materials, shapes).

**Optional Upgrades** – hairstyle, makeup tone, shoe swap, bag type.

**Final Verdict** – one sentence summarizing whether the overall combination works or needs change.

Use simple, friendly, fashion-expert language. Be specific and visually descriptive. Avoid generic advice.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('JWT verification failed:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log(`Authenticated user: ${userId}`);

    const { imageBase64, userName } = await req.json();
    
    // Validate image
    const imageValidation = validateImage(imageBase64);
    if (!imageValidation.valid) {
      return new Response(JSON.stringify({ error: imageValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize userName
    const safeUserName = userName ? sanitizeText(userName) : undefined;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use service role client for rate limiting
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit using authenticated userId
    const { allowed, count } = await checkRateLimit(supabase, userId);
    console.log(`Rate limit check for user ${userId}: ${count}/${RATE_LIMIT_MAX_UPLOADS} uploads in last 60s`);
    
    if (!allowed) {
      console.log(`Rate limit exceeded for user ${userId}`);
      return new Response(JSON.stringify({ 
        error: 'rate_limit_exceeded',
        message: "You're uploading too fast. Please wait a moment and try again."
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record this upload
    await recordUpload(supabase, userId);

    console.log('Analyzing outfit with AI...', safeUserName ? `for ${safeUserName}` : '');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: getFashionPrompt(safeUserName)
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this outfit photo and provide your expert fashion advice.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    console.log('Analysis complete');

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in analyze-outfit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze outfit';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
