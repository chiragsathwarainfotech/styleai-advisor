import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// We don't have uuid installed, so let's use a simple crypto-based one or simple random
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Robust persistent Device ID for Guest tracking.
 * Stored in localStorage. If cleared, it may be lost, but it's the 
 * standard approach without native plugins.
 */
export const getPersistentDeviceId = (): string => {
  const STORAGE_KEY = "styloren_device_id";
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  
  return deviceId;
};

/**
 * Checks if the current device has already used its guest quota.
 * This checks the database for users associated with this device ID.
 */
export const hasUsedGuestQuota = async (deviceId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("display_name", `guest_${deviceId}`)
      .maybeSingle();

    if (error) {
      console.error("[Guest] Error checking quota:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("[Guest] catch error checking quota:", err);
    return false;
  }
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
      return signUpData;
    }
    
    return data;
  } catch (err) {
    console.error("[Guest] Guest Sign-in error:", err);
    throw err;
  }
};

/**
 * Checks if the current user is a guest.
 */
export const isGuestUser = (user: any): boolean => {
  if (!user) return false;
  return user.is_anonymous === true || user.email?.endsWith("@guest.styloren.com");
};
