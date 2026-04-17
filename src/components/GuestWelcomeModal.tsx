import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuestWelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GuestWelcomeModal = ({ open, onOpenChange }: GuestWelcomeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/20 bg-card/95 backdrop-blur-xl">
        <DialogHeader className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center animate-bounce-slow">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold text-foreground">
            Welcome to Styloren!
          </DialogTitle>
          <DialogDescription className="font-body text-balance text-foreground/90 font-medium text-lg leading-relaxed">
            We’ve added <span className="text-primary font-bold">3 free credits</span>—go ahead, style your first look ✨
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full h-12 gradient-primary border-0 font-display font-semibold text-lg shadow-lg hover:shadow-primary/20 transition-all"
          >
            Start Styling
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
