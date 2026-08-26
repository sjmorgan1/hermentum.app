import { useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import { colors, fonts, transitions } from "../lib/theme";
import { seedDemoData } from "../lib/demoData";

const slides = [
  {
    emoji: "○",
    heading: "You're probably doing more than you think.",
    body: "Most of what you do is invisible — to you, and to everyone else.",
  },
  {
    emoji: "✦",
    heading: "Hermentum keeps a record.",
    body: "A private, chronological account of what you actually do. Not what you missed.",
  },
  {
    emoji: "◉",
    heading: "Some things it can notice.",
    body: "Your run. Your walk. Your sleep. Things your phone already knows.",
  },
  {
    emoji: "✎",
    heading: "Some things only you can know.",
    body: "The packed lunches. The difficult email. The bedtime. The phone call.",
  },
  {
    emoji: "∞",
    heading: "You don't need to remember everything.",
    body: "Hermentum holds it for you. You just record what matters.",
  },
  {
    emoji: "✓",
    heading: "Just record what matters.",
    body: "Three seconds is enough. The record builds itself.",
  },
];

interface Props {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  const isLast = step === slides.length - 1;
  const progress = ((step + 1) / slides.length) * 100;

  const handleNext = async () => {
    if (!isLast) {
      setStep(s => s + 1);
      return;
    }

    // Final slide — create account
    setCreating(true);
    track("onboarding_completed", { slides_viewed: slides.length });

    // Create user profile row
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").upsert({
        id: user.id,
        email: user.email ?? null,
      }, { onConflict: "id" });

      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        notification_frequency: "weekly",
        privacy_acknowledged: true,
      }, { onConflict: "user_id" });

      // Seed a realistic demo record so the user immediately sees
      // the emotional value of accumulation.
      await seedDemoData();
    }

    onComplete();
  };

  const slide = slides[step];

  return (
    <div style={{
      fontFamily: fonts.serif,
      background: colors.cream,
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Progress bar */}
      <div style={{ height: 2, background: colors.rule }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: colors.ink, transition: `width ${transitions.base}`,
        }} />
      </div>

      {/* Brand */}
      <div style={{ padding: "20px 24px 0", textAlign: "center" }}>
        <span style={{
          fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
          fontFamily: fonts.sans, color: colors.muted, fontWeight: 600,
        }}>
          Hermentum
        </span>
      </div>

      {/* Slide content */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 40, marginBottom: 32, color: colors.accent,
          fontFamily: fonts.serif, fontWeight: 300,
        }}>
          {slide.emoji}
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 300, color: colors.ink,
          lineHeight: 1.35, marginBottom: 16,
        }}>
          {slide.heading}
        </h1>
        <p style={{
          fontSize: 15, color: colors.body, fontFamily: fonts.sans,
          lineHeight: 1.7, maxWidth: 280,
        }}>
          {slide.body}
        </p>
      </div>

      {/* Step dots */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 6, paddingBottom: 20,
      }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: i === step ? colors.ink : colors.whisper,
            transition: `background ${transitions.fast}`,
          }} />
        ))}
      </div>

      {/* CTA */}
      <div style={{
        padding: "0 24px 40px",
      }}>
        <button onClick={handleNext} disabled={creating} style={{
          width: "100%", padding: "18px 24px",
          background: creating ? colors.sand : colors.ink,
          border: "none", borderRadius: 999,
          color: creating ? colors.faint : colors.cream,
          fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
          cursor: creating ? "default" : "pointer",
          transition: "opacity 0.2s",
        }}>
          {creating ? "Setting up..." : isLast ? "Create your record →" : "Continue →"}
        </button>
        {step > 0 && !creating && (
          <button onClick={() => setStep(s => s - 1)} style={{
            width: "100%", background: "none", border: "none",
            color: colors.faint, fontFamily: fonts.sans, fontSize: 13,
            cursor: "pointer", padding: "12px 0",
          }}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
