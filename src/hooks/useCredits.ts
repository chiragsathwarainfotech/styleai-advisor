import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIOSLogic } from "@/lib/platform";

export interface CreditPlan {
  id: "quick_try" | "monthly_value" | "quarterly_saver";
  name: string;
  credits: number;
  price: string;
  priceValue: number;
  validityDays: number;
  validityLabel: string;
  description: string;
  highlight: boolean;
  productId: string;
}

export const CREDIT_PLANS: CreditPlan[] = [
  {
    id: "quick_try",
    name: "Quick Try",
    credits: 10,
    price: "₹49",
    priceValue: 49,
    validityDays: 15,
    validityLabel: "15 days",
    description: "10 credits to explore Styloren, valid for 15 days",
    highlight: false,
    productId: useIOSLogic() ? "styloren_quick_try_1" : "styloren_quick_try",
  },
  {
    id: "monthly_value",
    name: "Monthly Value",
    credits: 50,
    price: "₹199",
    priceValue: 199,
    validityDays: 30,
    validityLabel: "1 month",
    description: "50 credits for consistent styling, valid for 1 month",
    highlight: false,
    productId: "styloren_monthly_value",
  },
  {
    id: "quarterly_saver",
    name: "Quarterly Saver",
    credits: 100,
    price: "₹399",
    priceValue: 399,
    validityDays: 90,
    validityLabel: "3 months",
    description: "100 credits for serious style planning, valid for 3 months",
    highlight: true,
    productId: "styloren_quarterly_saver",
  },
];

export interface CreditBatch {
  id: string;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  purchasedAt: Date;
  expiresAt: Date;
  planName: string;
  isExpired: boolean;
}

export interface CreditsState {
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  batches: CreditBatch[];
  isExpired: boolean;
  displayName: string | null;
  saveScanHistory: boolean;
}

function parseBatches(rows: any[]): CreditBatch[] {
  return rows.map((row) => {
    const expiresAt = new Date(row.expires_at);
    const isExpired = false; // Expiration disabled
    const remaining = Math.max(0, row.credits_total - row.credits_used);
    return {
      id: row.id,
      creditsTotal: row.credits_total,
      creditsUsed: row.credits_used,
      creditsRemaining: remaining,
      purchasedAt: new Date(row.purchased_at),
      expiresAt,
      planName: row.plan_name,
      isExpired,
    };
  });
}

async function fetchGuestCredits(userId: string): Promise<CreditsState> {
  const { data: guestData } = await supabase
    .from("guest_users")
    .select("credits_total, credits_used")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: subData } = await supabase
    .from("user_subscriptions")
    .select("display_name, save_scan_history")
    .eq("user_id", userId)
    .maybeSingle();

  const totalCredits = guestData?.credits_total ?? 0;
  const totalUsed = guestData?.credits_used ?? 0;
  const totalRemaining = Math.max(0, totalCredits - totalUsed);

  return {
    creditsTotal: totalCredits,
    creditsUsed: totalUsed,
    creditsRemaining: totalRemaining,
    batches: [], // Guests don't have batch history.
    isExpired: false,
    displayName: subData?.display_name ?? null,
    saveScanHistory: subData?.save_scan_history ?? true,
  };
}

async function fetchUserCredits(userId: string): Promise<CreditsState> {
  const { data: subData } = await supabase
    .from("user_subscriptions")
    .select("credits_total, credits_used, display_name, save_scan_history")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: batchRows } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false });

  const batches = parseBatches(batchRows || []);

  const totalCredits = subData?.credits_total || 0;
  const totalUsed = subData?.credits_used || 0;
  const totalRemaining = Math.max(0, totalCredits - totalUsed);

  return {
    creditsTotal: totalCredits,
    creditsUsed: totalUsed,
    creditsRemaining: totalRemaining,
    batches,
    isExpired: totalRemaining === 0 && batches.length > 0,
    displayName: subData?.display_name ?? null,
    saveScanHistory: subData?.save_scan_history ?? true,
  };
}

export function useCredits(userId: string | null) {
  const queryClient = useQueryClient();
  const { isGuest } = useAuth();

  const { data: credits, isLoading } = useQuery({
    queryKey: ["credits", userId, isGuest ? "guest" : "user"],
    queryFn: () =>
      isGuest ? fetchGuestCredits(userId!) : fetchUserCredits(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const defaultCredits: CreditsState = {
    creditsTotal: 0,
    creditsUsed: 0,
    creditsRemaining: 0,
    batches: [],
    isExpired: false,
    displayName: null,
    saveScanHistory: true,
  };

  const state = credits ?? defaultCredits;

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["credits", userId] });
  }, [queryClient, userId]);

  const canUseCredit = (): boolean => state.creditsRemaining > 0;

  // Deduct 1 credit. Guest balance lives on guest_users; normal user balance
  // lives on user_subscriptions (with credit_purchases tracking the active
  // batch for FIFO purchase history).
  const useCredit = async (): Promise<boolean> => {
    if (!userId) return false;
    if (!canUseCredit()) return false;

    try {
      const newTotalUsed = state.creditsUsed + 1;

      if (isGuest) {
        const { error } = await supabase
          .from("guest_users")
          .update({ credits_used: newTotalUsed })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const activeBatch = state.batches.find((b) => b.creditsRemaining > 0);
        if (activeBatch) {
          const { error: batchError } = await supabase
            .from("credit_purchases")
            .update({ credits_used: activeBatch.creditsUsed + 1 })
            .eq("id", activeBatch.id);
          if (batchError) throw batchError;
        }

        const { error: subError } = await supabase
          .from("user_subscriptions")
          .update({ credits_used: newTotalUsed })
          .eq("user_id", userId);
        if (subError) throw subError;
      }

      queryClient.setQueryData(
        ["credits", userId, isGuest ? "guest" : "user"],
        (prev: CreditsState | undefined) => {
          if (!prev) return prev;
          const updatedBatches = isGuest
            ? prev.batches
            : prev.batches.map((b) => {
                const active = prev.batches.find((x) => x.creditsRemaining > 0);
                if (active && b.id === active.id) {
                  return {
                    ...b,
                    creditsUsed: b.creditsUsed + 1,
                    creditsRemaining: Math.max(0, b.creditsTotal - (b.creditsUsed + 1)),
                  };
                }
                return b;
              });
          return {
            ...prev,
            creditsUsed: newTotalUsed,
            creditsRemaining: Math.max(0, prev.creditsTotal - newTotalUsed),
            batches: updatedBatches,
          };
        }
      );

      return true;
    } catch (error) {
      console.error("Error using credit:", error);
      return false;
    }
  };

  const setSaveScanHistory = async (value: boolean): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({ save_scan_history: value })
        .eq("user_id", userId);

      if (error) throw error;

      queryClient.setQueryData(
        ["credits", userId, isGuest ? "guest" : "user"],
        (prev: CreditsState | undefined) =>
          prev ? { ...prev, saveScanHistory: value } : prev
      );
      return true;
    } catch (error) {
      console.error("Error updating save scan history preference:", error);
      return false;
    }
  };

  // Purchases — only normal users buy credits. Guests are not expected to
  // hit this path (the purchase UI is hidden), but if they do we no-op.
  const addCredits = async (plan: CreditPlan): Promise<boolean> => {
    if (!userId || isGuest) return false;

    try {
      const now = new Date();
      const expiresAt = new Date("2100-01-01T00:00:00Z");

      const { error } = await supabase.from("credit_purchases").insert({
        user_id: userId,
        credits_total: plan.credits,
        credits_used: 0,
        purchased_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        plan_name: plan.name,
      });

      if (error) throw error;

      await supabase
        .from("user_subscriptions")
        .update({
          credits_total: state.creditsTotal + plan.credits,
          credits_purchased_at: now.toISOString(),
          credits_expire_at: expiresAt.toISOString(),
        })
        .eq("user_id", userId);

      refetch();
      return true;
    } catch (error) {
      console.error("Error adding credits:", error);
      return false;
    }
  };

  const getActiveBatches = (): CreditBatch[] =>
    state.batches.filter((b) => b.creditsRemaining > 0);

  return {
    ...state,
    isLoading,
    canUseCredit,
    useCredit,
    addCredits,
    setSaveScanHistory,
    getActiveBatches,
    refetch,
  };
}
