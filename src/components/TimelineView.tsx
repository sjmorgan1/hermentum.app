import { useState, useEffect } from "react";
import { colors, fonts, transitions } from "../lib/theme";
import { categories } from "../lib/theme";
import { fetchMoments, type Moment, formatTime, formatDate } from "../lib/moments";
import { BottomNav, type TabId } from "../lib/ui";
import { track } from "../lib/analytics";

type Filter = "today" | "week" | "month" | "older";

interface Props {
  onNavigate: (tab: TabId) => void;
}

export default function TimelineView({ onNavigate }: Props) {
  const [filter, setFilter] = useState<Filter>("today");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track("timeline_opened", { filter });
  }, [filter]);

  useEffect(() => {
    loadMoments();
  }, [filter]);

  const loadMoments = async () => {
    setLoading(true);
    const now = new Date();
    let startDate: string;
    let endDate: string | undefined;

    switch (filter) {
      case "today": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        startDate = start.toISOString();
        endDate = end.toISOString();
        break;
      }
      case "week": {
        const start = new Date(now);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        startDate = start.toISOString();
        break;
      }
      case "month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = start.toISOString();
        break;
      }
      case "older": {
        const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        startDate = new Date(0).toISOString();
        endDate = start.toISOString();
        break;
      }
    }

    try {
      const data = await fetchMoments({ startDate, endDate });
      setMoments(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

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
          Timeline
        </h1>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: "14px 24px 0",
        display: "flex", gap: 6,
      }}>
        {(["today", "week", "month", "older"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px",
            background: filter === f ? colors.ink : "transparent",
            border: "none", borderRadius: 999,
            color: filter === f ? colors.cream : colors.muted,
            fontSize: 12, fontFamily: fonts.sans,
            letterSpacing: 0.5, textTransform: "capitalize",
            cursor: "pointer", transition: `all ${transitions.fast}`,
            WebkitTapHighlightColor: "transparent",
          }}>
            {f === "today" ? "Today" : f === "week" ? "This week" : f === "month" ? "This month" : "Older"}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 120px" }}>
        {loading ? (
          <p style={{ fontSize: 13, color: colors.faint, fontFamily: fonts.sans, textAlign: "center", paddingTop: 40 }}>
            Loading...
          </p>
        ) : moments.length === 0 ? (
          <p style={{
            fontSize: 16, color: colors.muted, fontFamily: fonts.serif,
            textAlign: "center", paddingTop: 80, lineHeight: 1.6,
            maxWidth: 220, margin: "0 auto", fontWeight: 300, fontStyle: "italic",
          }}>
            No moments in this period yet.
          </p>
        ) : (
          <div>
            {Object.entries(grouped).map(([dateKey, dayMoments]) => (
              <div key={dateKey} style={{ marginBottom: 32 }}>
                {/* Date header */}
                <div style={{
                  fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
                  letterSpacing: 2, textTransform: "uppercase",
                  marginBottom: 16, paddingBottom: 8,
                  borderBottom: `1px solid ${colors.ruleSoft}`,
                }}>
                  {formatDate(dayMoments[0].timestamp)}
                </div>
                {/* Moments */}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {dayMoments.map((m, i) => (
                    <TimelineRow key={m.id} moment={m} isLast={i === dayMoments.length - 1} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="timeline" onChange={onNavigate} />
    </div>
  );
}

function TimelineRow({ moment, isLast }: { moment: Moment; isLast: boolean }) {
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
        {/* Time — small, quiet */}
        <span style={{
          fontSize: 12, color: colors.faint, fontFamily: fonts.sans,
          flexShrink: 0, minWidth: 36, paddingTop: 3,
        }}>
          {formatTime(moment.timestamp)}
        </span>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {/* Source/category label */}
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

          {/* The moment text — the hero */}
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
