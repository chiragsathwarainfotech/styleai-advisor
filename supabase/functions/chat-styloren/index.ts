import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 50;
const MAX_USERNAME_LENGTH = 100;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

function sanitizeText(str: string, maxLength: number): string {
  if (!str) return "";
  return str.replace(/[<>"'`${}\\]/g, "").trim().slice(0, maxLength);
}

const getSystemPrompt = (userName?: string) => {
  const safeUserName = userName ? sanitizeText(userName, MAX_USERNAME_LENGTH) : "";
  const greeting = safeUserName
    ? `The user's name is ${safeUserName} - address them by name occasionally to be personable.`
    : "";

  return `You are Styloren, a friendly and expert AI fashion stylist.
You help users with outfit advice, styling tips, and fashion recommendations.
Keep your responses concise, helpful, and encouraging.
If an image is provided, reference specific details from the outfit.
Use emojis sparingly to add personality.
${greeting}`;
};

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

// Build the Gemini-format contents array. Gemini uses role "model" for the
// assistant and expects parts with either text or inline_data. The latest
// user turn carries the optional image.
function buildGeminiContents(
  history: ClientMessage[],
  currentMessage: string,
  imageBase64: string | null
) {
  const contents: Array<{ role: "user" | "model"; parts: any[] }> = [];

  for (const msg of history) {
    if (!msg.content || typeof msg.content !== "string") continue;
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const currentParts: any[] = [{ text: currentMessage }];
  if (imageBase64 && imageBase64.startsWith("data:image/")) {
    const mimeType = imageBase64.split(";")[0].split(":")[1] || "image/jpeg";
    const base64Data = imageBase64.split("base64,")[1];
    if (base64Data) {
      currentParts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }
  }

  contents.push({ role: "user", parts: currentParts });
  return contents;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("JWT verification failed:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authenticated user: ${user.id}`);

    const { message, imageBase64, conversationHistory, userName } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeMessage = sanitizeText(message, MAX_MESSAGE_LENGTH);
    if (!safeMessage) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeUserName = userName ? sanitizeText(userName, MAX_USERNAME_LENGTH) : undefined;

    if (imageBase64 && imageBase64.length > MAX_IMAGE_SIZE) {
      return new Response(JSON.stringify({ error: "Image too large. Maximum size is 10MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let safeHistory: ClientMessage[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      if (conversationHistory.length > MAX_HISTORY_LENGTH) {
        return new Response(JSON.stringify({ error: "Conversation history too long" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      safeHistory = conversationHistory
        .slice(0, MAX_HISTORY_LENGTH)
        .filter(
          (msg: any) =>
            (msg.role === "user" || msg.role === "assistant") &&
            typeof msg.content === "string" &&
            msg.content.length > 0
        );
    }

    const contents = buildGeminiContents(safeHistory, safeMessage, imageBase64 ?? null);
    const systemInstruction = { parts: [{ text: getSystemPrompt(safeUserName) }] };

    const fallbackModels = [
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-3-flash",
      "gemini-1.5-flash",
    ];

    let response: Response | undefined;
    let errorData: any = null;

    for (const model of fallbackModels) {
      console.log(`Trying model: ${model}`);
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction,
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      if (response.ok) {
        console.log(`Successfully generated chat response using model: ${model}`);
        break;
      }
      errorData = await response.json().catch(() => null);
      console.warn(`Model ${model} failed with status ${response.status}`);
    }

    if (!response || !response.ok) {
      console.error("All Gemini API models failed. Last error:", errorData);
      return new Response(
        JSON.stringify({ error: "Chat failed across all models. Please try again." }),
        {
          status: response?.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const responseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseContent) {
      console.error("No response text in Gemini reply:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Empty response from AI." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ response: responseContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in chat-styloren:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process chat";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
