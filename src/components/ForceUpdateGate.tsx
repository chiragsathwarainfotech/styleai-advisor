import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AppUpdate,
  AppUpdateAvailability,
  AppUpdateResultCode,
} from "@capawesome/capacitor-app-update";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

const IOS_APP_STORE_ID = "6757631729";

/**
 * Compulsory update gate. Compares the installed build against the live store
 * version, so publishing a new release is all that is needed to trigger it.
 * Cannot be dismissed. Fails open: if the store can't be reached or the build
 * didn't come from a store, the app stays usable.
 */
export function ForceUpdateGate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updating, setUpdating] = useState(false);
  const updatingRef = useRef(false);
  const autoStartedRef = useRef(false);

  const startUpdate = useCallback(async () => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setUpdating(true);
    try {
      if (Capacitor.getPlatform() === "android") {
        const { immediateUpdateAllowed } = await AppUpdate.getAppUpdateInfo();
        if (immediateUpdateAllowed) {
          const { code } = await AppUpdate.performImmediateUpdate();
          // Cancelling leaves the gate up, with Update to try again.
          if (code === AppUpdateResultCode.OK || code === AppUpdateResultCode.CANCELED) return;
        }
        await AppUpdate.openAppStore();
      } else {
        await AppUpdate.openAppStore({ appId: IOS_APP_STORE_ID });
      }
    } catch (error) {
      console.error("[ForceUpdateGate] update failed:", error);
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (updatingRef.current) return;
    try {
      const { updateAvailability } = await AppUpdate.getAppUpdateInfo();
      const required =
        updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE ||
        updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS;
      setUpdateRequired(required);

      // Open Google's update screen straight away, once per launch.
      if (required && Capacitor.getPlatform() === "android" && !autoStartedRef.current) {
        autoStartedRef.current = true;
        await startUpdate();
      }
    } catch (error) {
      console.warn("[ForceUpdateGate] update check skipped:", error);
    }
  }, [startUpdate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    checkForUpdate();

    // Re-check on return from the store or background.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [checkForUpdate]);

  return (
    <AlertDialog open={updateRequired}>
      <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-sm mx-auto">
        <AlertDialogHeader className="items-center text-center">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mb-2">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <AlertDialogTitle className="font-display text-xl">Update required</AlertDialogTitle>
          <AlertDialogDescription className="font-body">
            A new version of Styloren is available. Please update to continue using the app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            onClick={startUpdate}
            disabled={updating}
            className="w-full h-12 gradient-primary border-0 font-body font-semibold"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update now"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
