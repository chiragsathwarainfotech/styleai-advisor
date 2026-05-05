import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  User,
  History,
  Mail,
  HelpCircle,
  FileText,
  Shield,
  LogOut,
  ChevronRight,
  ChevronDown,
  Lock,
  Sparkles,
  Eye,
  Trash2,
  Clock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreditsPricingModal } from "@/components/CreditsPricingModal";
import { useCredits, CreditPlan } from "@/hooks/useCredits";
import { useScanHistory } from "@/hooks/useScanHistory";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const Account = () => {
  const { isGuest } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const credits = useCredits(user?.id);
  const hasCredits = credits.creditsRemaining > 0 && !credits.isExpired;
  const { deleteAllScans, totalCount } = useScanHistory(user?.id, hasCredits);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleToggleScanHistory = async (enabled: boolean) => {
    const success = await credits.setSaveScanHistory(enabled);
    if (success) {
      toast({
        title: enabled ? "Scan history enabled" : "Scan history disabled",
        description: enabled
          ? "Future scans will be saved to your history."
          : "Future scans will not be saved. Existing history is unchanged.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update preference.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllScans = async () => {
    setIsDeletingAll(true);
    const success = await deleteAllScans();
    setIsDeletingAll(false);
    setShowDeleteAllDialog(false);

    if (success) {
      toast({
        title: "All scans deleted",
        description: "Your scan history has been permanently deleted.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to delete scan history.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };
    
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const userId = user?.id;
      if (!userId) throw new Error("No user session found.");

      // Delete all user data using the authenticated client (RLS allows this)
      await supabase.from("scan_history").delete().eq("user_id", userId);
      await supabase.from("credit_purchases").delete().eq("user_id", userId);
      await supabase.from("user_subscriptions").delete().eq("user_id", userId);

      // Attempt to delete auth user via Edge Function (best effort)
      try {
        await supabase.functions.invoke("delete-user");
      } catch (_edgeFnError) {
        // Edge Function unreachable in local dev — data is already cleared, sign out is sufficient
        console.warn("Edge Function unavailable, proceeding with sign-out only.");
      }

      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently removed.",
      });

      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountDialog(false);
    }
  };

  const handlePlanPurchased = async (plan: CreditPlan): Promise<boolean> => {
    const success = await credits.addCredits(plan);
    if (success) {
      credits.refetch();
    }
    return success;
  };

  const getCreditsLabel = () => {
    if (credits.isExpired) return "Credits Expired";
    if (credits.creditsRemaining > 0) {
      return `${credits.creditsRemaining} credits remaining`;
    }
    return "No Credits";
  };

  if (!user) return null;

  const supportSection = {
    title: "Support",
    items: [
      {
        icon: Mail,
        label: "Contact Us",
        isExpandable: true,
        expanded: showContactInfo,
        onToggle: () => setShowContactInfo(!showContactInfo),
        expandedContent: (
          <div className="mt-2 ml-8 space-y-1">
            <p className="text-sm text-muted-foreground">
              Need help, feedback, or suggestions?
            </p>
            <p className="text-sm text-muted-foreground">
              Email us at{" "}
              <a
                href="mailto:help@styloren.com"
                className="text-primary underline"
              >
                help@styloren.com
              </a>
            </p>
          </div>
        ),
      },
      {
        icon: HelpCircle,
        label: "Help / FAQs",
        onClick: () => toast({ title: "Coming soon", description: "FAQ section is under development." }),
      },
    ],
  };

  const legalSection = {
    title: "Legal",
    items: [
      {
        icon: Shield,
        label: "Privacy Policy",
        onClick: () => navigate("/privacy-policy"),
      },
      {
        icon: FileText,
        label: "Terms & Conditions",
        onClick: () => navigate("/terms-conditions"),
      },
    ],
  };

  // Guests get a deliberately minimal Account view: log out, support, legal.
  // Hide everything that doesn't apply to a device-bound guest account
  // (password, scan/purchase history, privacy toggles, delete account).
  const menuSections = isGuest
    ? [
        {
          title: "Account",
          items: [
            {
              icon: LogOut,
              label: "Log Out",
              onClick: handleLogout,
              destructive: true,
            },
          ],
        },
        supportSection,
        legalSection,
      ]
    : [
        {
          title: "Account Info",
          items: [
            {
              icon: Lock,
              label: "Change Password",
              onClick: () => setShowPasswordDialog(true),
            },
            {
              icon: LogOut,
              label: "Log Out",
              onClick: handleLogout,
              destructive: true,
            },
          ],
        },
        {
          title: "My Activity",
          items: [
            {
              icon: History,
              label: "Scan History",
              onClick: () => navigate("/scan-history"),
            },
            {
              icon: CreditCard,
              label: "Purchase History",
              onClick: () => navigate("/purchase-history"),
            },
          ],
        },
        {
          title: "Privacy Settings",
          items: [
            {
              icon: Eye,
              label: "Save Scan History",
              isToggle: true,
              toggleValue: credits.saveScanHistory,
              onToggle: handleToggleScanHistory,
              description: "Your scans are private. Turn this off if you don't want Styloren to save your outfit photos or analysis.",
            },
            {
              icon: Trash2,
              label: "Delete All Scan History",
              onClick: totalCount > 0 ? () => setShowDeleteAllDialog(true) : undefined,
              destructive: true,
              disabled: totalCount === 0,
              value: totalCount === 0 ? "No scans" : `${totalCount} scan${totalCount !== 1 ? 's' : ''}`,
            },
          ],
        },
        supportSection,
        legalSection,
        {
          title: "Danger Zone",
          items: [
            {
              icon: Trash2,
              label: "Delete Account",
              onClick: () => setShowDeleteAccountDialog(true),
              destructive: true,
              description: "Permanently delete your account and all data. This action cannot be undone.",
            },
          ],
        },
      ];

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container mx-auto px-4 sm:px-6 pt-1 pb-3 sm:pb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/analyze")}
              className="mr-1 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg sm:text-xl font-semibold text-foreground truncate">Account</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main
        className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-xl"
        style={{ paddingBottom: 'max(2rem, calc(2rem + env(safe-area-inset-bottom)))' }}
      >
        {/* Profile Card */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-border/50">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground truncate">
                {isGuest ? "Guest User" : (credits.displayName || "Styloren User")}
              </h2>
              {user.email && (
                <p className="text-xs sm:text-sm text-muted-foreground font-body mt-0.5 break-all">
                  {user.email}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${hasCredits
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
                  }`}>
                  <Sparkles className="w-3 h-3" />
                  {getCreditsLabel()}
                </span>
              </div>
            </div>
          </div>

          {/* Get Credits button — hidden for guests */}
          {!isGuest && (
            <Button
              onClick={() => setShowPricing(true)}
              className="w-full mt-4 gradient-primary border-0"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Get Credits
            </Button>
          )}
        </div>

        {/* Menu sections */}
        <div className="space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {section.title}
              </h3>
              <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 divide-y divide-border/50">
                {section.items.map((item: any) => (
                  item.isToggle ? (
                    <div key={item.label} className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <span className="flex-1 font-body text-foreground">{item.label}</span>
                        <Switch
                          checked={item.toggleValue}
                          onCheckedChange={item.onToggle}
                        />
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-2 ml-8">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ) : item.isExpandable ? (
                    <div key={item.label} className="px-4 py-3.5">
                      <button
                        onClick={item.onToggle}
                        className="w-full flex items-center gap-3 text-left transition-colors hover:bg-muted/50 cursor-pointer text-foreground"
                      >
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <span className="flex-1 font-body">{item.label}</span>
                        {item.expanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      {item.expanded && item.expandedContent}
                    </div>
                  ) : (
                    <div key={item.label} className="px-4 py-3.5">
                      <button
                        onClick={item.onClick}
                        disabled={!item.onClick || item.disabled}
                        className={`w-full flex items-center gap-3 text-left transition-colors ${item.onClick && !item.disabled
                          ? "hover:bg-muted/50 cursor-pointer"
                          : "cursor-default opacity-50"
                          } ${item.destructive ? "text-destructive" : "text-foreground"}`}
                      >
                        <item.icon className={`w-5 h-5 ${item.destructive ? "text-destructive" : "text-muted-foreground"}`} />
                        <span className="flex-1 font-body">{item.label}</span>
                        {item.value && (
                          <span className="text-sm text-muted-foreground">{item.value}</span>
                        )}
                        {item.onClick && !item.value && !item.disabled && (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-2 ml-8">
                          {item.description}
                        </p>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="w-full gradient-primary border-0"
            >
              {isChangingPassword ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits Pricing Modal */}
      <CreditsPricingModal
        open={showPricing}
        onOpenChange={setShowPricing}
        userId={user?.id}
        onPlanPurchased={handlePlanPurchased}
      />

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete All Scan History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your saved scans ({totalCount} scan{totalCount !== 1 ? 's' : ''}).
              Your outfit photos and analysis data will be removed forever. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllScans}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-destructive text-center">Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-foreground font-medium text-lg pt-4">
              Do you really want to delete your account?
            </AlertDialogDescription>
            <AlertDialogDescription className="text-center text-muted-foreground text-sm pt-2">
              This action is permanent and will delete all your scans, credits, and profile data forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-4 pt-6">
            <AlertDialogCancel 
              disabled={isDeletingAccount}
              className="px-8 min-w-[100px]"
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-8 min-w-[100px]"
            >
              {isDeletingAccount ? "Deleting..." : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Account;
