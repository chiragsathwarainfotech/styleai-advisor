import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, CircleUser } from "lucide-react";

interface NoCreditsScreenProps {
  isExpired: boolean;
  onGetCredits: () => void;
  isGuest?: boolean;
}

export function NoCreditsScreen({ isExpired, onGetCredits, isGuest }: NoCreditsScreenProps) {
  const navigate = useNavigate();

  // Guest variant: nudge to sign in
  if (isGuest) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-elevated">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-3">
            Your free trial is over!
          </h3>
          <p className="text-muted-foreground font-body max-w-md mx-auto mb-6">
            Please sign in and purchase credits to continue.
          </p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button
              id="guest-nocredits-signin-btn"
              onClick={() => navigate("/auth")}
              className="w-full gradient-primary border-0 h-12"
            >
              <CircleUser className="w-5 h-5 mr-2" />
              Sign In / Create Account
            </Button>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground font-body">
              <Sparkles className="w-3 h-3 text-primary" />
              New users get{" "}
              <span className="text-primary font-semibold mx-1">1 free credit</span>{" "}
              on sign-up!
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular user variant: buy more credits
  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-elevated">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-3">
          {isExpired
            ? "Your credits have expired!"
            : "Oh no! Looks like you've used all your credits!"}
        </h3>
        <p className="text-muted-foreground font-body max-w-md mx-auto mb-6">
          {isExpired
            ? "Add more credits to continue your style journey with Styloren."
            : "Add more credits to continue your style journey."}
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Button onClick={onGetCredits} className="w-full gradient-primary border-0 h-12">
            <Sparkles className="w-5 h-5 mr-2" />
            Get Credits
          </Button>
        </div>
      </div>
    </div>
  );
}
