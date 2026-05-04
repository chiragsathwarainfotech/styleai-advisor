import { supabase } from "@/integrations/supabase/client";
import { Device } from "@capacitor/device";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const DEVICE_ID_KEY = "styloren_device_id";

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

  const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
  let deviceId = value || localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = generateUUID();
    await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
};

export interface GuestSignInResult {
  data: { user: any; session: any } | null;
  error: any;
  isNewGuest: boolean;
}

/**
 * Deterministic guest sign-in. The same device always resolves to the same
 * guest account, so logging out and back in restores prior credits.
 *
 * Calls the `guest-auth` edge function which:
 *   - returns existing credentials if a guest already exists for this device
 *   - otherwise creates a new auth user (admin), seeds subscription + 3 credits
 */
export const signInAsGuest = async (deviceId: string): Promise<GuestSignInResult> => {
  try {
    const { data: tokenResponse, error: fnError } = await supabase.functions.invoke(
      "guest-auth",
      { body: { device_id: deviceId } }
    );

    if (fnError) throw fnError;
    if (!tokenResponse?.email || !tokenResponse?.password) {
      throw new Error("Guest auth did not return credentials");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: tokenResponse.email,
      password: tokenResponse.password,
    });

    if (error) throw error;

    return {
      data,
      error: null,
      isNewGuest: tokenResponse.is_new === true,
    };
  } catch (err: any) {
    console.error("[Guest] Guest Sign-in error:", err);
    return { data: null, error: err, isNewGuest: false };
  }
};

/**
 * Checks if the current user is a guest.
 *
 * Guest auth users are flagged via `user_metadata.is_guest` when the
 * `guest-auth` edge function provisions them. The legacy patterns
 * (anonymous auth and the old `@styloren.com` domain) remain
 * recognized so accounts created by earlier app versions still resolve
 * as guests after they sign in.
 */
export const isGuestUser = (user: any): boolean => {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  if (user.user_metadata?.is_guest === true) return true;
  if (user.email?.endsWith("@styloren.com")) return true;
  return false;
};
