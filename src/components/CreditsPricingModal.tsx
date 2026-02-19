import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2, RotateCcw, Smartphone, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CREDIT_PLANS, CreditPlan } from "@/hooks/useCredits";
import { Capacitor } from "@capacitor/core";

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
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const { toast } = useToast();

  const isNativeMobile = Capacitor.isNativePlatform() && 
    (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android");

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
      const { CapacitorPurchases } = await import("@capgo/capacitor-purchases");
      
      // Get offerings and find the matching package by product identifier
      const { offerings } = await CapacitorPurchases.getOfferings();
      const currentOffering = offerings.current;
      if (!currentOffering) {
        throw new Error("No offerings available. Please try again later.");
      }

      const pkg = currentOffering.availablePackages.find(
        (p) => p.product.identifier === plan.productId
      );
      if (!pkg) {
        throw new Error("Product not found. Please try again later.");
      }

      const { customerInfo } = await CapacitorPurchases.purchasePackage({
        identifier: pkg.identifier,
        offeringIdentifier: currentOffering.identifier,
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

  const handleRestorePurchases = async () => {
    if (!isNativeMobile) {
      toast({
        title: "App Store Required",
        description: "Please use the Styloren app from the App Store to restore purchases.",
        variant: "destructive",
      });
      return;
    }

    setRestoringPurchases(true);
    try {
      const { CapacitorPurchases } = await import("@capgo/capacitor-purchases");
      const result = await CapacitorPurchases.restorePurchases();

      if (result.customerInfo) {
        toast({
          title: "Purchases Restored! 🎉",
          description: "Your previous purchases have been restored.",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "No Purchases Found",
          description: "No previous purchases were found to restore.",
        });
      }
    } catch (error: any) {
      console.error("Restore error:", error);
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore purchases. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRestoringPurchases(false);
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
            <span className="block">Choose a plan that works for you.</span>
            <span className="block">Use to Analyze or Compare your outfits!</span>
          </DialogDescription>
        </DialogHeader>

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

        <div className="grid gap-4 py-4">
          {CREDIT_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl p-5 border-2 transition-all ${
                plan.highlight
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

        {/* Restore Purchases Button */}
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleRestorePurchases}
            disabled={restoringPurchases || isLoading || showNativeAppRequired}
          >
            {restoringPurchases ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore Purchases
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Already purchased? Tap to restore your previous purchases.
          </p>
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
