import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2, Smartphone, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CREDIT_PLANS, CreditPlan } from "@/hooks/useCredits";
import { Capacitor } from "@capacitor/core";
import { isNativeMobile as checkIsNativeMobile, getSafePlatform, useIOSLogic } from "@/lib/platform";

interface CreditsPricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPlanPurchased: (plan: CreditPlan) => Promise<boolean>;
}

export function CreditsPricingModal({
  open,
  onOpenChange,
  userId,
  onPlanPurchased
}: CreditsPricingModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const { creditsRemaining } = useCredits(userId);
  
  const guestCreditsFinished = isGuest && creditsRemaining === 0;

  const isNativeMobile = checkIsNativeMobile();

  const showNativeAppRequired = !isNativeMobile;

  const handlePurchase = async (plan: CreditPlan) => {
    if (!isNativeMobile) {
      toast({
        title: "App Store Required",
        description: "Please use the Styloren app from the App Store to purchase credits.",
        variant: "destructive",
      });
      return;
    }

    setLoading(plan.id);

    try {
      // Use native IAP via RevenueCat to process payment
      const { Purchases } = await import("@revenuecat/purchases-capacitor");

      console.log("[Diagnostic] Native Platform:", getSafePlatform());
      console.log("[Diagnostic] Is Apple/iOS Logic:", useIOSLogic());
      console.log("[Diagnostic] Plan Product ID:", plan.productId);

      try {
        const offerings = await Purchases.getOfferings();
        let pkg = null;

        // Try current offering first
        if (offerings.current) {
          pkg = offerings.current.availablePackages.find(
            (p) => p.product.identifier === plan.productId
          );
        }

        // If not in current, search all offerings
        if (!pkg && offerings.all) {
          for (const offeringId in offerings.all) {
            const offering = offerings.all[offeringId];
            pkg = offering.availablePackages.find(
              (p) => p.product.identifier === plan.productId
            );
            if (pkg) break;
          }
        }

        if (!pkg) {
          console.error("Available offerings:", offerings);
          throw new Error("Product not found in any RevenueCat offerings. Please check your Dashboard or StoreKit configuration.");
        }

        const { customerInfo } = await Purchases.purchasePackage({
          aPackage: pkg,
        });

        if (customerInfo) {
          // Payment succeeded — now grant credits
          const success = await onPlanPurchased(plan);

          if (success) {
            toast({
              title: "Purchase Successful! 🎉",
              description: `You've added ${plan.credits} credits to your account!`,
            });
            onOpenChange(false);
          } else {
            toast({
              title: "Credits Error",
              description: "Payment was successful but credits could not be added. Please use Restore Purchases or contact support.",
              variant: "destructive",
            });
          }
        }
      } catch (iapError: any) {
        console.error("IAP Error inside try-catch:", iapError);
        throw iapError;
      }
    } catch (error: any) {
      // User cancelled or IAP error
      if (error?.code === "USER_CANCELLED" || error?.message?.includes("cancel")) {
        // User cancelled — no toast needed
        console.log("Purchase cancelled by user");
      } else {
        console.error("Purchase error:", error);
        toast({
          title: "Purchase Failed",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(null);
    }
  };


  const isLoading = loading !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Get Credits
          </DialogTitle>
          <DialogDescription className="font-body space-y-1">
            {guestCreditsFinished ? (
              <span className="block text-destructive font-semibold">
                Please sign in and purchase credits to continue
              </span>
            ) : (
              <>
                <span className="block">Choose a plan that works for you.</span>
                <span className="block">Use to Analyze or Compare your outfits!</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Guest Credit Expiration Notice */}
        {guestCreditsFinished && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-2 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Free Guest Credits Used</p>
              <p className="text-sm text-muted-foreground">
                You've enjoyed your free guest credits! To continue analyzing your style, please create an account.
              </p>
            </div>
            <Button 
              onClick={() => {
                onOpenChange(false);
                navigate("/auth");
              }}
              className="w-full gradient-primary"
            >
              Sign In / Sign Up
            </Button>
          </div>
        )}

        {/* Native App Required Notice */}
        {showNativeAppRequired && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Download the App to Purchase</p>
                <p className="text-xs text-muted-foreground mt-1">
                  In-App Purchases are available exclusively through the Styloren mobile app.
                  Download from the App Store or Google Play to get credits.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={`grid gap-4 py-4 ${guestCreditsFinished ? "opacity-40 pointer-events-none grayscale-[0.5]" : ""}`}>
          {CREDIT_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl p-5 border-2 transition-all ${plan.highlight
                ? "border-primary bg-primary/5 shadow-soft"
                : "border-border hover:border-primary/50"
                }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-4 px-3 py-1 rounded-full gradient-primary text-xs font-semibold text-primary-foreground">
                  Best Value
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-lg">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-display text-2xl font-bold text-foreground">
                      {plan.price}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">{plan.credits}</span>
                  <span className="text-sm text-muted-foreground ml-1">credits</span>
                </div>
              </div>

              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {plan.id === "monthly_value"
                    ? "50 credits for consistent styling"
                    : plan.id === "quarterly_saver"
                      ? "100 credits for serious style planning"
                      : `${plan.credits} credits to explore Styloren`}
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  Valid for {plan.validityLabel}
                </li>
              </ul>

              <Button
                onClick={() => handlePurchase(plan)}
                disabled={isLoading || showNativeAppRequired}
                className={`w-full ${plan.highlight ? "gradient-primary border-0" : ""} ${showNativeAppRequired ? "opacity-50" : ""}`}
                variant={plan.highlight ? "default" : "outline"}
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Get ${plan.credits} Credits`
                )}
              </Button>
            </div>
          ))}
        </div>


        {/* Legal Text */}
        <div className="text-xs text-muted-foreground text-center space-y-1 pt-2">
          <p>
            Payment will be charged to your App Store account at confirmation of purchase.
          </p>
          <p>
            Credits expire at the end of the validity period and do not roll over.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
