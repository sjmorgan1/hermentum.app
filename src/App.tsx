import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { initSessionId, track } from "./lib/analytics";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import Onboarding from "./components/Onboarding";
import TodayView from "./components/TodayView";
import TimelineView from "./components/TimelineView";
import WitnessView from "./components/WitnessView";
import MonthView from "./components/MonthView";
import PrivacyView from "./components/PrivacyView";
import InstallPrompt from "./components/InstallPrompt";
import { type TabId } from "./lib/ui";
import { scheduleDailyReminder, cancelDailyReminder } from "./lib/notifications";
import { syncHealthData } from "./lib/healthSync";

type Screen = "loading" | "landing" | "auth" | "onboarding" | "app";
type AuthMode = "signup" | "signin";

const INSTALL_DISMISSED_KEY = "hermentum_install_dismissed";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [showInstall, setShowInstall] = useState(false);
  const installPromptRef = useRef<any>(null);
  const sessionRestored = useRef(false);

  useEffect(() => {
    initSessionId();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          // Schedule gentle reminders when logged in
          scheduleDailyReminder();
          // Track return session (not the first login)
          if (sessionRestored.current) {
            track("return_session", {});
          }
          sessionRestored.current = true;

          const { data } = await supabase
            .from("users")
            .select("name")
            .eq("id", session.user.id)
            .maybeSingle();

          if (data?.name) {
            setScreen("app");
            // Run a background HealthKit sync on launch if connected.
            void syncHealthData().catch(() => { /* silent background sync */ });
          } else {
            // Check if user has any moments (existing user who hasn't set name)
            const { count } = await supabase
              .from("moments")
              .select("*", { count: "exact", head: true })
              .eq("user_id", session.user.id);
            if (count && count > 0) {
              setScreen("app");
            } else {
              setScreen("onboarding");
            }
          }
        } else {
          cancelDailyReminder();
          setScreen("landing");
        }
      })();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (screen === "loading" || screen === "onboarding") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    const t = setTimeout(() => setShowInstall(true), 1500);
    return () => clearTimeout(t);
  }, [screen]);

  const handleInstallDismiss = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setShowInstall(false);
  };

  const installOverlay = showInstall ? (
    <InstallPrompt
      onDismiss={handleInstallDismiss}
      installPrompt={installPromptRef.current}
    />
  ) : null;

  if (screen === "loading") {
    return (
      <div style={{
        fontFamily: "Georgia, serif",
        background: "#FAF8F5",
        minHeight: "100vh",
        maxWidth: 390,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{ fontSize: 13, color: "#B5B0A8", fontFamily: "sans-serif" }}>Loading...</p>
      </div>
    );
  }

  if (screen === "landing") {
    return (
      <>
        <LandingPage
          onTryApp={() => { setAuthMode("signup"); setScreen("auth"); }}
          onSignIn={() => { setAuthMode("signin"); setScreen("auth"); }}
        />
        {installOverlay}
      </>
    );
  }

  if (screen === "auth") {
    return (
      <AuthScreen
        defaultMode={authMode}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "onboarding") {
    return (
      <Onboarding
        onComplete={() => {
          setScreen("app");
        }}
      />
    );
  }

  // Main app — tab navigation
  const navigate = (tab: TabId) => {
    setActiveTab(tab);
  };

  let content;
  if (activeTab === "today") content = <TodayView onNavigate={navigate} />;
  else if (activeTab === "timeline") content = <TimelineView onNavigate={navigate} />;
  else if (activeTab === "witness") content = <WitnessView onNavigate={navigate} />;
  else if (activeTab === "privacy") content = <PrivacyView onNavigate={navigate} />;

  // Month view is shown when navigating from witness
  if (activeTab === "month") content = <MonthView onNavigate={(t) => setActiveTab(t === "witness" ? "witness" : t)} />;

  return <>{content}{installOverlay}</>;
}
