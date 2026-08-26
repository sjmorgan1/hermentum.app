import { useState, useRef, useEffect } from "react";
import { colors, fonts, transitions, categories, type CategoryKey } from "../lib/theme";
import { getSpeechAdapter, isWebSpeechAvailable, type SpeechRecognitionResult } from "../lib/speech";
import { parseMoments, type ParsedMoment } from "../lib/momentParser";
import { track } from "../lib/analytics";

interface Props {
  onConfirm: (moments: { category: CategoryKey; note: string }[]) => void;
  onClose: () => void;
}

type Phase = "listening" | "review";

export default function VoiceCapture({ onConfirm, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [parsed, setParsed] = useState<ParsedMoment[]>([]);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const speechAvailable = isWebSpeechAvailable();
  const adapter = getSpeechAdapter();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!speechAvailable) {
      // Focus the fallback text input
      setTimeout(() => textAreaRef.current?.focus(), 100);
    }
    return () => {
      adapter.stop();
    };
  }, []);

  const handleStartListening = () => {
    setError("");
    setTranscript("");
    setInterim("");
    setListening(true);
    track("voice_capture_started", { native: true });

    adapter.start(
      (result: SpeechRecognitionResult) => {
        if (result.isFinal) {
          setTranscript((prev) => (prev + " " + result.transcript).trim());
          setInterim("");
        } else {
          setInterim(result.transcript);
        }
      },
      (err: string) => {
        setError(err);
        setListening(false);
      }
    );
  };

  const handleStopListening = () => {
    adapter.stop();
    setListening(false);
    track("voice_capture_completed", { native: true });
  };

  const handleDoneSpeaking = () => {
    if (listening) handleStopListening();

    const text = transcript.trim();
    if (!text) return;

    const moments = parseMoments(text);
    if (moments.length > 0) {
      setParsed(moments);
      setPhase("review");
    }
  };

  const handleFallbackSubmit = () => {
    const text = fallbackText.trim();
    if (!text) return;

    track("voice_capture_started", { native: false });
    track("voice_capture_completed", { native: false });

    const moments = parseMoments(text);
    if (moments.length > 0) {
      setParsed(moments);
      setPhase("review");
    }
  };

  const handleEditMoment = (id: string, text: string) => {
    setParsed((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
  };

  const handleChangeCategory = (id: string, category: CategoryKey) => {
    setParsed((prev) => prev.map((m) => (m.id === id ? { ...m, category } : m)));
  };

  const handleDeleteMoment = (id: string) => {
    setParsed((prev) => prev.filter((m) => m.id !== id));
  };

  const handleConfirmAll = () => {
    if (parsed.length === 0) return;
    track("voice_moment_confirmed", { count: parsed.length });
    onConfirm(parsed.map((m) => ({ category: m.category, note: m.text })));
  };

  const handleCancel = () => {
    track("voice_capture_cancelled", { phase });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleCancel} style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(28,26,23,0.25)",
        animation: "fadeIn 0.2s ease",
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 390, background: colors.paper,
        borderRadius: "24px 24px 0 0",
        paddingBottom: "max(28px, env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -8px 48px rgba(28,26,23,0.12)",
        zIndex: 201,
        maxHeight: "85vh",
        display: "flex", flexDirection: "column",
        animation: "slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.whisper }} />
        </div>

        {/* ── Listening phase ── */}
        {phase === "listening" && (
          <div style={{ padding: "16px 24px 0", overflowY: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{
                fontSize: 11, color: colors.muted, letterSpacing: 3,
                textTransform: "uppercase", fontFamily: fonts.sans, fontWeight: 600,
              }}>
                Tell Hermentum
              </span>
            </div>

            {speechAvailable ? (
              <>
                {/* Microphone button */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                  <button
                    onClick={listening ? handleStopListening : handleStartListening}
                    style={{
                      width: 80, height: 80, borderRadius: "50%",
                      border: "none",
                      background: listening ? colors.accent : colors.ink,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: `all ${transitions.fast}`,
                      WebkitTapHighlightColor: "transparent",
                      boxShadow: listening
                        ? "0 0 0 8px rgba(198,138,94,0.15)"
                        : "0 4px 16px rgba(28,26,23,0.12)",
                    }}
                  >
                    {/* Microphone icon */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.cream} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                </div>

                {/* Status text */}
                <p style={{
                  fontSize: 14, color: colors.muted, fontFamily: fonts.sans,
                  textAlign: "center", marginBottom: 20, lineHeight: 1.5,
                }}>
                  {listening
                    ? "Listening... Tap the microphone when you're done."
                    : "Tap the microphone and tell me what you've done."}
                </p>

                {/* Live transcript */}
                {(transcript || interim) && (
                  <div style={{
                    background: colors.cream, borderRadius: 14,
                    padding: "16px 18px", marginBottom: 20,
                    border: `1px solid ${colors.rule}`,
                  }}>
                    <p style={{
                      fontSize: 16, color: colors.ink, fontFamily: fonts.serif,
                      lineHeight: 1.6, margin: 0,
                    }}>
                      {transcript}
                      {interim && (
                        <span style={{ color: colors.faint }}>{interim}</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    background: colors.errorBg, borderRadius: 10,
                    padding: "12px 14px", marginBottom: 16,
                  }}>
                    <p style={{
                      fontSize: 13, color: colors.error, fontFamily: fonts.sans,
                      margin: 0, lineHeight: 1.5,
                    }}>
                      {error}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, paddingBottom: 8 }}>
                  {transcript && (
                    <button
                      onClick={handleDoneSpeaking}
                      style={{
                        flex: 1, padding: "16px 24px",
                        background: colors.ink, border: "none", borderRadius: 999,
                        color: colors.cream, fontSize: 15, fontFamily: fonts.sans,
                        letterSpacing: 0.5, cursor: "pointer",
                      }}
                    >
                      Review →
                    </button>
                  )}
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: "16px 24px",
                      background: "transparent", border: `1px solid ${colors.rule}`,
                      borderRadius: 999, color: colors.muted,
                      fontSize: 15, fontFamily: fonts.sans, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Graceful fallback — text entry when speech recognition is unavailable */}
                <div style={{
                  background: colors.stone,
                  border: `1px solid ${colors.rule}`,
                  borderRadius: 12, padding: "14px 16px", marginBottom: 20,
                }}>
                  <p style={{
                    fontSize: 12, color: colors.body, fontFamily: fonts.sans,
                    lineHeight: 1.6, margin: 0,
                  }}>
                    Voice typing isn't available on this device. Type what you've done instead — the review flow is the same.
                  </p>
                </div>

                <textarea
                  ref={textAreaRef}
                  value={fallbackText}
                  onChange={(e) => setFallbackText(e.target.value)}
                  placeholder="I got both kids ready for school, packed their lunches, answered a difficult email and remembered to book the dentist."
                  style={{
                    width: "100%", padding: "16px 18px",
                    border: `1px solid ${colors.rule}`, borderRadius: 14,
                    fontSize: 16, fontFamily: fonts.serif, color: colors.ink,
                    background: colors.cream, outline: "none", boxSizing: "border-box",
                    minHeight: 120, resize: "none", lineHeight: 1.6,
                  }}
                />

                <div style={{ display: "flex", gap: 10, marginTop: 14, paddingBottom: 8 }}>
                  <button
                    onClick={handleFallbackSubmit}
                    disabled={!fallbackText.trim()}
                    style={{
                      flex: 1, padding: "16px 24px",
                      background: fallbackText.trim() ? colors.ink : colors.sand,
                      border: "none", borderRadius: 999,
                      color: fallbackText.trim() ? colors.cream : colors.faint,
                      fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
                      cursor: fallbackText.trim() ? "pointer" : "default",
                    }}
                  >
                    Review →
                  </button>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: "16px 24px",
                      background: "transparent", border: `1px solid ${colors.rule}`,
                      borderRadius: 999, color: colors.muted,
                      fontSize: 15, fontFamily: fonts.sans, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Review phase ── */}
        {phase === "review" && (
          <div style={{ padding: "16px 24px 0", overflowY: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span style={{
                fontSize: 11, color: colors.muted, letterSpacing: 3,
                textTransform: "uppercase", fontFamily: fonts.sans, fontWeight: 600,
              }}>
                I heard...
              </span>
              <p style={{
                fontSize: 14, color: colors.body, fontFamily: fonts.sans,
                margin: "8px 0 0", lineHeight: 1.5,
              }}>
                {parsed.length} moment{parsed.length !== 1 ? "s" : ""} found. Edit, delete, or change a category before saving.
              </p>
            </div>

            {/* Parsed moment cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {parsed.map((m) => {
                const cat = categories.find((c) => c.key === m.category);
                return (
                  <ParsedMomentCard
                    key={m.id}
                    moment={m}
                    tint={cat?.tint ?? colors.faint}
                    onEdit={handleEditMoment}
                    onChangeCategory={handleChangeCategory}
                    onDelete={handleDeleteMoment}
                  />
                );
              })}
            </div>

            {parsed.length === 0 && (
              <p style={{
                fontSize: 14, color: colors.muted, fontFamily: fonts.sans,
                textAlign: "center", padding: "20px 0",
              }}>
                No moments left. Cancel to go back.
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, paddingBottom: 8 }}>
              <button
                onClick={handleConfirmAll}
                disabled={parsed.length === 0}
                style={{
                  flex: 1, padding: "16px 24px",
                  background: parsed.length > 0 ? colors.ink : colors.sand,
                  border: "none", borderRadius: 999,
                  color: parsed.length > 0 ? colors.cream : colors.faint,
                  fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
                  cursor: parsed.length > 0 ? "pointer" : "default",
                }}
              >
                Add all to my record
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: "16px 24px",
                  background: "transparent", border: `1px solid ${colors.rule}`,
                  borderRadius: 999, color: colors.muted,
                  fontSize: 15, fontFamily: fonts.sans, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Parsed Moment Card ──────────────────────────────────────────────────────

function ParsedMomentCard({ moment, tint, onEdit, onChangeCategory, onDelete }: {
  moment: ParsedMoment;
  tint: string;
  onEdit: (id: string, text: string) => void;
  onChangeCategory: (id: string, category: CategoryKey) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(moment.text);

  const handleSave = () => {
    onEdit(moment.id, text.trim());
    setEditing(false);
  };

  return (
    <div style={{
      background: colors.cream, borderRadius: 12,
      border: `1px solid ${colors.rule}`,
      borderLeft: `3px solid ${tint}`,
      padding: "14px 16px",
    }}>
      {/* Category selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: tint, flexShrink: 0,
        }} />
        <select
          value={moment.category}
          onChange={(e) => onChangeCategory(moment.id, e.target.value as CategoryKey)}
          style={{
            fontSize: 9, fontFamily: fonts.sans, fontWeight: 600,
            color: tint, background: "transparent", border: "none",
            textTransform: "uppercase", letterSpacing: 1.5,
            cursor: "pointer", outline: "none", padding: 0,
            WebkitAppearance: "none",
          }}
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Text — editable */}
      {editing ? (
        <div>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            style={{
              width: "100%", padding: "8px 12px",
              border: `1px solid ${colors.rule}`, borderRadius: 8,
              fontSize: 15, fontFamily: fonts.serif, color: colors.ink,
              background: colors.paper, outline: "none", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
            <button onClick={handleSave} style={{
              background: "none", border: "none", color: colors.ink,
              fontFamily: fonts.sans, fontSize: 13, cursor: "pointer", padding: 0,
              fontWeight: 600,
            }}>Save</button>
            <button onClick={() => { setText(moment.text); setEditing(false); }} style={{
              background: "none", border: "none", color: colors.faint,
              fontFamily: fonts.sans, fontSize: 13, cursor: "pointer", padding: 0,
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <p style={{
          fontSize: 15, color: colors.ink, fontFamily: fonts.serif,
          lineHeight: 1.5, margin: 0,
        }}>
          {moment.text}
        </p>
      )}

      {/* Actions */}
      {!editing && (
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          <button onClick={() => setEditing(true)} style={{
            background: "none", border: "none", color: colors.whisper,
            fontFamily: fonts.sans, fontSize: 11, cursor: "pointer", padding: 0,
          }}>Edit</button>
          <button onClick={() => onDelete(moment.id)} style={{
            background: "none", border: "none", color: colors.whisper,
            fontFamily: fonts.sans, fontSize: 11, cursor: "pointer", padding: 0,
          }}>Delete</button>
        </div>
      )}
    </div>
  );
}
