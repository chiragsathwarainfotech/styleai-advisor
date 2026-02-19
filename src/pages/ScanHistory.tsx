import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, History, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScanHistoryCard } from "@/components/ScanHistoryCard";
import { ScanDetailModal } from "@/components/ScanDetailModal";
import { CreditsPricingModal } from "@/components/CreditsPricingModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useScanHistory, type ScanHistoryItem } from "@/hooks/useScanHistory";
import { useCredits, CreditPlan } from "@/hooks/useCredits";
import { useToast } from "@/hooks/use-toast";

const ScanHistory = () => {
  const [user, setUser] = useState<any>(null);
  const [selectedScan, setSelectedScan] = useState<ScanHistoryItem | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [scanToDelete, setScanToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const credits = useCredits(user?.id);
  const hasCredits = credits.creditsRemaining > 0 && !credits.isExpired;
  
  const {
    scans,
    lockedScans,
    isLoading,
    hasMore,
    loadMore,
    deleteScan,
    FREE_HISTORY_LIMIT,
  } = useScanHistory(user?.id, hasCredits);

  const handleDeleteConfirm = async () => {
    if (!scanToDelete) return;
    
    setIsDeleting(true);
    const success = await deleteScan(scanToDelete);
    setIsDeleting(false);
    setScanToDelete(null);
    
    if (success) {
      toast({ title: "Scan deleted", description: "The scan has been permanently removed from your history." });
    } else {
      toast({ title: "Error", description: "Failed to delete scan.", variant: "destructive" });
    }
  };

  const handleGetCredits = () => {
    setShowPricing(true);
  };

  const handlePlanPurchased = async (plan: CreditPlan): Promise<boolean> => {
    const success = await credits.addCredits(plan);
    if (success) {
      credits.refetch();
    }
    return success;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/analyze")}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
              <History className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold text-foreground">Scan History</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        {/* Info banner */}
        {!hasCredits && (
          <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground">
              <Sparkles className="w-4 h-4 inline mr-2 text-primary" />
              Free users can view their last {FREE_HISTORY_LIMIT} scans. 
              <button onClick={handleGetCredits} className="text-primary font-semibold ml-1 hover:underline">
                Get credits</button>
              {" "}to unlock unlimited history.
            </p>
          </div>
        )}

        {/* Scans list */}
        <div className="space-y-4">
          {isLoading && scans.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">No scans yet</h3>
              <p className="text-muted-foreground mb-4">Start analyzing outfits to build your history.</p>
              <Button onClick={() => navigate("/analyze")} className="gradient-primary border-0">
                Analyze Your First Outfit
              </Button>
            </div>
          ) : (
            <>
              {scans.map((scan) => (
                <ScanHistoryCard
                  key={scan.id}
                  id={scan.id}
                  signedImageUrl={scan.signed_image_url}
                  createdAt={scan.created_at}
                  outfitCategory={scan.outfit_category}
                  styleScore={scan.style_score}
                  isPremium={hasCredits}
                  onView={() => setSelectedScan(scan)}
                  onDelete={() => setScanToDelete(scan.id)}
                />
              ))}

              {/* Locked scans for free users */}
              {lockedScans.map((scan) => (
                <ScanHistoryCard
                  key={scan.id}
                  id={scan.id}
                  signedImageUrl={scan.signed_image_url}
                  createdAt={scan.created_at}
                  outfitCategory={scan.outfit_category}
                  styleScore={scan.style_score}
                  isLocked={true}
                  onView={() => {}}
                  onUpgrade={handleGetCredits}
                />
              ))}

              {/* Load more button */}
              {hasMore && hasCredits && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoading}
                    className="font-body"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}

              {/* Upgrade CTA at bottom for free users */}
              {!hasCredits && lockedScans.length > 0 && (
                <div className="mt-8 p-6 rounded-xl bg-card/80 border border-primary/20 text-center">
                  <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    Unlock Your Full History
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get credits to unlock unlimited scan history, comparisons, and AI styling.
                  </p>
                  <Button onClick={handleGetCredits} className="gradient-primary border-0">
                    Get Credits
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Scan Detail Modal */}
      <ScanDetailModal
        scan={selectedScan}
        open={!!selectedScan}
        onOpenChange={(open) => !open && setSelectedScan(null)}
      />

      {/* Credits Pricing Modal */}
      <CreditsPricingModal
        open={showPricing}
        onOpenChange={setShowPricing}
        userId={user?.id}
        onPlanPurchased={handlePlanPurchased}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!scanToDelete} onOpenChange={(open) => !open && setScanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this scan permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your outfit photo and analysis will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScanHistory;
