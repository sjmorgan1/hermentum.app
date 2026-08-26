import { useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import { colors, fonts } from "../lib/theme";

interface Props {
  defaultMode: "signup" | "signin";
  onBack: () => void;
}

type Mode = "signup" | "signin";

export default function AuthScreen({ defaultMode, onBack }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  };

  const validate = (): string | null => {
    if (!email.includes("@")) return "Please enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (mode === "signup" && password !== confirm) return "Passwords don't match.";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: "https://hermentum.co.uk/" },
        });
        if (signUpError) {
          if (signUpError.message.toLowerCase().includes("already registered") ||
              signUpError.message.toLowerCase().includes("already exists")) {
            setError("That email is already registered.");
          } else {
            setError(signUpError.message);
          }
          return;
        }
        if (data.user) {
          track("user_created", { email });
          if (!data.session) {
            setEmailSent(true);
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          if (signInError.message.toLowerCase().includes("invalid") ||
              signInError.message.toLowerCase().includes("credentials")) {
            setError("Incorrect email or password.");
          } else {
            setError(signInError.message);
          }
          return;
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div style={{
        fontFamily: fonts.serif, background: colors.cream, minHeight: "100vh",
        maxWidth: 390, margin: "0 auto", padding: "40px 28px",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>✉</div>
        <h2 style={{
          fontSize: 26, fontWeight: 300, color: colors.ink,
          marginBottom: 12, lineHeight: 1.3,
        }}>
          Check your email
        </h2>
        <p style={{
          fontSize: 14, color: colors.body, fontFamily: fonts.sans,
          lineHeight: 1.7, marginBottom: 32,
        }}>
          We sent a confirmation link to <strong style={{ color: colors.ink }}>{email}</strong>. Open it to activate your account.
        </p>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 13, cursor: "pointer",
        }}>
          ← Back to home
        </button>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: fonts.serif, background: colors.cream, minHeight: "100vh",
      maxWidth: 390, margin: "0 auto", display: "flex", flexDirection: "column",
    }}>
      {/* Back */}
      <div style={{ padding: "20px 24px 0" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 13, cursor: "pointer", padding: 0,
        }}>
          ← Back
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
        <span style={{
          fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
          fontFamily: fonts.sans, color: colors.ink, fontWeight: 600,
        }}>
          Hermentum
        </span>
        <h1 style={{
          fontSize: 28, fontWeight: 300, color: colors.ink,
          marginTop: 16, marginBottom: 8, lineHeight: 1.3,
        }}>
          {mode === "signup" ? "Create your record" : "Welcome back"}
        </h1>
        <p style={{
          fontSize: 14, color: colors.muted, fontFamily: fonts.sans,
          lineHeight: 1.6, marginBottom: 32,
        }}>
          {mode === "signup"
            ? "Your private record starts here."
            : "Sign in to pick up where you left off."}
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        margin: "0 28px 28px",
        display: "flex", background: colors.paper,
        border: `1px solid ${colors.rule}`, borderRadius: 14, padding: 4,
      }}>
        {(["signup", "signin"] as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)} style={{
            flex: 1, padding: "10px 0",
            background: mode === m ? colors.ink : "transparent",
            border: "none", borderRadius: 10,
            fontSize: 13, fontFamily: fonts.sans,
            color: mode === m ? colors.cream : colors.muted,
            cursor: "pointer", transition: "all 0.2s",
            fontWeight: mode === m ? 600 : 400,
            letterSpacing: 0.3,
          }}>
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{
            fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
            letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7,
          }}>
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="you@example.com"
            style={{
              width: "100%", padding: "14px 16px",
              border: `1px solid ${colors.rule}`, borderRadius: 12,
              fontSize: 15, fontFamily: fonts.sans, color: colors.ink,
              background: colors.paper, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{
            fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
            letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7,
          }}>
            Password
          </label>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            style={{
              width: "100%", padding: "14px 16px",
              border: `1px solid ${colors.rule}`, borderRadius: 12,
              fontSize: 15, fontFamily: fonts.sans, color: colors.ink,
              background: colors.paper, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {mode === "signup" && (
          <div>
            <label style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7,
            }}>
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Type it again"
              style={{
                width: "100%", padding: "14px 16px",
                border: `1px solid ${colors.rule}`, borderRadius: 12,
                fontSize: 15, fontFamily: fonts.sans, color: colors.ink,
                background: colors.paper, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {error && (
          <div style={{
            background: colors.errorBg, border: `1px solid ${colors.error}`,
            borderRadius: 10, padding: "10px 14px",
          }}>
            <p style={{
              fontSize: 13, color: colors.error, fontFamily: fonts.sans,
              margin: 0, lineHeight: 1.5,
            }}>
              {error}
              {error.includes("already registered") && (
                <> <button onClick={() => switchMode("signin")} style={{
                  background: "none", border: "none", color: colors.error,
                  fontFamily: fonts.sans, fontSize: 13, cursor: "pointer",
                  padding: 0, textDecoration: "underline",
                }}>Sign in instead</button></>
              )}
            </p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "18px 24px",
            background: loading ? colors.sand : colors.ink,
            border: "none", borderRadius: 999,
            color: loading ? colors.faint : colors.cream,
            fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
            cursor: loading ? "default" : "pointer",
            marginTop: 4, transition: "opacity 0.2s",
          }}
        >
          {loading
            ? "Just a moment..."
            : mode === "signup"
              ? "Create account →"
              : "Sign in →"}
        </button>

        {mode === "signup" && (
          <p style={{
            fontSize: 11, color: colors.faint, fontFamily: fonts.sans,
            textAlign: "center", lineHeight: 1.6, margin: "4px 0 0",
          }}>
            We never sell your data. Your record is yours.
          </p>
        )}
      </div>
    </div>
  );
}
