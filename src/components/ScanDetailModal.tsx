import { format } from "date-fns";
import { Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnalysisCard } from "@/components/AnalysisCard";
import type { ScanHistoryItem } from "@/hooks/useScanHistory";

interface ScanDetailModalProps {
  scan: ScanHistoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanDetailModal({ scan, open, onOpenChange }: ScanDetailModalProps) {
  if (!scan) return null;

  const formattedDate = format(new Date(scan.created_at), "MMMM d, yyyy 'at' h:mm a");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-display text-xl">Outfit Analysis</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-6">
            {/* Image */}
            <div className="rounded-xl overflow-hidden bg-muted">
              {scan.signed_image_url ? (
                <img
                  src={scan.signed_image_url}
                  alt="Outfit"
                  className="w-full max-h-80 object-contain"
                />
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-muted-foreground">
                  Image unavailable
                </div>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-3 flex-wrap">
              {scan.outfit_category && (
                <Badge variant="secondary" className="text-sm">
                  {scan.outfit_category}
                </Badge>
              )}
              {scan.style_score !== null && (
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
                  <Crown className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">{scan.style_score}</span>
                  <span className="text-sm text-muted-foreground">/100 Style Score</span>
                </div>
              )}
            </div>

            {/* Analysis text with styled cards */}
            <AnalysisCard analysisText={scan.analysis_text} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
