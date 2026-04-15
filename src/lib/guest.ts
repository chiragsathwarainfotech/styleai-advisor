import { supabase } from "@/integrations/supabase/client";

// Simple UUID generator (no external dependency needed)
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const DEVICE_ID_KEY = "styloren_device_id";
const GUEST_USED_KEY = "styloren_guest_used";

/**
 * Robust persistent Device ID for Guest tracking.
 * Stored in localStorage.
 */
export const getPersistentDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

/**
 * Checks if the current device has already used its guest quota.
 * Uses localStorage as PRIMARY check (works even when logged out).
 * Falls back to DB check when authenticated.
 */
export const hasUsedGuestQuota = async (deviceId: string): Promise<boolean> => {
  // PRIMARY: Check localStorage flag (always works, even when logged out)
  const localFlag = localStorage.getItem(GUEST_USED_KEY);
  if (localFlag === "true") {
    return true;
  }

  // SECONDARY: Check DB (only works when authenticated, but covers cross-device edge cases)
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("display_name", `guest_${deviceId}`)
      .maybeSingle();

    if (error) {
      console.error("[Guest] Error checking quota in DB:", error);
      // If DB check fails (e.g. no auth), rely on localStorage only
      return false;
    }

    if (data) {
      // Sync: mark localStorage too, in case it was missing
      localStorage.setItem(GUEST_USED_KEY, "true");
      return true;
    }
  } catch (err) {
    console.error("[Guest] catch error checking quota:", err);
  }

  return false;
};

/**
 * Mark the current device as having used its guest quota.
 * Called after successful guest sign-in.
 */
export const markGuestUsed = () => {
  localStorage.setItem(GUEST_USED_KEY, "true");
};

/**
 * Performs a Guest Sign-in.
 * Uses Anonymous auth if possible, otherwise creates a silent account.
 */
export const signInAsGuest = async (deviceId: string) => {
  try {
    // Attempt standard anonymous sign-in first
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      console.error("[Guest] signInAnonymously failed, attempting fallback:", error);
      
      // Fallback: Create a silent account with a random password if anonymous auth is disabled
      const guestEmail = `guest_${deviceId.substring(0, 8)}_${Math.floor(Math.random() * 10000)}@guest.styloren.com`;
      const guestPassword = generateUUID();
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: guestEmail,
        password: guestPassword,
      });
      
      if (signUpError) throw signUpError;
      
      // Return consistent shape: { data: { user, session }, error: null }
      return { data: signUpData, error: null };
    }
    
    return { data, error: null };
  } catch (err: any) {
    console.error("[Guest] Guest Sign-in error:", err);
    return { data: null, error: err };
  }
};

/**
 * Checks if the current user is a guest.
 */
export const isGuestUser = (user: any): boolean => {
  if (!user) return false;
  return user.is_anonymous === true || user.email?.endsWith("@guest.styloren.com");
};
