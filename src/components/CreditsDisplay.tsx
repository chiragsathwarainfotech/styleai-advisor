import { useState, useRef, useEffect } from "react";
import { Sparkles, AlertCircle, ChevronDown, Clock } from "lucide-react";
import { CreditBatch } from "@/hooks/useCredits";

interface CreditsDisplayProps {
  creditsRemaining: number;
  isExpired: boolean;
  activeBatches: CreditBatch[];
  onGetCredits: () => void;
}

export function CreditsDisplay({
  creditsRemaining,
  isExpired,
  activeBatches,
  onGetCredits,
}: CreditsDisplayProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hasCredits = creditsRemaining > 0 && !isExpired;

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Main credits button */}
      <button
        onClick={() => {
          if (hasCredits && activeBatches.length > 0) {
            setOpen(!open);
          } else {
            onGetCredits();
          }
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
          hasCredits
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
        }`}
      >
        {hasCredits ? (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""}
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5" />
            No credits
          </>
        )}
      </button>

      {/* Dropdown popover */}
      {open && activeBatches.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-elevated z-50 overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-sm font-semibold text-foreground">Credit Details</p>
          </div>
          <div className="divide-y divide-border/50 max-h-60 overflow-y-auto">
            {activeBatches.map((batch) => (
              <div key={batch.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {batch.creditsRemaining} credit{batch.creditsRemaining !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {batch.planName}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Expires {batch.expiresAt.toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border/50">
            <button
              onClick={() => {
                setOpen(false);
                onGetCredits();
              }}
              className="w-full text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              + Get More Credits
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
