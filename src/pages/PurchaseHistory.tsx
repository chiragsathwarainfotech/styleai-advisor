import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CreditCard, Sparkles, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCredits } from "@/hooks/useCredits";

interface PurchaseRecord {
  id: string;
  plan_name: string;
  credits_total: number;
  purchased_at: string;
}

const PurchaseHistory = () => {
  const [user, setUser] = useState<any>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchPurchases(session.user.id);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) navigate("/auth");
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchPurchases = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("credit_purchases")
        .select("id, plan_name, credits_total, purchased_at")
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error("Error fetching purchases:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container mx-auto px-6 pt-1 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/account")}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold text-foreground">Purchase History</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">No purchases yet</h3>
              <p className="text-muted-foreground mb-6">You haven't purchased any credits yet.</p>
              <Button onClick={() => navigate("/analyze")} className="gradient-primary border-0">
                Go to Styling
              </Button>
            </div>
          ) : (
            purchases.map((purchase) => (
              <div 
                key={purchase.id}
                className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-border/50 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-foreground">
                      {purchase.plan_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(purchase.purchased_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">
                    +{purchase.credits_total}
                  </span>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Credits
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default PurchaseHistory;
