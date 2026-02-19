import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Shield, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConsentProps {
  userId: string;
  onConsentAccepted: () => void;
}

const Consent = ({ userId, onConsentAccepted }: ConsentProps) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { toast } = useToast();

  const handleAcceptTerms = async () => {
    if (!agreed) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({
          terms_accepted: true,
          terms_accepted_timestamp: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Welcome to Styloren!",
        description: "Thank you for accepting the terms.",
      });
      
      onConsentAccepted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center px-6">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-elevated animate-scale-in relative">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-semibold text-foreground">Styloren</span>
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl font-semibold text-center text-foreground mb-2">
            One Last Step
          </h1>
          <p className="text-muted-foreground text-center mb-6 font-body text-sm">
            Please review and accept our terms to continue
          </p>

          {/* Links to policies - now open modals */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => setShowTerms(true)}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors w-full text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-body font-medium text-foreground">Terms & Conditions</p>
                <p className="text-xs text-muted-foreground">Read our terms of service</p>
              </div>
            </button>

            <button
              onClick={() => setShowPrivacy(true)}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors w-full text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-body font-medium text-foreground">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">Learn how we protect your data</p>
              </div>
            </button>
          </div>

          {/* Checkbox */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-background/50 border border-border/50 mb-6">
            <Checkbox
              id="consent"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="consent"
              className="text-sm font-body text-foreground cursor-pointer leading-relaxed"
            >
              I agree to the{" "}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-primary underline hover:no-underline"
              >
                Terms & Conditions
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="text-primary underline hover:no-underline"
              >
                Privacy Policy
              </button>
            </label>
          </div>

          {/* Continue button */}
          <Button
            onClick={handleAcceptTerms}
            disabled={!agreed || loading}
            className="w-full h-12 gradient-primary border-0 font-body font-semibold text-base shadow-soft hover:shadow-elevated transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Continue"}
          </Button>
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b border-border/50 flex-shrink-0">
            <DialogTitle className="font-display text-lg font-semibold text-foreground">
              Terms & Conditions
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-4 text-xs font-body text-foreground leading-relaxed space-y-4">
            <p className="text-muted-foreground text-xs">Last updated: December 18, 2025</p>
            <p>
              Welcome to Styloren. By accessing or using the Styloren mobile application ("App"), you agree to comply with and be bound by these Terms & Conditions ("Terms"). If you do not agree, please do not use the App.
            </p>

            <section>
              <h3 className="font-semibold mb-1">1. Use of the App</h3>
              <p className="text-muted-foreground">
                Styloren provides AI-powered outfit analysis and styling recommendations for informational and personal use only. You agree to use the App lawfully and responsibly, not misuse, reverse engineer, or attempt to disrupt the App or its services, and not upload unlawful, harmful, or offensive content.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">2. AI-Generated Recommendations</h3>
              <p className="text-muted-foreground">
                Styling suggestions are generated by artificial intelligence. Recommendations are advisory only and subjective in nature. Styloren does not guarantee fashion outcomes, personal satisfaction, or results.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">3. User Content & Scan History</h3>
              <p className="text-muted-foreground">
                When you upload outfit photos, Styloren processes them to generate styling recommendations. By default, your scans and analysis may be saved to your Scan History for your convenience. You may disable scan history storage at any time via Account → My Activity → Scan History. You retain ownership of your content. Styloren does not claim ownership over your photos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">4. Accounts & Security</h3>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized access to your account. Styloren is not responsible for losses caused by unauthorized access due to user negligence.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">5. Subscriptions & Payments</h3>
              <p className="text-muted-foreground">
                Styloren may offer paid plans and features. Prices, features, and availability may change at any time. All payments are handled via third-party payment platforms and are subject to their terms. Refunds, if applicable, follow platform-specific policies.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">6. Intellectual Property</h3>
              <p className="text-muted-foreground">
                All app content, branding, design, and software are the property of Styloren. You may not copy, reproduce, or redistribute any part of the App without permission.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">7. Limitation of Liability</h3>
              <p className="text-muted-foreground">
                Styloren shall not be liable for any indirect or consequential damages, loss of data, satisfaction, or personal decisions made based on AI suggestions, or service interruptions or technical issues beyond reasonable control. Use of the App is at your own discretion and risk.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">8. Termination</h3>
              <p className="text-muted-foreground">
                Styloren reserves the right to suspend or terminate access to the App if these Terms are violated.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">9. Changes to These Terms</h3>
              <p className="text-muted-foreground">
                We may update these Terms from time to time. Continued use of the App after changes means you accept the updated Terms.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">10. Contact Us</h3>
              <p className="text-muted-foreground">
                For questions or concerns regarding these Terms, contact: 📧 help@styloren.com
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b border-border/50 flex-shrink-0">
            <DialogTitle className="font-display text-lg font-semibold text-foreground">
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-4 text-xs font-body text-foreground leading-relaxed space-y-4">
            <p className="text-muted-foreground text-xs">Last updated: December 18, 2025</p>
            <p>
              Styloren ("we", "our", or "us") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use the Styloren mobile application.
            </p>

            <section>
              <h3 className="font-semibold mb-1">1. Information We Collect</h3>
              <p className="text-muted-foreground mb-2">When you use Styloren, we may collect:</p>
              <p className="text-muted-foreground">
                <strong>a) Information You Provide:</strong> Email address or login information, outfit photos you upload for analysis, messages and prompts you enter in the chat feature.
              </p>
              <p className="text-muted-foreground mt-1">
                <strong>b) Automatically Collected:</strong> App usage data (such as feature usage and timestamps), device information (basic, non-identifying technical data).
              </p>
              <p className="text-muted-foreground mt-1">
                We do not collect sensitive personal information such as government IDs, financial details, or precise location data.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">2. How We Use Your Information</h3>
              <p className="text-muted-foreground">
                We use your information to analyze outfits and provide AI-powered styling suggestions, show your previous scans and analysis within the app, improve app features and user experience, respond to support requests and feedback, and maintain app security and prevent misuse.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">3. Photo & Scan Data</h3>
              <p className="text-muted-foreground">
                Outfit images are uploaded only to generate styling recommendations. Scan results and images may be stored so you can view your scan history. Your photos are not shared publicly and are not visible to other users.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">4. Data Sharing</h3>
              <p className="text-muted-foreground">
                We do not sell, rent, or trade your personal data. We may share limited data only with trusted service providers (such as cloud storage or AI services) strictly to operate the app, or if required by law or legal process.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">5. Data Security</h3>
              <p className="text-muted-foreground">
                We take reasonable steps to protect your data, including secure connections (HTTPS), access control to user data, and private storage for uploaded images. While no system is 100% secure, we strive to use industry-standard safeguards.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">6. Your Choices & Control</h3>
              <p className="text-muted-foreground">
                You can view your scan history inside the app, manually delete scans from your history, and contact us if you have questions about your data. If you wish to delete your account or request data removal, please email us.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">7. Children's Privacy</h3>
              <p className="text-muted-foreground">
                Styloren is not intended for children under the age of 13. We do not knowingly collect personal data from children.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">8. Changes to This Policy</h3>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated date.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">9. Contact Us</h3>
              <p className="text-muted-foreground">
                If you have questions, feedback, or concerns about this Privacy Policy or your data, please contact us: 📧 help@styloren.com
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Consent;
