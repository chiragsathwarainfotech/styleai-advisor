import { supabase } from "@/integrations/supabase/client";
import { Device } from "@capacitor/device";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

// Simple UUID generator for web fallback
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
 * Uses Capacitor Device ID on native, localStorage+UUID on web.
 */
export const getPersistentDeviceId = async (): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getId();
      console.log("[Guest] Native device ID obtained:", info.identifier);
      return info.identifier;
    } catch (e) {
      console.error("[Guest] Failed to get native device ID, falling back to storage:", e);
    }
  }

  // Web fallback or failure fallback
  const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
  let deviceId = value || localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateUUID();
    await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

/**
 * Checks if the current device has already used its guest quota.
 * Uses Preferences as PRIMARY check (stable on iOS/Android).
 * Falls back to DB check when possible.
 */
export const hasUsedGuestQuota = async (deviceId: string): Promise<boolean> => {
  // PRIMARY: Check persistent preferences
  const { value } = await Preferences.get({ key: GUEST_USED_KEY });
  const localFlag = value || localStorage.getItem(GUEST_USED_KEY);
  
  if (localFlag === "true") {
    return true;
  }

  // SECONDARY: Check DB
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("display_name", `guest_${deviceId}`)
      .limit(1);

    if (error) {
      console.error("[Guest] Error checking quota in DB:", error);
      return false;
    }

    if (data && data.length > 0) {
      // Sync: mark local too
      await markGuestUsed();
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
export const markGuestUsed = async () => {
  await Preferences.set({ key: GUEST_USED_KEY, value: "true" });
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
      
      // Fallback: Create a silent account with a random password
      const guestEmail = `guest_${deviceId.substring(0, 8)}_${Math.floor(Math.random() * 10000)}@guest.styloren.com`;
      const guestPassword = generateUUID();
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: guestEmail,
        password: guestPassword,
      });
      
      if (signUpError) throw signUpError;
      
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
