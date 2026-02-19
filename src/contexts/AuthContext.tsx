import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  termsAccepted: boolean | null; // null = not yet fetched
  refetchTerms: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  const fetchTermsStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("terms_accepted")
      .eq("user_id", userId)
      .maybeSingle();
    
    setTermsAccepted(data?.terms_accepted ?? false);
  };

  const refetchTerms = async () => {
    if (user) {
      await fetchTermsStatus(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Check if this is a new browser session and user didn't want to stay signed in
    const checkSessionPreference = async () => {
      const keepSignedIn = localStorage.getItem("keepSignedIn");
      const tempSession = sessionStorage.getItem("tempSession");
      
      // If user didn't want to keep signed in and this is a new session (no tempSession marker)
      // then sign them out
      if (!keepSignedIn && !tempSession) {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          await supabase.auth.signOut();
        }
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer DB call to avoid deadlock
          setTimeout(() => {
            if (isMounted) {
              fetchTermsStatus(newSession.user.id);
            }
          }, 0);
        } else {
          setTermsAccepted(null);
        }

        // Only set loading false after handling the event
        if (event === "INITIAL_SESSION") {
          setIsLoading(false);
        }
      }
    );

    // Check session preference, THEN check for existing session
    checkSessionPreference().then(() => {
      supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
        if (!isMounted) return;
        
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          fetchTermsStatus(existingSession.user.id).finally(() => {
            if (isMounted) setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, termsAccepted, refetchTerms }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
