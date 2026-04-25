import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2, Smartphone, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCredits, CREDIT_PLANS, CreditPlan } from "@/hooks/useCredits";
import { Capacitor } from "@capacitor/core";
import { isNativeMobile as checkIsNativeMobile, getSafePlatform, useIOSLogic } from "@/lib/platform";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

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
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const credits = useCredits(userId);
  const creditsRemaining = credits?.creditsRemaining ?? 0;

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

      try {
        const offerings = await Purchases.getOfferings();
        let pkg = null;

        if (offerings.current) {
          pkg = offerings.current.availablePackages.find(
            (p) => p.product.identifier === plan.productId
          );
        }

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
          throw new Error("Product not found. Please check your configuration.");
        }

        const { customerInfo } = await Purchases.purchasePackage({
          aPackage: pkg,
        });

        console.log("[IAP Debug] Native purchase successful, customerInfo:", customerInfo);

        if (customerInfo) {
          console.log("[IAP Debug] Purchase successful. Checking for server-side verification...");

          // Try to find the transaction ID from the most recent purchase
          // RevenueCat transactions are often in customerInfo.nonSubscriptionTransactions or similar
          const latestTransaction = customerInfo.nonSubscriptionTransactions?.[0] ||
            Object.values(customerInfo.entitlements.all).find(e => e.productIdentifier === plan.productId);

          const transactionId = latestTransaction?.transactionIdentifier || "unknown_" + Date.now();

          // 1. Check if the webhook already completed this!
          const { data: existing } = await supabase
            .from("iap_transactions")
            .select("id, status")
            .eq("transaction_id", transactionId)
            .maybeSingle();

          if (existing?.status === 'completed') {
            console.log("[IAP Debug] Webhook beat the app! Transaction already completed.");
            credits.refetch();
            toast({
              title: "Credits Added! 🎉",
              description: "Your purchase has been verified and credits are ready.",
            });
            onOpenChange(false);
            return;
          }

          // 2. If not already completed, create the pending record for polling
          console.log("[IAP Debug] Creating record in iap_transactions...");

          const transactionData = {
            user_id: userId,
            app_user_id: userId,
            product_id: plan.productId,
            plan_name: plan.name,
            credits: plan.credits,
            status: 'pending',
            transaction_id: transactionId,
            updated_at: new Date().toISOString()
          };

          const { data, error } = await supabase
            .from("iap_transactions")
            .insert(transactionData)
            .select()
            .single();

          if (error) {
            console.error("[IAP Debug] Database Error:", error);
            toast({
              title: "Verification Error",
              description: "Payment successful but couldn't sync. Please use Restore Purchases later.",
              variant: "destructive",
            });
            return;
          }

          console.log("[IAP Debug] Record created successfully:", data.id);
          setPendingTransactionId(data.id);
          setCountdown(300); // 5 minutes

          toast({
            title: "Payment Success! 💳",
            description: "Transaction started. Please wait while we verify.",
          });
        }
      } catch (iapError: any) {
        console.error("IAP Error:", iapError);
        throw iapError;
      }
    } catch (error: any) {
      if (error?.code === "USER_CANCELLED" || error?.message?.includes("cancel")) {
        console.log("Purchase cancelled by user");
      } else {
        toast({
          title: "Purchase Failed",
          description: error.message || "Something went wrong.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(null);
    }
  };

  // Check for existing pending transactions on mount
  useEffect(() => {
    const checkPending = async () => {
      if (open && userId && !pendingTransactionId) {
        const { data } = await supabase
          .from("iap_transactions")
          .select("id, created_at")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const createdAt = new Date(data.created_at).getTime();
          const now = new Date().getTime();
          const elapsed = Math.floor((now - createdAt) / 1000);
          const remaining = 300 - elapsed;

          if (remaining > 0) {
            setPendingTransactionId(data.id);
            setCountdown(remaining);
          }
        }
      }
    };
    checkPending();
  }, [open, userId, pendingTransactionId]);

  // Timer logic
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (countdown === 0) {
      setPendingTransactionId(null);
      setCountdown(null);
    }
  }, [countdown]);

  // Polling logic
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let isMounted = true;

    const completePurchase = () => {
      if (pollInterval) clearInterval(pollInterval);
      setPendingTransactionId(null);
      setCountdown(null);
      credits.refetch();
      toast({
        title: "Purchase Success! 🎉",
        description: "Your credits have been added and are ready to use.",
      });
      onOpenChange(false);
    };

    if (pendingTransactionId) {
      pollInterval = setInterval(async () => {
        if (!isMounted) return;

        try {
          // 1. Check transaction status directly
          const { data: txData } = await supabase
            .from("iap_transactions")
            .select("status")
            .eq("id", pendingTransactionId)
            .maybeSingle();

          if (txData?.status === 'completed') {
            console.log("[IAP Polling] Transaction row marked completed.");
            completePurchase();
          } else {
            // 2. FALLBACK: Check the subscription table directly!
            const { data: subData } = await supabase
              .from("user_subscriptions")
              .select("credits_total")
              .eq("user_id", userId)
              .maybeSingle();

            const currentTotal = subData?.credits_total || 0;

            if (currentTotal > credits.creditsTotal) {
              console.log(`[IAP Polling] Balance increased in DB (${credits.creditsTotal} -> ${currentTotal}). Closing modal.`);
              completePurchase();
            }
          }
        } catch (e) {
          console.error("[IAP Polling] Error:", e);
        }
      }, 3000);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pendingTransactionId, userId, credits.creditsTotal, credits.refetch, onOpenChange, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const isLoading = loading !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            {pendingTransactionId ? "Processing Transaction" : "Get Credits"}
          </DialogTitle>
          <DialogDescription className="font-body space-y-1">
            {pendingTransactionId ? (
              <span className="block">Please wait while we verify your purchase.</span>
            ) : isGuest ? (
              <span className="block text-destructive font-semibold">
                Please sign in to purchase credits
              </span>
            ) : (
              <>
                <span className="block">Choose a plan that works for you.</span>
                <span className="block">Use to Analyze or Compare your outfits!</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Verification State Overlay */}
        {pendingTransactionId ? (
          <div className="py-8 space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="relative w-28 h-28 mx-auto">
              <div className="absolute inset-0 border-4 border-primary/10 rounded-full" />
              <div
                className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"
                style={{ animationDuration: '2s' }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold font-display text-primary">
                  {countdown !== null ? formatTime(countdown) : "--:--"}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Remaining</span>
              </div>
            </div>

            <div className="text-center space-y-3 px-4">
              <h3 className="font-display text-xl font-bold text-foreground">Transaction Ongoing</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">
                We're confirming your purchase with the App Store.
                Your credits will be added automatically in a few moments.
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mt-6">
                <p className="text-xs text-yellow-600 font-bold flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                  DO NOT CLOSE THIS SCREEN OR PRESS BACK
                </p>
                <p className="text-[10px] text-yellow-600/70 mt-1">
                  Closing may interrupt the verification process.
                </p>
              </div>

              {countdown !== null && countdown < 240 && (
                <p className="text-[11px] text-primary/60 font-medium animate-pulse pt-2">
                  Payment takes a bit longer on hold? You'll be notified via push.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Guest Purchase Restriction Notice */}
            {isGuest && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-2 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Smartphone className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">Sign Up to Purchase</p>
                  <p className="text-sm text-muted-foreground">
                    To purchase and store credits permanently, you need to create an account first.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/auth");
                  }}
                  className="w-full gradient-primary"
                >
                  Sign In / Create Account
                </Button>
              </div>
            )}

            {/* Native App Required Notice (only for real users) */}
            {!isGuest && showNativeAppRequired && (
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

            <div className={`grid gap-4 py-4 ${isGuest ? "opacity-40 pointer-events-none grayscale-[0.5]" : ""}`}>
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
