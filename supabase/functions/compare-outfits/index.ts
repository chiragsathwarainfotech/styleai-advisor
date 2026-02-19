import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB per image
const MAX_OCCASION_LENGTH = 200;

// Sanitize text to prevent prompt injection
function sanitizeText(str: string, maxLength: number): string {
  if (!str) return '';
  return str.replace(/[<>"'`${}\\]/g, '').trim().slice(0, maxLength);
}

const getComparisonPrompt = (occasion?: string) => {
  const safeOccasion = occasion ? sanitizeText(occasion, MAX_OCCASION_LENGTH) : '';
  const occasionContext = safeOccasion 
    ? `\n\nIMPORTANT: The user is planning to wear one of these outfits for: **${safeOccasion}**. Please factor this occasion into your analysis, ratings (especially Occasion Appropriateness), and final verdict. Consider what would be most suitable for this specific event/place.`
    : '';

  return `You are a friendly, expert fashion stylist comparing multiple outfit photos. Analyze each outfit and recommend the best one.${occasionContext}

Please provide your comparison in this format:

**Overview**
Briefly describe each outfit (Outfit 1, Outfit 2, etc.) in 1-2 sentences each.

**Individual Ratings**
Rate each outfit on:
- Style & Aesthetics (1-10)
- Color Coordination (1-10)
- Fit & Silhouette (1-10)
- Occasion Appropriateness (1-10)${safeOccasion ? ` (for ${safeOccasion})` : ''}

**Comparison Analysis**
Compare the outfits considering:
- Which has better color harmony?
- Which is more flattering?
- Which is more versatile?
- Which makes a stronger style statement?${safeOccasion ? `\n- Which is most appropriate for ${safeOccasion}?` : ''}

**Winner: Outfit [X] 🏆**
Clearly state which outfit wins and why in 2-3 sentences.${safeOccasion ? ` Explain why it's the best choice for ${safeOccasion}.` : ''}

**Quick Tips for Each Outfit**
Give one actionable improvement tip for each outfit.

Keep your tone friendly, encouraging, and specific. Be honest but constructive!`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
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
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('JWT verification failed:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);

    const { images, occasion } = await req.json();

    // Validate images array
    if (!images || !Array.isArray(images) || images.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 images are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (images.length > 4) {
      return new Response(
        JSON.stringify({ error: "Maximum 4 images allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate individual image sizes
    for (let i = 0; i < images.length; i++) {
      if (typeof images[i] !== 'string') {
        return new Response(
          JSON.stringify({ error: `Invalid image format at position ${i + 1}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (images[i].length > MAX_IMAGE_SIZE) {
        return new Response(
          JSON.stringify({ error: `Image ${i + 1} is too large. Maximum size is 10MB.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Sanitize occasion
    const safeOccasion = occasion ? sanitizeText(occasion, MAX_OCCASION_LENGTH) : undefined;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build content array with all images
    const imageContent = images.map((imageBase64: string, index: number) => ({
      type: "image_url",
      image_url: {
        url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
      },
    }));

    console.log(`Comparing ${images.length} outfits${safeOccasion ? ` for occasion: ${safeOccasion}` : ''}...`);

    const comparisonPrompt = getComparisonPrompt(safeOccasion);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${comparisonPrompt}\n\nI have ${images.length} outfit photos to compare.${safeOccasion ? ` I'm planning to wear one for: ${safeOccasion}.` : ''} Please analyze each one and recommend the best outfit.`,
              },
              ...imageContent,
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a few moments." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to compare outfits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const comparison = data.choices?.[0]?.message?.content;

    if (!comparison) {
      console.error("No comparison content received");
      return new Response(
        JSON.stringify({ error: "No comparison generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Comparison completed successfully");

    return new Response(
      JSON.stringify({ comparison }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Compare outfits error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to compare outfits" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
