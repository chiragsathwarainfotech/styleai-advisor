import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    productId: "styloren_quick_try",
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
  const now = new Date();
  return rows.map((row) => {
    const expiresAt = new Date(row.expires_at);
    const isExpired = now > expiresAt;
    const remaining = isExpired ? 0 : Math.max(0, row.credits_total - row.credits_used);
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

async function fetchCreditsData(userId: string): Promise<CreditsState> {
  // Fetch user subscription info (for display_name, save_scan_history)
  const { data: subData } = await supabase
    .from("user_subscriptions")
    .select("display_name, save_scan_history")
    .eq("user_id", userId)
    .maybeSingle();

  // Fetch all credit batches
  const { data: batchRows } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("expires_at", { ascending: true });

  const batches = parseBatches(batchRows || []);
  const activeBatches = batches.filter((b) => !b.isExpired && b.creditsRemaining > 0);

  const totalRemaining = activeBatches.reduce((sum, b) => sum + b.creditsRemaining, 0);
  const totalCredits = batches.reduce((sum, b) => sum + b.creditsTotal, 0);
  const totalUsed = batches.reduce((sum, b) => sum + b.creditsUsed, 0);

  return {
    creditsTotal: totalCredits,
    creditsUsed: totalUsed,
    creditsRemaining: totalRemaining,
    batches,
    isExpired: activeBatches.length === 0 && batches.length > 0,
    displayName: subData?.display_name ?? null,
    saveScanHistory: subData?.save_scan_history ?? true,
  };
}

export function useCredits(userId: string | null) {
  const queryClient = useQueryClient();

  const { data: credits, isLoading } = useQuery({
    queryKey: ["credits", userId],
    queryFn: () => fetchCreditsData(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes to prevent flicker on navigation
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
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

  const canUseCredit = (): boolean => {
    return state.creditsRemaining > 0;
  };

  // Deduct 1 credit using FIFO (earliest expiring batch first)
  const useCredit = async (): Promise<boolean> => {
    if (!userId) return false;
    if (!canUseCredit()) return false;

    // Find the first active batch with remaining credits (ordered by expires_at asc)
    const activeBatch = state.batches.find((b) => !b.isExpired && b.creditsRemaining > 0);
    if (!activeBatch) return false;

    try {
      const newUsed = activeBatch.creditsUsed + 1;
      const { error } = await supabase
        .from("credit_purchases")
        .update({ credits_used: newUsed })
        .eq("id", activeBatch.id);

      if (error) throw error;

      // Optimistically update the cache
      queryClient.setQueryData(["credits", userId], (prev: CreditsState | undefined) => {
        if (!prev) return prev;
        const updatedBatches = prev.batches.map((b) =>
          b.id === activeBatch.id
            ? { ...b, creditsUsed: newUsed, creditsRemaining: Math.max(0, b.creditsTotal - newUsed) }
            : b
        );
        const totalRemaining = updatedBatches
          .filter((b) => !b.isExpired)
          .reduce((sum, b) => sum + b.creditsRemaining, 0);

        return {
          ...prev,
          creditsUsed: prev.creditsUsed + 1,
          creditsRemaining: totalRemaining,
          batches: updatedBatches,
        };
      });

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

      // Optimistically update cache
      queryClient.setQueryData(["credits", userId], (prev: CreditsState | undefined) => {
        if (!prev) return prev;
        return { ...prev, saveScanHistory: value };
      });
      return true;
    } catch (error) {
      console.error("Error updating save scan history preference:", error);
      return false;
    }
  };

  // Add credits as a NEW batch (stacking)
  const addCredits = async (plan: CreditPlan): Promise<boolean> => {
    if (!userId) return false;

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.validityDays * 24 * 60 * 60 * 1000);

      const { error } = await supabase.from("credit_purchases").insert({
        user_id: userId,
        credits_total: plan.credits,
        credits_used: 0,
        purchased_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        plan_name: plan.name,
      });

      if (error) throw error;

      // Also update the legacy user_subscriptions table for backward compat
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

  // Get active (non-expired) batches with remaining credits
  const getActiveBatches = (): CreditBatch[] => {
    return state.batches.filter((b) => !b.isExpired && b.creditsRemaining > 0);
  };

  // Legacy compatibility
  const getExpiryInfo = (): string | null => {
    const active = getActiveBatches();
    if (active.length === 0) return null;
    const earliest = active[0];
    const now = new Date();
    const diff = earliest.expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expires today";
    if (days === 1) return "Expires tomorrow";
    if (days <= 7) return `Expires in ${days} days`;
    return `Expires on ${earliest.expiresAt.toLocaleDateString()}`;
  };

  return {
    ...state,
    isLoading,
    canUseCredit,
    useCredit,
    addCredits,
    setSaveScanHistory,
    getExpiryInfo,
    getActiveBatches,
    refetch,
  };
}
