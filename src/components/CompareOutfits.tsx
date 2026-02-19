import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Images, X, Loader2, Sparkles, Plus, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface CompareOutfitsProps {
  isPremium: boolean;
  remainingCompares: number;
  photoLimit: number;
  canCompare: boolean;
  onCompareUsed: () => Promise<boolean>;
  onUpgrade: () => void;
}

interface ImageData {
  id: string;
  preview: string;
  base64: string;
}

export function CompareOutfits({ 
  isPremium, 
  remainingCompares, 
  photoLimit, 
  canCompare: canUseCompare, 
  onCompareUsed, 
  onUpgrade 
}: CompareOutfitsProps) {
  const [images, setImages] = useState<ImageData[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<string | null>(null);
  const [occasion, setOccasion] = useState("");
  const [showLimitReached, setShowLimitReached] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = photoLimit - images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please upload image files only.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload images under 10MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), preview: base64, base64 },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setComparison(null);
  };

  const handleCompare = async () => {
    if (!canUseCompare) {
      setShowLimitReached(true);
      return;
    }

    if (images.length < 2) {
      toast({
        title: "Need more photos",
        description: "Please upload at least 2 photos to compare.",
        variant: "destructive",
      });
      return;
    }

    setComparing(true);
    setComparison(null);

    try {
      const { data, error } = await supabase.functions.invoke("compare-outfits", {
        body: { images: images.map((img) => img.base64), occasion: occasion.trim() || undefined },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setComparison(data.comparison);

      // Track compare usage
      await onCompareUsed();

      toast({
        title: "Comparison complete!",
        description: "Your outfits have been compared.",
      });
    } catch (error: any) {
      console.error("Comparison error:", error);
      toast({
        title: "Comparison failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setComparing(false);
    }
  };

  const clearAll = () => {
    setImages([]);
    setComparison(null);
  };

  // Show limit reached screen ONLY after the user actively tries to compare while over the limit.
  // This prevents the paywall from replacing the successful 2nd comparison result.
  if (showLimitReached) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-elevated">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-3">
            Oh no! Looks like you've used all your free credits!
          </h3>
          <p className="text-muted-foreground font-body max-w-md mx-auto mb-6">
            Add credits to continue and compare up to 4 outfits simultaneously!
          </p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button onClick={onUpgrade} className="w-full gradient-primary border-0 h-12">
              <Sparkles className="w-5 h-5 mr-2" />
              Get Credits
            </Button>
            {showLimitReached && (
              <Button 
                variant="ghost" 
                onClick={() => setShowLimitReached(false)} 
                className="text-muted-foreground"
              >
                Go back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-elevated">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Images className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Compare Outfits
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choosing between outfits or accessories? Upload multiple photos using Compare, and let Styloren recommend the perfect match!
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Upload up to {photoLimit} photos to compare ({images.length}/{photoLimit})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Uses 1 credit per comparison
            </p>
          </div>
        </div>
        {images.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {images.map((image) => (
          <div key={image.id} className="relative group">
            <img
              src={image.preview}
              alt="Outfit"
              className="aspect-square w-full object-cover rounded-xl"
            />
            <button
              onClick={() => removeImage(image.id)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < photoLimit && (
          <label
            htmlFor="compare-upload"
            className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
          >
            <Plus className="w-8 h-8 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">Add photo</span>
            <input
              ref={fileInputRef}
              id="compare-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
          </label>
        )}
      </div>

      {/* Occasion input */}
      <div className="mb-4">
        <label htmlFor="occasion" className="block text-sm font-medium text-foreground mb-2">
          Kindly mention the occasion/place that you are planning to visit.
        </label>
        <input
          id="occasion"
          type="text"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="Example: Birthday party, Hangout with friends, Office meeting..."
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* Compare button */}
      <Button
        onClick={handleCompare}
        disabled={comparing || images.length < 2}
        className="w-full h-14 gradient-primary border-0 font-body font-semibold text-lg shadow-soft hover:shadow-elevated transition-all duration-300"
      >
        {comparing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Comparing outfits...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Compare Outfits
          </>
        )}
      </Button>

      {/* Comparison result */}
      {comparison && (
        <div className="mt-6 flex gap-4 animate-slide-up">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-soft">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-muted/30 backdrop-blur-sm rounded-2xl rounded-tl-md p-6">
              <p className="font-body text-foreground font-medium mb-4">
                Here's my comparison of your outfits! 👗✨
              </p>
              <div className="prose prose-neutral max-w-none font-body text-foreground/90">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h3 className="font-display text-lg font-semibold text-foreground mt-5 mb-2 first:mt-0">
                        {children}
                      </h3>
                    ),
                    h3: ({ children }) => (
                      <h4 className="font-body text-base font-semibold text-foreground mt-4 mb-2">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-foreground/80 leading-relaxed mb-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-primary">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1.5 mb-3 text-foreground/80">
                        {children}
                      </ul>
                    ),
                    li: ({ children }) => (
                      <li className="text-foreground/80">{children}</li>
                    ),
                  }}
                >
                  {comparison}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
