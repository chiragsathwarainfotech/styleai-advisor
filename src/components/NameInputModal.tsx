import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

interface NameInputModalProps {
  open: boolean;
  onComplete: (name: string) => void;
}

export function NameInputModal({ open, onComplete }: NameInputModalProps) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    onComplete(name.trim());
  };

  const handleSkip = () => {
    onComplete("");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <DialogTitle className="font-display text-2xl">Welcome to Styloren! 👋</DialogTitle>
          <DialogDescription className="text-muted-foreground pt-2">
            What should I call you? This helps me personalize your fashion advice!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            className="text-center text-lg h-12"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 gradient-primary border-0 font-semibold"
            >
              {name.trim() ? `Hey ${name.trim()}, let's go!` : "Continue"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
