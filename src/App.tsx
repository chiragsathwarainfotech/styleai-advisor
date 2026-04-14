import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Analyze from "./pages/Analyze";
import Account from "./pages/Account";
import ScanHistory from "./pages/ScanHistory";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import NotFound from "./pages/NotFound";
import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { AppTrackingTransparency } from 'capacitor-plugin-app-tracking-transparency';
import { useEffect } from "react";
import { User } from "lucide-react";
import { useIOSLogic } from "./lib/platform";

import { NotificationService } from "@/lib/NotificationService";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    async function initApp() {
      // Initialize RevenueCat
      if (Capacitor.isNativePlatform()) {
        try {
          const platform = Capacitor.getPlatform();
          console.log(`[Diagnostic] Platform: ${platform}`);

          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
          console.log("[Diagnostic] RevenueCat Log Level set to DEBUG");

          let apiKey = "";
          if (platform === "android") {
            apiKey = "goog_AOXyYHWMVxNshsjHtHOTleuuysM";
          } else if (useIOSLogic()) {
            apiKey = "appl_cRDLefGebMAITzuQjHnFmmqqKlU";
            console.log("[Diagnostic] Applying iOS/Apple logic for RevenueCat");
          }

          console.log(`[Diagnostic] Using API Key: ${apiKey.substring(0, 10)}...`);

          await Purchases.configure({
            apiKey: apiKey,
          });

          console.log("RevenueCat configured successfully for:", platform);

          // Test fetch to see if any products are reachable
          const offerings = await Purchases.getOfferings();
          console.log("[Diagnostic] Current Offering:", offerings.current?.identifier || "None");
          console.log("[Diagnostic] Available Offerings:", Object.keys(offerings.all));
        } catch (error) {
          console.error("RevenueCat init error:", error);
        }

        // Initialize Notifications
        try {
          console.log("[Diagnostic] Initializing NotificationService...");
          await NotificationService.init();
          console.log("NotificationService initialized successfully");
        } catch (error) {
          console.error("NotificationService init error (Caught in App.tsx):", error);
        }

        // Initialize App Tracking Transparency
        try {
          console.log("[Diagnostic] Requesting Tracking Permission...");
          const status = await AppTrackingTransparency.requestPermission();
          console.log("[Diagnostic] Tracking Status:", status.status);
        } catch (error) {
          console.error("AppTrackingTransparency error:", error);
        }



      }
    }

    initApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/analyze" element={<Analyze />} />
                <Route path="/account" element={<Account />} />
                <Route path="/scan-history" element={<ScanHistory />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-conditions" element={<TermsConditions />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
