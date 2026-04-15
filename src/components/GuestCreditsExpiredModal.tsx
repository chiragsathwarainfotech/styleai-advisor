import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, CircleUser, Lock } from "lucide-react";

interface GuestCreditsExpiredModalProps {
  open: boolean;
}

/**
 * Modal shown when a Guest user runs out of their 5 free trial credits.
 * Cannot be dismissed — redirects to /auth to sign in or create an account.
 */
export function GuestCreditsExpiredModal({ open }: GuestCreditsExpiredModalProps) {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm mx-auto">
        <AlertDialogHeader className="items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-8 h-8 text-primary" />
          </div>

          <AlertDialogTitle className="font-display text-xl text-center">
            Your free trial is over!
          </AlertDialogTitle>

          <AlertDialogDescription className="text-center font-body text-base leading-relaxed">
            You've used all{" "}
            <strong className="text-foreground">5 free credits</strong>.
            <br />
            Please sign in and purchase credits to continue enjoying Styloren.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-3 sm:flex-col mt-2">
          {/* Primary CTA */}
          <Button
            id="guest-expired-signin-btn"
            onClick={() => navigate("/auth")}
            className="w-full gradient-primary border-0 h-12 font-body font-semibold"
          >
            <CircleUser className="w-4 h-4 mr-2" />
            Sign In / Create Account
          </Button>

          {/* Bonus hint */}
          <div className="flex items-center justify-center gap-2 py-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <p className="text-xs text-center text-muted-foreground font-body">
              New users get{" "}
              <span className="text-primary font-semibold">5 free credits</span>{" "}
              on sign-up!
            </p>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
