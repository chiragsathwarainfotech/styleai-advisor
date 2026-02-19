import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 50;
const MAX_USERNAME_LENGTH = 100;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Sanitize text to prevent prompt injection
function sanitizeText(str: string, maxLength: number): string {
  if (!str) return '';
  return str.replace(/[<>"'`${}\\]/g, '').trim().slice(0, maxLength);
}

const getSystemPrompt = (userName?: string) => {
  const safeUserName = userName ? sanitizeText(userName, MAX_USERNAME_LENGTH) : '';
  const greeting = safeUserName 
    ? `The user's name is ${safeUserName} - address them by name occasionally to be personable.`
    : '';
  
  return `You are Styloren, a friendly and expert AI fashion stylist. 
You help users with outfit advice, styling tips, and fashion recommendations.
Keep your responses concise, helpful, and encouraging.
If an image is provided, reference specific details from the outfit.
Use emojis sparingly to add personality.
${greeting}`;
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string | any[];
}

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

    const { message, imageBase64, conversationHistory, userName } = await req.json();
    
    // Validate message
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize and validate inputs
    const safeMessage = sanitizeText(message, MAX_MESSAGE_LENGTH);
    if (!safeMessage) {
      return new Response(JSON.stringify({ error: 'Invalid message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const safeUserName = userName ? sanitizeText(userName, MAX_USERNAME_LENGTH) : undefined;

    // Validate image size if provided
    if (imageBase64 && imageBase64.length > MAX_IMAGE_SIZE) {
      return new Response(JSON.stringify({ error: 'Image too large. Maximum size is 10MB.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate conversation history
    let safeHistory: Message[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      if (conversationHistory.length > MAX_HISTORY_LENGTH) {
        return new Response(JSON.stringify({ error: 'Conversation history too long' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      safeHistory = conversationHistory.slice(0, MAX_HISTORY_LENGTH).filter(
        msg => (msg.role === 'user' || msg.role === 'assistant') && msg.content
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat message...', safeUserName ? `for ${safeUserName}` : '');

    // Build messages array
    const messages: Message[] = [
      { role: 'system', content: getSystemPrompt(safeUserName) }
    ];

    // Add sanitized conversation history
    for (const msg of safeHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current message with image if available
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: safeMessage },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: safeMessage });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
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
    const responseContent = data.choices?.[0]?.message?.content;

    console.log('Chat response generated');

    return new Response(JSON.stringify({ response: responseContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in chat-styloren:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
