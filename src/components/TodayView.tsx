import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import { colors, fonts, transitions } from "../lib/theme";
import { categories, type CategoryKey } from "../lib/theme";
import { createMoment, fetchTodayMoments, type Moment, formatTime } from "../lib/moments";
import { BottomNav, type TabId, LoadingScreen } from "../lib/ui";
import VoiceCapture from "./VoiceCapture";

interface Props {
  onNavigate: (tab: TabId) => void;
}

export default function TodayView({ onNavigate }: Props) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<CategoryKey | null>(null);

  useEffect(() => {
    loadMoments();
  }, []);

  const loadMoments = async () => {
    setLoading(true);
    try {
      const data = await fetchTodayMoments();
      setMoments(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleRecord = async (category: CategoryKey, note?: string) => {
    const m = await createMoment({ category, note: note || null });
    if (m) {
      setMoments(prev => [m, ...prev]);
      setJustAdded(m.id);
      setTimeout(() => setJustAdded(null), 600);
      track("moment_created", { source: "manual", category });
      track("moment_source", { source: "manual" });
      track("moment_category", { category });
    }
    setShowRecorder(false);
    setSavedFlash(category);
    setTimeout(() => setSavedFlash(null), 1200);
  };

  if (loading) return <LoadingScreen message="Loading your record..." />;

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
      {/* Recorder sheet */}
      {showRecorder && (
        <RecorderSheet
          onRecord={handleRecord}
          onClose={() => setShowRecorder(false)}
        />
      )}

      {/* Voice capture sheet */}
      {showVoice && (
        <VoiceCapture
          onConfirm={async (voiceMoments) => {
            for (const vm of voiceMoments) {
              const m = await createMoment({ category: vm.category, note: vm.note });
              if (m) {
                setMoments((prev) => [m, ...prev]);
                setJustAdded(m.id);
                setTimeout(() => setJustAdded(null), 600);
                track("moment_created", { source: "voice", category: vm.category });
                track("moment_source", { source: "voice" });
                track("moment_category", { category: vm.category });
              }
            }
            setShowVoice(false);
            setSavedFlash("me");
            setTimeout(() => setSavedFlash(null), 1200);
          }}
          onClose={() => setShowVoice(false)}
        />
      )}

      {/* Saved flash */}
      {savedFlash && !showRecorder && (
        <div style={{
          position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)",
          zIndex: 90, pointerEvents: "none",
          animation: "savedFlash 1.2s ease forwards",
        }}>
          <div style={{
            background: colors.ink, color: colors.cream,
            padding: "10px 20px", borderRadius: 999,
            fontSize: 13, fontFamily: fonts.sans, letterSpacing: 0.5,
            whiteSpace: "nowrap",
          }}>
            Saved
          </div>
        </div>
      )}

      {/* Header — HERMENTUM, date, accumulation count */}
      <div style={{ padding: "20px 24px 0" }}>
        <span style={{
          fontSize: 11, color: colors.muted, letterSpacing: 3,
          textTransform: "uppercase", fontFamily: fonts.sans, fontWeight: 600,
        }}>
          Hermentum
        </span>
        <p style={{
          fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
          margin: "6px 0 0", lineHeight: 1.5,
        }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Accumulation count */}
      <div style={{ padding: "8px 24px 0" }}>
        <h1 style={{
          fontSize: 28, fontWeight: 300, color: colors.ink,
          margin: 0, lineHeight: 1.3,
        }}>
          {moments.length > 0
            ? `You've already done ${moments.length} thing${moments.length !== 1 ? "s" : ""} today.`
            : "Today"}
        </h1>
      </div>

      {/* Moments list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 160px" }}>
        {moments.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            paddingTop: 80, paddingBottom: 40,
          }}>
            <p style={{
              fontSize: 16, color: colors.muted, fontFamily: fonts.serif,
              lineHeight: 1.6, maxWidth: 220, textAlign: "center",
              fontWeight: 300, fontStyle: "italic",
            }}>
              The record is empty. When you do something, hold this button.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {moments.map((m, i) => (
              <MomentRow
                key={m.id}
                moment={m}
                justAdded={justAdded === m.id}
                isLast={i === moments.length - 1}
                onDismiss={async () => {
                  await supabase.from("moments").update({ dismissed: true }).eq("id", m.id);
                  setMoments(prev => prev.filter(x => x.id !== m.id));
                  if (m.source !== "manual") track("automatic_moment_deleted", { source_type: m.source_type });
                }}
                onEdit={async (note) => {
                  await supabase.from("moments").update({ note }).eq("id", m.id);
                  setMoments(prev => prev.map(x => x.id === m.id ? { ...x, note } : x));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* I DID IT + Tell Hermentum — thumb-reachable */}
      <div style={{
        position: "fixed", bottom: 76, left: "50%", transform: "translateX(-50%)",
        width: 390, padding: "0 24px",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* Tell Hermentum — secondary, lighter */}
        <button
          onClick={() => setShowVoice(true)}
          style={{
            width: "100%", padding: "14px 24px",
            background: "transparent", border: `1px solid ${colors.rule}`, borderRadius: 999,
            color: colors.muted, fontSize: 14, fontFamily: fonts.sans,
            letterSpacing: 1, cursor: "pointer", pointerEvents: "auto",
            transition: `all ${transitions.fast}`,
            WebkitTapHighlightColor: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {/* Microphone icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          Tell Hermentum
        </button>

        {/* I DID IT — large, dominant */}
        <button
          onClick={() => setShowRecorder(true)}
          onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          style={{
            width: "100%", padding: "18px 24px",
            background: colors.ink, border: "none", borderRadius: 999,
            color: colors.cream, fontSize: 16, fontFamily: fonts.sans,
            letterSpacing: 1.5, cursor: "pointer", pointerEvents: "auto",
            boxShadow: "0 6px 24px rgba(28,26,23,0.18)",
            transition: `transform ${transitions.fast}`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          I DID IT
        </button>
      </div>

      <BottomNav active="today" onChange={onNavigate} />
    </div>
  );
}

// ─── Moment Row ──────────────────────────────────────────────────────────────

function MomentRow({ moment, justAdded, isLast, onDismiss, onEdit }: {
  moment: Moment;
  justAdded: boolean;
  isLast: boolean;
  onDismiss: () => void;
  onEdit: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [noteVal, setNoteVal] = useState(moment.note ?? "");
  const isFound = moment.source !== "manual";
  const cat = categories.find(c => c.key === moment.category);
  const tint = cat?.tint ?? colors.faint;
  const label = isFound ? "Hermentum Found" : (cat?.label ?? moment.category);
  const labelColor = isFound ? colors.foundText : tint;

  // The display text: note if present, otherwise the source label for found moments
  const displayText = moment.note
    ? moment.note
    : isFound
      ? (moment.source_metadata && typeof moment.source_metadata === "object" && "label" in moment.source_metadata
          ? String(moment.source_metadata.label)
          : moment.source_type)
      : null;

  if (editing) {
    return (
      <div style={{
        paddingBottom: isLast ? 0 : 20,
        opacity: justAdded ? 0 : 1,
        animation: justAdded ? "fadeIn 0.4s ease" : undefined,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{
            fontSize: 12, color: colors.faint, fontFamily: fonts.sans,
            flexShrink: 0, minWidth: 36, paddingTop: 3,
          }}>
            {formatTime(moment.timestamp)}
          </span>
          <div style={{ flex: 1 }}>
            <input
              autoFocus
              value={noteVal}
              onChange={e => setNoteVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { onEdit(noteVal); setEditing(false); }
              }}
              placeholder="What did you do?"
              style={{
                width: "100%", padding: "8px 12px",
                border: `1px solid ${colors.rule}`, borderRadius: 8,
                fontSize: 15, fontFamily: fonts.serif, color: colors.ink,
                background: colors.paper, outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <button onClick={() => { onEdit(noteVal); setEditing(false); }} style={{
                background: "none", border: "none", color: colors.ink,
                fontFamily: fonts.sans, fontSize: 13, cursor: "pointer", padding: 0,
                fontWeight: 600,
              }}>Save</button>
              <button onClick={() => setEditing(false)} style={{
                background: "none", border: "none", color: colors.faint,
                fontFamily: fonts.sans, fontSize: 13, cursor: "pointer", padding: 0,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      paddingBottom: isLast ? 0 : 20,
      opacity: justAdded ? 0 : 1,
      animation: justAdded ? "fadeIn 0.4s ease" : undefined,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Time — small, quiet */}
        <span style={{
          fontSize: 12, color: colors.faint, fontFamily: fonts.sans,
          flexShrink: 0, minWidth: 36, paddingTop: 3,
        }}>
          {formatTime(moment.timestamp)}
        </span>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {/* Source/category label — small, above the text */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Small dot to distinguish sources visually */}
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: isFound ? colors.foundText : tint,
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 9, color: labelColor, fontFamily: fonts.sans,
              letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
            }}>
              {label}
            </span>
          </div>

          {/* The actual moment text — the hero */}
          {displayText && (
            <p style={{
              fontSize: 16, color: colors.ink, fontFamily: fonts.serif,
              lineHeight: 1.5, margin: "5px 0 0",
            }}>
              {displayText}
            </p>
          )}

          {/* For manual moments without a note — subtle add note prompt */}
          {!moment.note && !isFound && (
            <button onClick={() => setEditing(true)} style={{
              background: "none", border: "none", color: colors.whisper,
              fontFamily: fonts.sans, fontSize: 13, cursor: "pointer",
              padding: 0, marginTop: 4,
            }}>
              + note
            </button>
          )}

          {/* Found moment actions — subtle, only on tap would be ideal but keep minimal */}
          {isFound && (
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              <button onClick={() => setEditing(true)} style={{
                background: "none", border: "none", color: colors.whisper,
                fontFamily: fonts.sans, fontSize: 11, cursor: "pointer", padding: 0,
              }}>Edit</button>
              <button onClick={onDismiss} style={{
                background: "none", border: "none", color: colors.whisper,
                fontFamily: fonts.sans, fontSize: 11, cursor: "pointer", padding: 0,
              }}>Dismiss</button>
            </div>
          )}
        </div>
      </div>

      {/* Divider — very subtle */}
      {!isLast && (
        <div style={{
          marginLeft: 48, marginTop: 14, height: 1, background: colors.ruleSoft,
        }} />
      )}
    </div>
  );
}

// ─── Recorder Sheet — optimised for speed ───────────────────────────────────
// Tap a category → saved instantly. No intermediate steps.
// Note can be added afterwards by tapping the moment.

function RecorderSheet({ onRecord, onClose }: {
  onRecord: (category: CategoryKey, note?: string) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"categories" | "note">("categories");
  const [selected, setSelected] = useState<CategoryKey | null>(null);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCategoryTap = (cat: CategoryKey) => {
    setSelected(cat);
    setPhase("note");
    // Auto-focus the note input after a brief delay for the transition
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSave = () => {
    if (selected) onRecord(selected, note);
  };

  const handleSkipNote = () => {
    if (selected) onRecord(selected);
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
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
        animation: "slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.whisper }} />
        </div>

        {/* Phase: Categories */}
        {phase === "categories" && (
          <div style={{ padding: "16px 24px 0" }}>
            {/* Category buttons — large, full-width, thumb-friendly */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {categories.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryTap(cat.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "18px 20px",
                    background: colors.cream,
                    border: "none",
                    borderLeft: `3px solid ${cat.tint}`,
                    borderRadius: 10,
                    cursor: "pointer", textAlign: "left",
                    transition: `all ${transitions.fast}`,
                    WebkitTapHighlightColor: "transparent",
                    minHeight: 56,
                  }}
                >
                  <span style={{
                    fontSize: 15, fontFamily: fonts.sans, fontWeight: 600,
                    color: colors.ink,
                    letterSpacing: 1, textTransform: "uppercase",
                  }}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Skip / close hint */}
            <button onClick={onClose} style={{
              width: "100%", background: "none", border: "none",
              color: colors.faint, fontFamily: fonts.sans, fontSize: 13,
              cursor: "pointer", padding: "16px 0 0",
            }}>
              Cancel
            </button>
          </div>
        )}

        {/* Phase: Note — appears after category tap */}
        {phase === "note" && selected && (
          <div style={{ padding: "16px 24px 0", animation: "fadeIn 0.2s ease" }}>
            {/* Selected category indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 20,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: categories.find(c => c.key === selected)?.tint ?? colors.faint,
              }} />
              <span style={{
                fontSize: 11, fontFamily: fonts.sans, fontWeight: 600,
                color: categories.find(c => c.key === selected)?.tint ?? colors.faint,
                letterSpacing: 1.5, textTransform: "uppercase",
              }}>
                {categories.find(c => c.key === selected)?.label}
              </span>
            </div>

            {/* Note input — large, easy to type in */}
            <input
              ref={inputRef}
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="What did you do?"
              style={{
                width: "100%", padding: "16px 18px",
                border: `1px solid ${colors.rule}`, borderRadius: 14,
                fontSize: 17, fontFamily: fonts.serif, color: colors.ink,
                background: colors.cream, outline: "none", boxSizing: "border-box",
              }}
            />

            {/* Two actions: Save with note, or skip */}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, padding: "16px 24px",
                  background: colors.ink, border: "none", borderRadius: 999,
                  color: colors.cream, fontSize: 15, fontFamily: fonts.sans,
                  letterSpacing: 0.5, cursor: "pointer",
                }}
              >
                Save
              </button>
              <button
                onClick={handleSkipNote}
                style={{
                  padding: "16px 24px",
                  background: "transparent", border: `1px solid ${colors.rule}`,
                  borderRadius: 999, color: colors.muted,
                  fontSize: 15, fontFamily: fonts.sans, cursor: "pointer",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
