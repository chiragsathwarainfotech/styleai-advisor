import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PremiumGateProps {
  isPremium: boolean;
  children: React.ReactNode;
  onUpgrade: () => void;
}

export function PremiumGate({ isPremium, children, onUpgrade }: PremiumGateProps) {
  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            Premium Feature
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            Upgrade to premium to unlock personalized accessory recommendations
          </p>
          <Button onClick={onUpgrade} className="gradient-primary border-0">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </div>
    </div>
  );
}
