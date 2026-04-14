
/**
 * Simple utility to check if the browser/app has an internet connection.
 * @returns {boolean} true if connected, false if definitely offline.
 */
export const isOnline = (): boolean => {
  if (typeof window === "undefined" || !window.navigator) return true;
  return window.navigator.onLine;
};

/**
 * A more robust check that attempts to fetch a tiny resource.
 * This can detect "lie-fai" where the device is connected to a network but no internet access.
 */
export const checkActualConnectivity = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  
  try {
    // Try to fetch a tiny file from a reliably available host (Google or Supabase)
    // We use no-cache and a small timeout to keep it fast.
    const response = await fetch("https://www.google.com/generate_204", {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    return !!response;
  } catch (error) {
    return false;
  }
};
