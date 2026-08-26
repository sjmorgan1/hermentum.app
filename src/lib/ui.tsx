import { colors, fonts, spacing, radius, shadows, transitions } from "./theme";

// ─── Shared UI primitives ───────────────────────────────────────────────────

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: fonts.serif,
      background: colors.cream,
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflowX: "hidden",
    }}>
      {children}
    </div>
  );
}

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div style={{
      fontFamily: fonts.serif,
      background: colors.cream,
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <p style={{ fontSize: 13, color: colors.faint, fontFamily: fonts.sans }}>{message}</p>
    </div>
  );
}

export function Header({ title, onBack }: { title?: string; onBack?: () => void }) {
  return (
    <div style={{
      padding: "16px 24px 0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 14, cursor: "pointer", padding: 0,
        }}>
          ← Back
        </button>
      ) : <span />}
      {title && (
        <span style={{
          fontSize: 11, color: colors.muted, letterSpacing: 2,
          textTransform: "uppercase", fontFamily: fonts.sans,
        }}>
          {title}
        </span>
      )}
      <span style={{ width: 40 }} />
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, style }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%",
      padding: "18px 24px",
      background: disabled ? colors.sand : colors.ink,
      border: "none",
      borderRadius: 999,
      color: disabled ? colors.faint : colors.cream,
      fontSize: 15,
      fontFamily: fonts.sans,
      letterSpacing: 0.5,
      cursor: disabled ? "default" : "pointer",
      transition: "opacity 0.2s",
      ...style,
    }}>
      {children}
    </button>
  );
}

// ─── Bottom navigation ───────────────────────────────────────────────────────

export type TabId = "today" | "timeline" | "witness" | "privacy" | "month";

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "timeline", label: "Timeline" },
    { id: "witness", label: "Witness" },
    { id: "privacy", label: "Privacy" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: 390, background: colors.paper,
      borderTop: `1px solid ${colors.rule}`,
      display: "flex",
      paddingTop: 10,
      paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))",
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <span style={{
              fontSize: 10,
              fontFamily: fonts.sans,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: isActive ? colors.ink : colors.faint,
              fontWeight: isActive ? 600 : 400,
              transition: `color ${transitions.fast}`,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// re-export for convenience
export { colors, fonts, spacing, radius, shadows, transitions };
