import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GUEST_EMAIL_DOMAIN = "styloren.com";
const WELCOME_CREDITS = 3;

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const sanitizeForEmail = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]/g, "");

async function deriveCredentials(deviceId: string) {
  const secret = Deno.env.get("GUEST_AUTH_SECRET") ?? "styloren-guest-auth-fallback-secret-2026";
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${deviceId}::${secret}`));
  const hex = toHex(digest);
  const safeId = sanitizeForEmail(deviceId);
  return {
    email: `guest_${safeId}@${GUEST_EMAIL_DOMAIN}`,
    password: `Gs1!${hex.slice(0, 28)}`,
  };
}

// Ensure user_subscriptions has a row with display_name "Guest User" and
// terms accepted. Idempotent — safe to call on every sign-in.
async function ensureUserSubscription(supabase: any, userId: string) {
  const { error } = await supabase.from("user_subscriptions").upsert(
    {
      user_id: userId,
      display_name: "Guest User",
      terms_accepted: true,
      terms_accepted_timestamp: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[guest-auth] user_subscriptions upsert failed:", error.message);
  }
}

// Ensure the guest_users mapping exists. Returns the row (with credits_total
// if those columns exist on this database). Self-healing: writes whatever
// the schema accepts.
async function ensureGuestRow(
  supabase: any,
  deviceId: string,
  userId: string
): Promise<{ creditsTotal: number; creditsUsed: number; columnsExist: boolean }> {
  // Always upsert the mapping (works pre- and post-migration).
  const { error: upsertErr } = await supabase
    .from("guest_users")
    .upsert({ device_id: deviceId, user_id: userId }, { onConflict: "device_id" });
  if (upsertErr) {
    console.error("[guest-auth] guest_users mapping upsert failed:", upsertErr.message);
  }

  // Try to read credit columns. If the migration hasn't run, this errors.
  const { data, error } = await supabase
    .from("guest_users")
    .select("credits_total, credits_used")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) {
    console.warn("[guest-auth] credit columns unavailable:", error.message);
    return { creditsTotal: 0, creditsUsed: 0, columnsExist: false };
  }

  return {
    creditsTotal: data?.credits_total ?? 0,
    creditsUsed: data?.credits_used ?? 0,
    columnsExist: true,
  };
}

// Grant the 3-credit welcome bonus on guest_users. No-op if columns don't
// exist yet (migration pending) — the function still returns so the user
// can sign in and the popup still fires; the balance just reads as 0
// until the migration runs.
async function grantWelcomeCredits(supabase: any, deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("guest_users")
    .update({ credits_total: WELCOME_CREDITS, credits_used: 0 })
    .eq("device_id", deviceId);
  if (error) {
    console.warn("[guest-auth] could not grant welcome credits:", error.message);
    return false;
  }
  return true;
}

// Look up an auth user by email (used when createUser reports a duplicate).
async function findAuthUserByEmail(supabase: any, email: string) {
  const { data: list } = await supabase.auth.admin.listUsers();
  return list?.users?.find((u: any) => u.email === email) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { device_id } = await req.json();
    if (!device_id || typeof device_id !== "string" || device_id.length < 4) {
      return new Response(JSON.stringify({ error: "device_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password } = await deriveCredentials(device_id);

    // ── 1. Resolve the auth user for this device ─────────────────────────
    // Strategy: prefer the device-id mapping; fall back to email lookup;
    // create a fresh user if neither exists.
    let userId: string | null = null;

    const { data: mapping } = await supabase
      .from("guest_users")
      .select("user_id")
      .eq("device_id", device_id)
      .maybeSingle();

    if (mapping?.user_id) {
      // Existing mapping — refresh credentials so client can sign in.
      const { error: updErr } = await supabase.auth.admin.updateUserById(
        mapping.user_id,
        { email, password, email_confirm: true }
      );
      if (!updErr) {
        userId = mapping.user_id;
      } else {
        // Auth user is gone or unrecoverable. Drop the stale mapping.
        console.warn("[guest-auth] stale mapping, dropping:", updErr.message);
        await supabase.from("guest_users").delete().eq("device_id", device_id);
      }
    }

    if (!userId) {
      // Try to create — this is the common path on first sign-in.
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { is_guest: true, device_id },
      });

      if (created?.user) {
        userId = created.user.id;
      } else {
        // Email already taken (mapping was lost). Look up by email and
        // refresh credentials so the client can sign in.
        const message = createErr?.message ?? "";
        const isDuplicate =
          message.toLowerCase().includes("already") ||
          message.toLowerCase().includes("registered") ||
          message.toLowerCase().includes("exists");
        if (isDuplicate) {
          const existingUser = await findAuthUserByEmail(supabase, email);
          if (existingUser) {
            await supabase.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true,
            });
            userId = existingUser.id;
          }
        }
        if (!userId) {
          throw createErr ?? new Error("Failed to provision guest user");
        }
      }
    }

    if (!userId) {
      throw new Error("Failed to resolve guest user id");
    }
    const resolvedUserId: string = userId;

    // ── 2. Ensure mapping + subscription rows ──────────────────────────
    await ensureUserSubscription(supabase, resolvedUserId);
    const guestRow = await ensureGuestRow(supabase, device_id, resolvedUserId);

    // ── 3. Decide if this guest needs the welcome bonus ────────────────
    // "is_new" === "credits not yet granted". This fires on:
    //  • first-ever sign-in for this device, AND
    //  • any earlier sign-in that ran while the credit columns didn't
    //    exist (so the grant silently no-op'd and the user has 0 credits).
    // It does NOT fire for returning guests who already have credits.
    let isNew = false;
    if (guestRow.columnsExist && guestRow.creditsTotal === 0 && guestRow.creditsUsed === 0) {
      const granted = await grantWelcomeCredits(supabase, device_id);
      isNew = granted;
    } else if (!guestRow.columnsExist) {
      // Migration pending: still surface the popup once so the user gets
      // the welcome experience. Balance will read 0 until migration runs.
      isNew = true;
    }

    return new Response(
      JSON.stringify({
        email,
        password,
        user_id: resolvedUserId,
        is_new: isNew,
        credits_total: isNew ? WELCOME_CREDITS : guestRow.creditsTotal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[guest-auth] error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
