import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

/**
 * Robust platform detection utility.
 * Specifically handles iPad/Apple devices that might report differently
 * or require specific treatment for App Store logic.
 */
export const getSafePlatform = (): Platform => {
  const platform = Capacitor.getPlatform() as Platform;
  
  // Log platform for diagnostics (will show up in native logs)
  console.log(`[Platform Utility] Capacitor reports: ${platform}`);

  return platform;
};

/**
 * Returns true if the device is an Apple device (iPhone, iPad, Mac)
 * even if Capacitor reports 'web' (e.g. Safari on iPad).
 */
export const isAppleDevice = (): boolean => {
  if (Capacitor.getPlatform() === 'ios') return true;
  
  // Check user agent for Apple devices when in 'web' mode or potentially misidentified
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMac = /macintosh|mac os x/.test(userAgent);
  const isIPad = /ipad/.test(userAgent) || (isMac && navigator.maxTouchPoints > 1);
  const isIPhone = /iphone|ipod/.test(userAgent);
  
  return isIPad || isIPhone;
};

/**
 * Returns true if we should use iOS-specific logic (e.g. for RevenueCat or product IDs).
 * This defaults to true for any non-Android native platform or any Apple device.
 */
export const useIOSLogic = (): boolean => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return false;
  if (platform === 'ios') return true;
  
  // If we are native but not android/ios (e.g. potential future 'macos' support), 
  // or if we are an Apple device in web mode, use iOS logic.
  return isAppleDevice();
};

export const isNativeMobile = (): boolean => {
  return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
};
