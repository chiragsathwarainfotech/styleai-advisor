import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { isNativeMobile as checkIsNativeMobile } from "@/lib/platform";

interface IAPSubscriptionCheckerProps {
  userId: string | null;
  onStatusChecked?: (hasActiveSubscription: boolean) => void;
}

/**
 * Component that checks subscription status on app launch for iOS/Android.
 * This ensures that credit status is synced with App Store.
 */
export function IAPSubscriptionChecker({ userId, onStatusChecked }: IAPSubscriptionCheckerProps) {
  const hasChecked = useRef(false);
  const isNativeMobile = checkIsNativeMobile();

  useEffect(() => {
    const checkStatus = async () => {
      if (!isNativeMobile || !userId || hasChecked.current) return;

      hasChecked.current = true;

      try {
        // For the credit-based system, we just notify the parent to refresh credits
        console.log("IAP status check triggered for user:", userId);
        onStatusChecked?.(false);
      } catch (error) {
        console.error("Failed to check IAP status:", error);
        onStatusChecked?.(false);
      }
    };

    checkStatus();
  }, [isNativeMobile, userId, onStatusChecked]);

  // This component doesn't render anything
  return null;
}
