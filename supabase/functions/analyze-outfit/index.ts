import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_UPLOADS = 25;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_USERNAME_LENGTH = 100;

function sanitizeText(str: string): string {
  if (!str) return '';
  return str.replace(/[<>"'`${}\\]/g, '').trim().slice(0, MAX_USERNAME_LENGTH);
}

function validateImage(imageBase64: string): { valid: boolean; error?: string } {
  if (!imageBase64) {
    return { valid: false, error: 'No image provided' };
  }
  if (imageBase64.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image too large. Maximum size is 10MB.' };
  }
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const { imageBase64, userName } = await req.json();

    const imageValidation = validateImage(imageBase64);
    if (!imageValidation.valid) {
      return new Response(JSON.stringify({ error: imageValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const safeUserName = userName ? sanitizeText(userName) : undefined;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { allowed } = await checkRateLimit(supabase, userId);

    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'rate_limit_exceeded',
        message: "You're uploading too fast. Please wait a moment and try again."
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await recordUpload(supabase, userId);

    // Extract raw base64 and mime type
    const mimeType = imageBase64.split(';')[0].split(':')[1];
    const base64Data = imageBase64.split('base64,')[1];

    const fallbackModels = [
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-3-flash',
      'gemini-1.5-flash'
    ];

    let response;
    let errorData = null;

    for (const model of fallbackModels) {
      console.log(`Trying model: ${model}`);
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: getFashionPrompt(safeUserName) },
              {
                inline_data: {
                  mime_type: mimeType || "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      });

      if (response.ok) {
        console.log(`Successfully generated content using model: ${model}`);
        break;
      } else {
        errorData = await response.json();
        console.warn(`Model ${model} failed with status ${response.status}`);
      }
    }

    if (!response || !response.ok) {
      console.error('All Gemini API models failed. Last error:', errorData);
      return new Response(JSON.stringify({ error: 'AI analysis failed across all models' }), {
        status: response?.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in analyze-outfit:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});