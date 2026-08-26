import { useEffect, useState } from "react";

const GRAD = "linear-gradient(135deg, #C68A5E, #E8D5C4)";

interface Props {
  onDismiss: () => void;
  installPrompt: any;
}

export default function InstallPrompt({ onDismiss, installPrompt }: Props) {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 320);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") dismiss();
  };

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 299,
          background: "rgba(0,0,0,0.18)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      <div style={{
        position: "fixed", bottom: 0, left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "100%"})`,
        width: 390,
        background: "white",
        borderRadius: "22px 22px 0 0",
        paddingBottom: "max(28px, env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -8px 48px rgba(0,0,0,0.10)",
        zIndex: 300,
        transition: "transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
      }}>

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E8E5E0" }} />
        </div>

        <div style={{ padding: "16px 28px 8px" }}>

          {/* Icon + heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 13, background: GRAD, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 24, color: "white", fontFamily: "Georgia, serif", fontWeight: 300 }}>H</span>
            </div>
            <div>
              <div style={{ fontSize: 17, fontFamily: "Georgia, serif", color: "#1A1A1A", lineHeight: 1.3 }}>
                Add Hermentum to your home screen
              </div>
              <div style={{ fontSize: 12, color: "#AAA", fontFamily: "sans-serif", marginTop: 3 }}>
                Open it like any other app — no browser, no faff
              </div>
            </div>
          </div>

          {isIOS ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              {[
                {
                  n: 1,
                  icon: "↑",
                  label: "Tap the Share button",
                  desc: "The box-with-arrow icon at the bottom of Safari",
                },
                {
                  n: 2,
                  icon: "+",
                  label: `Tap "Add to Home Screen"`,
                  desc: "Scroll down the share sheet if you can't see it",
                },
                {
                  n: 3,
                  icon: "✓",
                  label: `Tap "Add" to confirm`,
                  desc: "Done — it'll appear on your home screen right away",
                },
              ].map(step => (
                <div key={step.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", background: GRAD, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: "white", fontFamily: "sans-serif", fontWeight: 600,
                  }}>
                    {step.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: "#1A1A1A", fontFamily: "sans-serif", fontWeight: 500, lineHeight: 1.4 }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#AAA", fontFamily: "sans-serif", marginTop: 2, lineHeight: 1.5 }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={handleInstall} style={{
              width: "100%", padding: "17px 24px", marginBottom: 12,
              background: GRAD, border: "none", borderRadius: 50,
              color: "white", fontSize: 14, fontFamily: "sans-serif",
              letterSpacing: 1, cursor: "pointer",
            }}>
              Add to Home Screen →
            </button>
          )}

          <button onClick={dismiss} style={{
            width: "100%", background: "none", border: "none",
            fontSize: 13, color: "#BBB", fontFamily: "sans-serif",
            cursor: "pointer", padding: "10px 0",
          }}>
            Not now
          </button>
        </div>
      </div>
    </>
  );
}
