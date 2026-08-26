import { useState, useEffect } from "react";
import { colors, fonts, transitions } from "../lib/theme";
import { categories } from "../lib/theme";
import { BottomNav, type TabId } from "../lib/ui";
import { track } from "../lib/analytics";
import { fetchWeeklyWitnesses, generateThisWeekWitness, type WeeklyWitness } from "../lib/witness";
import { fetchMoments, type Moment } from "../lib/moments";

interface Props {
  onNavigate: (tab: TabId) => void;
}

export default function WitnessView({ onNavigate }: Props) {
  const [witnesses, setWitnesses] = useState<WeeklyWitness[]>([]);
  const [thisWeekMoments, setThisWeekMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [w, moments] = await Promise.all([
        fetchWeeklyWitnesses(),
        fetchMoments({ startDate: getThisWeekStart().toISOString() }),
      ]);
      setWitnesses(w);
      setThisWeekMoments(moments);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateThisWeekWitness();
      const w = await fetchWeeklyWitnesses();
      setWitnesses(w);
      track("witness_viewed", { action: "generated" });
    } catch { /* ignore */ }
    setGenerating(false);
  };

  useEffect(() => {
    track("witness_viewed", { count: witnesses.length });
    track("week_viewed", {});
  }, []);

  const thisWeekStats = computeStats(thisWeekMoments);

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
      {/* Header */}
      <div style={{ padding: "20px 24px 0" }}>
        <h1 style={{
          fontSize: 28, fontWeight: 300, color: colors.ink,
          margin: 0, lineHeight: 1.2,
        }}>
          Witness
        </h1>
        <p style={{
          fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
          margin: "4px 0 0", lineHeight: 1.6,
        }}>
          A quiet account of what you did.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 120px" }}>
        {/* This week summary */}
        <div style={{
          background: colors.paper, borderRadius: 16,
          border: `1px solid ${colors.rule}`,
          padding: "24px 20px", marginBottom: 24,
        }}>
          <p style={{
            fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
            letterSpacing: 2, textTransform: "uppercase", margin: "0 0 16px",
          }}>
            This week
          </p>

          {loading ? (
            <p style={{ fontSize: 13, color: colors.faint, fontFamily: fonts.sans }}>Loading...</p>
          ) : thisWeekMoments.length === 0 ? (
            <p style={{
              fontSize: 16, color: colors.muted, fontFamily: fonts.serif,
              lineHeight: 1.6, margin: 0, fontWeight: 300, fontStyle: "italic",
            }}>
              No moments recorded this week yet.
            </p>
          ) : (
            <>
              <p style={{
                fontSize: 17, color: colors.ink, fontFamily: fonts.serif,
                lineHeight: 1.6, margin: "0 0 20px", fontWeight: 300,
              }}>
                {thisWeekStats.summary}
              </p>

              {/* Stats grid */}
              <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <Stat label="Moments" value={thisWeekStats.total} />
                <Stat label="Days active" value={`${thisWeekStats.daysActive}/7`} />
                <Stat label="For you" value={thisWeekStats.forMe} />
              </div>

              {/* Category breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {categories.map(cat => {
                  const count = thisWeekStats.categories[cat.key] ?? 0;
                  if (count === 0) return null;
                  const pct = thisWeekStats.total > 0 ? (count / thisWeekStats.total) * 100 : 0;
                  return (
                    <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 10, fontFamily: fonts.sans, fontWeight: 600,
                        color: cat.tint, letterSpacing: 1, textTransform: "uppercase",
                        minWidth: 50,
                      }}>
                        {cat.label}
                      </span>
                      <div style={{ flex: 1, height: 4, background: colors.stone, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: cat.tint, borderRadius: 2,
                          transition: `width ${transitions.slow}`,
                        }} />
                      </div>
                      <span style={{
                        fontSize: 12, color: colors.muted, fontFamily: fonts.sans,
                        minWidth: 20, textAlign: "right",
                      }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Generate button */}
        {!loading && thisWeekMoments.length > 0 && (
          <button onClick={handleGenerate} disabled={generating} style={{
            width: "100%", padding: "14px 24px",
            background: generating ? colors.sand : "transparent",
            border: `1px solid ${generating ? colors.sand : colors.rule}`,
            borderRadius: 999,
            color: generating ? colors.faint : colors.body,
            fontSize: 13, fontFamily: fonts.sans, letterSpacing: 0.5,
            cursor: generating ? "default" : "pointer",
            marginBottom: 12, transition: "all 0.2s",
          }}>
            {generating ? "Generating..." : "Generate this week's witness"}
          </button>
        )}

        {/* Link to monthly record */}
        <button onClick={() => onNavigate("month")} style={{
          width: "100%", padding: "14px 24px",
          background: "transparent", border: "none",
          color: colors.muted, fontSize: 13, fontFamily: fonts.sans,
          letterSpacing: 0.5, cursor: "pointer", marginBottom: 32,
          textAlign: "center",
        }}>
          View archive →
        </button>

        {/* Past witnesses */}
        {witnesses.length > 0 && (
          <div>
            <p style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 16,
            }}>
              Past weeks
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {witnesses.map(w => (
                <div key={w.id} style={{
                  background: colors.paper, borderRadius: 14,
                  border: `1px solid ${colors.rule}`,
                  padding: "18px 18px",
                }}>
                  <p style={{
                    fontSize: 11, color: colors.faint, fontFamily: fonts.sans,
                    margin: "0 0 10px",
                  }}>
                    {new Date(w.week_start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {" — "}
                    {new Date(w.week_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                  <p style={{
                    fontSize: 15, color: colors.ink, fontFamily: fonts.serif,
                    lineHeight: 1.65, margin: 0, fontWeight: 300,
                  }}>
                    {w.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav active="witness" onChange={onNavigate} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{
        fontSize: 22, fontWeight: 300, color: colors.ink,
        fontFamily: fonts.serif, lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: colors.muted, fontFamily: fonts.sans,
        letterSpacing: 1, textTransform: "uppercase", marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
}

function getThisWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeStats(moments: Moment[]) {
  const total = moments.length;
  const days = new Set<string>();
  const cats: Record<string, number> = {};
  let forMe = 0;

  moments.forEach(m => {
    days.add(new Date(m.timestamp).toDateString());
    cats[m.category] = (cats[m.category] ?? 0) + 1;
    if (m.category === "me") forMe++;
  });

  const daysActive = days.size;

  // Generate summary text (client-side, mirrors the DB function)
  let summary = `This week you recorded ${total} moment${total !== 1 ? "s" : ""}.`;
  summary += ` You recorded on ${daysActive} of 7 days.`;

  const careCount = cats["care"] ?? 0;
  if (careCount > 0 && careCount >= total / 3) {
    summary += ` ${careCount} involved caring for someone else.`;
  } else if (forMe > 0) {
    summary += ` ${forMe} were things you did specifically for you.`;
  }

  return { total, daysActive, forMe, categories: cats, summary };
}
