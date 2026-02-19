import { format } from "date-fns";
import { Eye, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScanHistoryCardProps {
  id: string;
  signedImageUrl?: string;
  createdAt: string;
  outfitCategory: string | null;
  styleScore: number | null;
  isLocked?: boolean;
  isPremium?: boolean;
  onView: () => void;
  onDelete?: () => void;
  onUpgrade?: () => void;
}

export function ScanHistoryCard({
  signedImageUrl,
  createdAt,
  outfitCategory,
  styleScore,
  isLocked = false,
  isPremium = false,
  onView,
  onDelete,
  onUpgrade,
}: ScanHistoryCardProps) {
  const formattedDate = format(new Date(createdAt), "MMM d, yyyy 'at' h:mm a");

  if (isLocked) {
    return (
      <div className="relative bg-card/60 rounded-xl overflow-hidden border border-border/50">
        <div className="absolute inset-0 backdrop-blur-md bg-background/40 z-10 flex flex-col items-center justify-center p-4">
          <Lock className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground text-center mb-2">Locked — Upgrade to Pro</p>
          <Button size="sm" onClick={onUpgrade} className="gradient-primary border-0">
            Unlock History
          </Button>
        </div>
        <div className="flex gap-4 p-4 opacity-30">
          <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-colors">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          {signedImageUrl ? (
            <img
              src={signedImageUrl}
              alt="Outfit"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-body">{formattedDate}</p>
              {outfitCategory && outfitCategory.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  {outfitCategory}
                </Badge>
              )}
            </div>
            {styleScore !== null && (
              <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                <span className="text-xs font-semibold text-primary">{styleScore}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onView}
              className="flex-1 h-8 text-xs"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Analysis
            </Button>
            {isPremium && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
