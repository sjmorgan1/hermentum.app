import { colors, fonts } from "../lib/theme";

interface Props {
  onTryApp: () => void;
  onSignIn: () => void;
}

export default function LandingPage({ onTryApp, onSignIn }: Props) {
  return (
    <div style={{
      fontFamily: fonts.serif,
      background: colors.cream,
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
    }}>
      {/* Nav */}
      <div style={{
        padding: "18px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          fontSize: 13, letterSpacing: 3, textTransform: "uppercase",
          fontFamily: fonts.sans, color: colors.ink, fontWeight: 600,
        }}>
          Hermentum
        </span>
        <button onClick={onSignIn} style={{
          fontSize: 11, fontFamily: fonts.sans, letterSpacing: 1, textTransform: "uppercase",
          color: colors.muted, background: "none", border: "none", cursor: "pointer", padding: 0,
        }}>
          Sign in
        </button>
      </div>

      {/* Hero */}
      <div style={{ padding: "40px 24px 48px", textAlign: "center" }}>
        <h1 style={{
          fontSize: 34, fontWeight: 300, color: colors.ink,
          lineHeight: 1.25, marginBottom: 20, letterSpacing: -0.5,
        }}>
          Stop tracking what you missed.
          <br />
          <span style={{ color: colors.accent }}>
            Start counting what you did.
          </span>
        </h1>
        <p style={{
          fontSize: 15, color: colors.body, lineHeight: 1.75,
          marginBottom: 36, fontFamily: fonts.sans, maxWidth: 300, margin: "0 auto 36px",
        }}>
          Hermentum is a private record of your life. It notices the things your phone can see. You add the things only you know.
        </p>

        <button onClick={onTryApp} style={{
          width: "100%", padding: "18px 24px",
          background: colors.ink, border: "none", borderRadius: 999,
          color: colors.cream, fontSize: 15, fontFamily: fonts.sans,
          letterSpacing: 0.5, cursor: "pointer",
          boxShadow: "0 8px 24px rgba(28,26,23,0.12)",
          transition: "opacity 0.2s",
        }}>
          Start your record →
        </button>
        <p style={{
          fontSize: 12, color: colors.faint, fontFamily: fonts.sans, marginTop: 12,
        }}>
          Private. Free. No streaks. No scores.
        </p>
      </div>

      {/* Concept sections */}
      <div style={{ padding: "0 24px 48px" }}>
        {/* What it notices */}
        <div style={{
          background: colors.paper, borderRadius: 20,
          border: `1px solid ${colors.rule}`,
          padding: "28px 24px", marginBottom: 16,
        }}>
          <p style={{
            fontSize: 11, color: colors.accent, fontFamily: fonts.sans,
            letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
            marginBottom: 16,
          }}>
            Hermentum Found
          </p>
          <p style={{
            fontSize: 16, color: colors.ink, fontFamily: fonts.serif,
            lineHeight: 1.6, margin: "0 0 20", fontWeight: 300,
          }}>
            Your run. Your walk. Your sleep. Things your phone already knows — Hermentum notices them for you.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { time: "07:42", label: "38 minute walk" },
              { time: "12:16", label: "42 minute workout" },
              { time: "23:00", label: "7.5 hours sleep" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "center",
                padding: "10px 14px", background: colors.foundBg,
                borderRadius: 10,
              }}>
                <span style={{
                  fontSize: 13, color: colors.faint, fontFamily: fonts.sans,
                  flexShrink: 0,
                }}>
                  {item.time}
                </span>
                <span style={{
                  fontSize: 9, color: colors.foundText, fontFamily: fonts.sans,
                  letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
                }}>
                  Found
                </span>
                <span style={{
                  fontSize: 14, color: colors.ink, fontFamily: fonts.serif, flex: 1,
                }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* What only you know */}
        <div style={{
          background: colors.paper, borderRadius: 20,
          border: `1px solid ${colors.rule}`,
          padding: "28px 24px", marginBottom: 16,
        }}>
          <p style={{
            fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
            letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
            marginBottom: 16,
          }}>
            I Did It
          </p>
          <p style={{
            fontSize: 16, color: colors.ink, fontFamily: fonts.serif,
            lineHeight: 1.6, margin: "0 0 20", fontWeight: 300,
          }}>
            The packed lunches. The difficult email. The bedtime. The phone call. Things only you can know — record them in three seconds.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { time: "08:14", cat: "CARE", label: "Packed school bags" },
              { time: "09:06", cat: "WORK", label: "Difficult email sent" },
              { time: "19:31", cat: "CARE", label: "Bedtime" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "center",
                padding: "10px 14px", background: colors.cream,
                borderRadius: 10,
              }}>
                <span style={{
                  fontSize: 13, color: colors.faint, fontFamily: fonts.sans,
                  flexShrink: 0,
                }}>
                  {item.time}
                </span>
                <span style={{
                  fontSize: 9, color: colors.care, fontFamily: fonts.sans,
                  letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
                }}>
                  {item.cat}
                </span>
                <span style={{
                  fontSize: 14, color: colors.ink, fontFamily: fonts.serif, flex: 1,
                }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Principles */}
      <div style={{ padding: "0 24px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            { title: "The record is the product", body: "No points. No streaks. No scores. Just a calm, honest account of what you actually did." },
            { title: "Privacy is central", body: "Your record is yours. You decide what Hermentum can see. You can disconnect anything, any time." },
            { title: "No guilt. Ever.", body: "Hermentum never tells you what you didn't do. It only shows you what you did." },
          ].map((item, i) => (
            <div key={i}>
              <div style={{
                fontSize: 16, fontWeight: 400, color: colors.ink,
                marginBottom: 6, lineHeight: 1.3, fontFamily: fonts.serif,
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: 14, color: colors.body, fontFamily: fonts.sans,
                lineHeight: 1.7,
              }}>
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{
        padding: "40px 24px 52px", textAlign: "center",
        background: colors.paper, borderTop: `1px solid ${colors.rule}`,
      }}>
        <h2 style={{
          fontSize: 22, fontWeight: 300, color: colors.ink,
          lineHeight: 1.35, marginBottom: 10,
        }}>
          You're probably doing more than you think.
        </h2>
        <p style={{
          fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
          lineHeight: 1.7, marginBottom: 24,
        }}>
          Start your record today. It takes two minutes.
        </p>
        <button onClick={onTryApp} style={{
          width: "100%", padding: "18px 24px",
          background: colors.ink, border: "none", borderRadius: 999,
          color: colors.cream, fontSize: 15, fontFamily: fonts.sans,
          letterSpacing: 0.5, cursor: "pointer",
          boxShadow: "0 6px 20px rgba(28,26,23,0.10)",
        }}>
          Get started →
        </button>
        <p style={{
          fontSize: 11, color: colors.faint, fontFamily: fonts.sans, marginTop: 32,
        }}>
          hermentum.co.uk · A private record of what you actually do.
        </p>
      </div>
    </div>
  );
}
