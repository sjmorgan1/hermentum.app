import { useState, useEffect } from "react";
import { colors, fonts, transitions } from "../lib/theme";
import { categories } from "../lib/theme";
import { BottomNav, type TabId } from "../lib/ui";
import { track } from "../lib/analytics";
import { fetchMoments, type Moment, formatDate } from "../lib/moments";

interface Props {
  onNavigate: (tab: TabId) => void;
}

export default function MonthView({ onNavigate }: Props) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  useEffect(() => {
    track("month_viewed", {});
    loadMoments();
  }, []);

  const loadMoments = async () => {
    setLoading(true);
    try {
      const data = await fetchMoments({
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString(),
      });
      setMoments(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  // Compute stats
  const total = moments.length;
  const days = new Set<string>();
  const cats: Record<string, number> = {};
  let auto = 0;
  let manual = 0;

  moments.forEach(m => {
    days.add(new Date(m.timestamp).toDateString());
    cats[m.category] = (cats[m.category] ?? 0) + 1;
    if (m.source === "manual") manual++; else auto++;
  });

  const grouped = groupByDate(moments);

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
          Archive
        </h1>
        <p style={{
          fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
          margin: "4px 0 0",
        }}>
          {now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 120px" }}>
        {loading ? (
          <p style={{ fontSize: 13, color: colors.faint, fontFamily: fonts.sans, textAlign: "center", paddingTop: 40 }}>
            Loading...
          </p>
        ) : total === 0 ? (
          <p style={{
            fontSize: 16, color: colors.muted, fontFamily: fonts.serif,
            textAlign: "center", paddingTop: 80, lineHeight: 1.6,
            maxWidth: 220, margin: "0 auto", fontWeight: 300, fontStyle: "italic",
          }}>
            No moments this month yet.
          </p>
        ) : (
          <>
            {/* Stats */}
            <div style={{
              display: "flex", gap: 24, marginBottom: 28,
              paddingBottom: 24, borderBottom: `1px solid ${colors.ruleSoft}`,
            }}>
              <BigStat label="Moments" value={total} />
              <BigStat label="Days recorded" value={days.size} />
            </div>

            {/* Manual vs automatic */}
            <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
              <div style={{
                flex: 1, background: colors.paper, borderRadius: 12,
                border: `1px solid ${colors.rule}`, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 22, fontWeight: 300, color: colors.ink, fontFamily: fonts.serif }}>
                  {manual}
                </div>
                <div style={{ fontSize: 10, color: colors.muted, fontFamily: fonts.sans, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>
                  You recorded
                </div>
              </div>
              <div style={{
                flex: 1, background: colors.paper, borderRadius: 12,
                border: `1px solid ${colors.rule}`, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 22, fontWeight: 300, color: colors.ink, fontFamily: fonts.serif }}>
                  {auto}
                </div>
                <div style={{ fontSize: 10, color: colors.muted, fontFamily: fonts.sans, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>
                  Hermentum found
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <p style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 16,
            }}>
              By category
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {categories.map(cat => {
                const count = cats[cat.key] ?? 0;
                if (count === 0) return null;
                const pct = total > 0 ? (count / total) * 100 : 0;
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

            {/* Full chronological record */}
            <p style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 16,
            }}>
              The record
            </p>
            <div>
              {Object.entries(grouped).map(([dateKey, dayMoments]) => (
                <div key={dateKey} style={{ marginBottom: 28 }}>
                  <div style={{
                    fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
                    letterSpacing: 2, textTransform: "uppercase",
                    marginBottom: 14, paddingBottom: 8,
                    borderBottom: `1px solid ${colors.ruleSoft}`,
                  }}>
                    {formatDate(dayMoments[0].timestamp)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {dayMoments.map((m, i) => (
                      <MonthRow key={m.id} moment={m} isLast={i === dayMoments.length - 1} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav active="witness" onChange={onNavigate} />
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{
        fontSize: 32, fontWeight: 300, color: colors.ink,
        fontFamily: fonts.serif, lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: colors.muted, fontFamily: fonts.sans,
        letterSpacing: 1, textTransform: "uppercase", marginTop: 6,
      }}>
        {label}
      </div>
    </div>
  );
}

function MonthRow({ moment, isLast }: { moment: Moment; isLast: boolean }) {
  const isFound = moment.source !== "manual";
  const cat = categories.find(c => c.key === moment.category);
  const tint = cat?.tint ?? colors.faint;
  const label = isFound ? "Hermentum Found" : (cat?.label ?? moment.category);
  const labelColor = isFound ? colors.foundText : tint;

  const displayText = moment.note
    ? moment.note
    : isFound
      ? (moment.source_metadata && typeof moment.source_metadata === "object" && "label" in moment.source_metadata
          ? String(moment.source_metadata.label)
          : moment.source_type)
      : null;

  return (
    <div style={{ paddingBottom: isLast ? 0 : 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{
          fontSize: 12, color: colors.faint, fontFamily: fonts.sans,
          flexShrink: 0, minWidth: 36, paddingTop: 3,
        }}>
          {new Date(moment.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
          {displayText && (
            <p style={{
              fontSize: 16, color: colors.ink, fontFamily: fonts.serif,
              lineHeight: 1.5, margin: "5px 0 0",
            }}>
              {displayText}
            </p>
          )}
        </div>
      </div>
      {!isLast && (
        <div style={{ marginLeft: 48, marginTop: 14, height: 1, background: colors.ruleSoft }} />
      )}
    </div>
  );
}

function groupByDate(moments: Moment[]): Record<string, Moment[]> {
  const groups: Record<string, Moment[]> = {};
  moments.forEach(m => {
    const d = new Date(m.timestamp);
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}
