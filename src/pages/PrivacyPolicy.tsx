import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/account")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold text-foreground">Privacy Policy</span>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Privacy Policy – Styloren
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Last updated: December 18, 2025
          </p>

          <div className="space-y-6 text-foreground font-body leading-relaxed">
            <p>
              Styloren ("we", "our", or "us") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use the Styloren mobile application.
            </p>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">1. Information We Collect</h2>
              <p className="mb-3">When you use Styloren, we may collect the following information:</p>
              
              <h3 className="font-semibold mb-2">a) Information You Provide</h3>
              <ul className="list-disc list-inside space-y-1 mb-3 text-muted-foreground">
                <li>Email address or login information</li>
                <li>Outfit photos you upload for analysis</li>
                <li>Messages and prompts you enter in the chat feature</li>
              </ul>

              <h3 className="font-semibold mb-2">b) Automatically Collected Information</h3>
              <ul className="list-disc list-inside space-y-1 mb-3 text-muted-foreground">
                <li>App usage data (such as feature usage and timestamps)</li>
                <li>Device information (basic, non-identifying technical data)</li>
              </ul>

              <p className="text-muted-foreground">
                We do not collect sensitive personal information such as government IDs, financial details, or precise location data.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">2. How We Use Your Information</h2>
              <p className="mb-2">We use your information to:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Analyze outfits and provide AI-powered styling suggestions</li>
                <li>Show your previous scans and analysis within the app</li>
                <li>Improve app features and user experience</li>
                <li>Respond to support requests and feedback</li>
                <li>Maintain app security and prevent misuse</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                Your photos and data are only used to provide app functionality.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">3. Photo & Scan Data</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Outfit images are uploaded only to generate styling recommendations.</li>
                <li>Scan results and images may be stored so you can view your scan history.</li>
                <li>Your photos are not shared publicly and are not visible to other users.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">4. Data Sharing</h2>
              <p className="mb-3">We do not sell, rent, or trade your personal data.</p>
              <p className="mb-2">We may share limited data only when necessary:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>With trusted service providers (such as cloud storage or AI services) strictly to operate the app</li>
                <li>If required by law or legal process</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                All partners are required to follow appropriate data protection practices.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">5. Data Security</h2>
              <p className="mb-2">We take reasonable steps to protect your data, including:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Secure connections (HTTPS)</li>
                <li>Access control to user data</li>
                <li>Private storage for uploaded images</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                While no system is 100% secure, we strive to use industry-standard safeguards to protect your information.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">6. Your Choices & Control</h2>
              <p className="mb-2">You can:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>View your scan history inside the app</li>
                <li>Manually delete scans from your history</li>
                <li>Contact us if you have questions about your data</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                If you wish to delete your account or request data removal, please email us.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">7. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Styloren is not intended for children under the age of 13. We do not knowingly collect personal data from children.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">8. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated date.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-3">9. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions, feedback, or concerns about this Privacy Policy or your data, please contact us:
              </p>
              <p className="mt-2">
                📧{" "}
                <a 
                  href="mailto:help@styloren.com" 
                  className="text-primary underline"
                >
                  help@styloren.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
