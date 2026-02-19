import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Loader2, X, MessageCircle, User, Camera } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

import { ChatWindow } from "@/components/ChatWindow";
import { CreditsPricingModal } from "@/components/CreditsPricingModal";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { CompareOutfits } from "@/components/CompareOutfits";
import { NameInputModal } from "@/components/NameInputModal";
import { NoCreditsScreen } from "@/components/NoCreditsScreen";
import { useCredits, CreditPlan } from "@/hooks/useCredits";
import { useScanHistory } from "@/hooks/useScanHistory";
import { AnalysisCard } from "@/components/AnalysisCard";
import { IAPSubscriptionChecker } from "@/components/IAPSubscriptionChecker";

const Analyze = () => {
  const { user, isLoading, termsAccepted } = useAuth();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showNoCredits, setShowNoCredits] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  
  // Name state
  const [showNameModal, setShowNameModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use the new credits hook
  const credits = useCredits(user?.id ?? null);
  const { saveScan } = useScanHistory(user?.id, credits.creditsRemaining > 0);

  // Redirect logic: if not logged in or terms not accepted, redirect to auth
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/auth", { replace: true });
      } else if (termsAccepted === false) {
        navigate("/auth", { replace: true });
      }
    }
  }, [isLoading, user, termsAccepted, navigate]);

  // Check if user needs to set display name
  useEffect(() => {
    if (!credits.isLoading && user && credits.displayName === null) {
      setShowNameModal(true);
    }
  }, [credits.isLoading, credits.displayName, user]);

  const handleNameComplete = async (name: string) => {
    setShowNameModal(false);
    
    if (user) {
      await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: user.id,
          display_name: name || null,
        }, { onConflict: 'user_id' });
      credits.refetch();
    }
  };

  const handleGetCredits = () => {
    setShowPricing(true);
    setShowNoCredits(false);
  };

  const handlePlanPurchased = async (plan: CreditPlan): Promise<boolean> => {
    const success = await credits.addCredits(plan);
    if (success) {
      credits.refetch();
    }
    return success;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if can use credit before allowing upload
    if (!credits.canUseCredit()) {
      setShowNoCredits(true);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 10MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      setAnalysis(null);
      setShowChat(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      toast({
        title: "No image",
        description: "Please upload an image first.",
        variant: "destructive",
      });
      return;
    }

    // Check credit availability
    if (!credits.canUseCredit()) {
      setShowNoCredits(true);
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-outfit", {
        body: { imageBase64, userName: credits.displayName || undefined, userId: user?.id },
      });

      if (error) throw error;

      // Handle rate limit response
      if (data.error === 'rate_limit_exceeded') {
        setRateLimited(true);
        toast({
          title: "You're uploading too fast 🚀",
          description: "To keep Styloren safe and smooth for everyone, please wait a moment and try again.",
        });
        // Auto-reset after 60 seconds
        setTimeout(() => setRateLimited(false), 60000);
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data.analysis);

      // Deduct 1 credit for the analysis
      await credits.useCredit();

      // Save scan to history if preference is enabled
      if (credits.saveScanHistory) {
        const styleScoreMatch = data.analysis.match(/Style Score[:\s]*(\d+)/i);
        const styleScore = styleScoreMatch ? parseInt(styleScoreMatch[1], 10) : null;
        
        const categoryMatch = data.analysis.match(/(?:Overall Style|Style Category|Look)[:\s]*([A-Za-z]+)/i);
        const outfitCategory = categoryMatch ? categoryMatch[1] : null;
        
        await saveScan(imageBase64, data.analysis, styleScore ?? undefined, outfitCategory ?? undefined);
        
        toast({
          title: "Analysis complete!",
          description: "Your outfit has been analyzed and saved to history.",
        });
      } else {
        toast({
          title: "Analysis complete!",
          description: "Your outfit has been analyzed.",
        });
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setAnalysis(null);
    setShowChat(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChatClick = () => {
    if (!credits.canUseCredit()) {
      setShowNoCredits(true);
      return;
    }
    setShowChat(!showChat);
  };

  const handleCompareUsed = async (): Promise<boolean> => {
    // Deduct 1 credit for compare
    return await credits.useCredit();
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen gradient-warm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no user or terms not accepted, show nothing (useEffect handles redirect)
  if (!user || termsAccepted !== true) {
    return (
      <div className="min-h-screen gradient-warm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show no credits screen overlay if needed
  if (showNoCredits) {
    return (
      <div className="min-h-screen gradient-warm flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <NoCreditsScreen
            isExpired={credits.isExpired}
            onGetCredits={handleGetCredits}
          />
          <Button 
            variant="ghost" 
            onClick={() => setShowNoCredits(false)} 
            className="w-full mt-4 text-muted-foreground"
          >
            Go back
          </Button>
        </div>
        
        {/* Credits Pricing Modal */}
        <CreditsPricingModal
          open={showPricing}
          onOpenChange={setShowPricing}
          userId={user?.id}
          onPlanPurchased={handlePlanPurchased}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-warm">
      {/* Check iOS subscription status on app launch */}
      <IAPSubscriptionChecker 
        userId={user?.id ?? null} 
        onStatusChecked={() => {
          credits.refetch();
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold text-foreground">Styloren</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditsDisplay 
              creditsRemaining={credits.creditsRemaining}
              isExpired={credits.isExpired}
              activeBatches={credits.getActiveBatches()}
              onGetCredits={handleGetCredits}
            />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/account")}
              className="text-muted-foreground hover:text-foreground"
            >
              <User className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Welcome message */}
        <div className="text-center mb-12 animate-slide-up">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4">
            Hey{credits.displayName ? ` ${credits.displayName}` : " there"}! 👋
          </h1>
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Welcome to Styloren, your personal AI fashion advisor! Just upload your pic with your current outfit and watch the magic happen!
          </p>
        </div>

        {/* Upload section */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-elevated animate-scale-in" style={{ animationDelay: "0.1s" }}>
          {!imagePreview ? (
            <div className="space-y-4">
              {!credits.canUseCredit() && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                  <p className="text-destructive font-semibold mb-2">
                    {credits.isExpired 
                      ? "Your credits have expired!" 
                      : "Oh no! Looks like you've used all your credits!"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add more credits to continue your style journey.
                  </p>
                  <Button onClick={handleGetCredits} className="gradient-primary border-0">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get Credits
                  </Button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                {/* Upload from gallery */}
                <label
                  htmlFor="image-upload"
                  className={`flex-1 flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl transition-all duration-300 ${
                    credits.canUseCredit()
                      ? "border-border/50 cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                      : "border-muted cursor-not-allowed opacity-50"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="w-7 h-7 text-primary" />
                    </div>
                    <p className="font-body font-semibold text-foreground mb-1 text-sm">
                      Upload photo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From gallery
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={!credits.canUseCredit()}
                    className="hidden"
                  />
                </label>

                {/* Take a photo with camera */}
                <label
                  htmlFor="camera-capture"
                  className={`flex-1 flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl transition-all duration-300 ${
                    credits.canUseCredit()
                      ? "border-border/50 cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                      : "border-muted cursor-not-allowed opacity-50"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Camera className="w-7 h-7 text-primary" />
                    </div>
                    <p className="font-body font-semibold text-foreground mb-1 text-sm">
                      Click a photo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use camera
                    </p>
                  </div>
                  <input
                    id="camera-capture"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    disabled={!credits.canUseCredit()}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                PNG, JPG or WEBP (max 10MB)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image preview */}
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Outfit preview"
                  className="w-full max-h-96 object-contain rounded-xl"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rate limit warning */}
              {rateLimited && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">You're uploading too fast 🚀</p>
                  <p className="text-sm text-muted-foreground">
                    To keep Styloren safe and smooth for everyone, please wait a moment and try again.
                  </p>
                </div>
              )}

              {/* Analyze button */}
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || rateLimited}
                className="w-full h-12 gradient-primary border-0 font-body font-semibold"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing your style...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze My Outfit
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Uses 1 credit
              </p>
            </div>
          )}
        </div>

        {/* Analysis results */}
        {analysis && (
          <div className="mt-8 space-y-6 animate-slide-up">
            <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-elevated">
              <h2 className="font-display text-2xl font-semibold text-foreground mb-6">
                Your Style Analysis
              </h2>
              <AnalysisCard analysisText={analysis} />
            </div>

            {/* Chat button */}
            <div className="flex justify-center">
              <Button
                onClick={handleChatClick}
                variant="outline"
                className="font-body"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {showChat ? "Hide Chat" : "Ask Questions About Your Outfit"}
              </Button>
            </div>

            {/* Chat window */}
            {showChat && (
              <ChatWindow
                userId={user.id}
                imageBase64={imageBase64}
                planType="free"
                remainingChats={credits.creditsRemaining}
                cooldownUntil={null}
                userName={credits.displayName ?? undefined}
                onChatUsed={credits.useCredit}
                canChat={() => ({ allowed: credits.canUseCredit(), reason: credits.canUseCredit() ? "ok" : "limit" as const })}
                onUpgrade={handleGetCredits}
                onClose={() => setShowChat(false)}
              />
            )}
          </div>
        )}

        {/* Compare outfits section */}
        <div className="mt-12">
          <CompareOutfits
            isPremium={credits.creditsRemaining > 0}
            remainingCompares={credits.creditsRemaining}
            photoLimit={4}
            canCompare={credits.canUseCredit()}
            onCompareUsed={handleCompareUsed}
            onUpgrade={handleGetCredits}
          />
        </div>
      </main>

      {/* Name input modal */}
      <NameInputModal
        open={showNameModal}
        onComplete={handleNameComplete}
      />

      {/* Credits Pricing Modal */}
      <CreditsPricingModal
        open={showPricing}
        onOpenChange={setShowPricing}
        userId={user?.id}
        onPlanPurchased={handlePlanPurchased}
      />
    </div>
  );
};

export default Analyze;
