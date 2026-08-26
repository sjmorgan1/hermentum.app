import { supabase } from "./supabase";
import { createMoment } from "./moments";

// ─────────────────────────────────────────────────────────────────────────────
// Demo data — a realistic 7-day record for a working mother.
// 30+ moments mixing manual (I DID IT) and automatic (HERMENTUM FOUND).
// Seeded once per user. Clearly flagged with is_demo = true.
// ─────────────────────────────────────────────────────────────────────────────

interface DemoMoment {
  daysAgo: number;
  hour: number;
  minute: number;
  category: string;
  note: string | null;
  source: string;
  source_type: string;
  source_metadata: Record<string, unknown>;
  confidence: string;
  duration_minutes: number | null;
}

const demoMoments: DemoMoment[] = [
  // ── Day 0 (today) ──
  { daysAgo: 0, hour: 7, minute: 42, category: "me", note: null, source: "demo", source_type: "walk", source_metadata: { label: "38 minute walk" }, confidence: "high", duration_minutes: 38 },
  { daysAgo: 0, hour: 8, minute: 3, category: "care", note: "Packed school bags", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 0, hour: 9, minute: 14, category: "work", note: "Difficult email sent", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 0, hour: 12, minute: 18, category: "me", note: null, source: "demo", source_type: "workout", source_metadata: { label: "42 minute workout" }, confidence: "high", duration_minutes: 42 },
  { daysAgo: 0, hour: 17, minute: 43, category: "home", note: "Made dinner", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 0, hour: 19, minute: 31, category: "care", note: "Bedtime", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },

  // ── Day 1 (yesterday) ──
  { daysAgo: 1, hour: 6, minute: 52, category: "me", note: null, source: "demo", source_type: "sleep", source_metadata: { label: "7.2 hours sleep" }, confidence: "medium", duration_minutes: 432 },
  { daysAgo: 1, hour: 7, minute: 30, category: "care", note: "School run", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 1, hour: 10, minute: 5, category: "work", note: "Prepared presentation", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 1, hour: 13, minute: 22, category: "life", note: "Booked dentist", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 1, hour: 17, minute: 50, category: "home", note: "Picked up parcels", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 1, hour: 18, minute: 15, category: "care", note: "Bath time", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 1, hour: 20, minute: 0, category: "me", note: "Called mum", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },

  // ── Day 2 ──
  { daysAgo: 2, hour: 7, minute: 15, category: "me", note: null, source: "demo", source_type: "run", source_metadata: { label: "28 minute run" }, confidence: "high", duration_minutes: 28 },
  { daysAgo: 2, hour: 8, minute: 0, category: "care", note: "Packed everyone's lunches", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 2, hour: 11, minute: 30, category: "work", note: "Team meeting", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 2, hour: 14, minute: 45, category: "life", note: "Organised childcare", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 2, hour: 19, minute: 10, category: "home", note: "Folded laundry", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },

  // ── Day 3 ──
  { daysAgo: 3, hour: 6, minute: 48, category: "me", note: null, source: "demo", source_type: "sleep", source_metadata: { label: "6.5 hours sleep" }, confidence: "medium", duration_minutes: 390 },
  { daysAgo: 3, hour: 8, minute: 20, category: "care", note: "School run", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 3, hour: 9, minute: 0, category: "work", note: "Caught up on emails", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 3, hour: 12, minute: 30, category: "me", note: null, source: "demo", source_type: "walk", source_metadata: { label: "22 minute walk" }, confidence: "high", duration_minutes: 22 },
  { daysAgo: 3, hour: 16, minute: 15, category: "life", note: "Pharmacy run", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 3, hour: 18, minute: 30, category: "home", note: "Made dinner", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 3, hour: 20, minute: 15, category: "care", note: "Bedtime story", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },

  // ── Day 4 ──
  { daysAgo: 4, hour: 7, minute: 0, category: "me", note: null, source: "demo", source_type: "cycle", source_metadata: { label: "35 minute cycle" }, confidence: "high", duration_minutes: 35 },
  { daysAgo: 4, hour: 9, minute: 30, category: "work", note: "Submitted report", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 4, hour: 13, minute: 0, category: "life", note: "Paid bills", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 4, hour: 17, minute: 0, category: "care", note: "Collected from nursery", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 4, hour: 19, minute: 45, category: "me", note: "Read a book", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },

  // ── Day 5 ──
  { daysAgo: 5, hour: 7, minute: 30, category: "care", note: "Made breakfast", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 5, hour: 10, minute: 0, category: "work", note: "Client call", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 5, hour: 12, minute: 0, category: "me", note: null, source: "demo", source_type: "workout", source_metadata: { label: "30 minute workout" }, confidence: "high", duration_minutes: 30 },
  { daysAgo: 5, hour: 15, minute: 20, category: "home", note: " Hoovered downstairs", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 5, hour: 18, minute: 0, category: "care", note: "School uniforms ready", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },

  // ── Day 6 ──
  { daysAgo: 6, hour: 8, minute: 0, category: "me", note: null, source: "demo", source_type: "walk", source_metadata: { label: "45 minute walk" }, confidence: "high", duration_minutes: 45 },
  { daysAgo: 6, hour: 9, minute: 30, category: "life", note: "Weekly shop", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 6, hour: 11, minute: 0, category: "home", note: "Changed beds", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 6, hour: 14, minute: 0, category: "care", note: "Took kids to park", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
  { daysAgo: 6, hour: 17, minute: 30, category: "me", note: null, source: "demo", source_type: "run", source_metadata: { label: "25 minute run" }, confidence: "high", duration_minutes: 25 },
  { daysAgo: 6, hour: 19, minute: 0, category: "home", note: "Sunday roast", source: "manual", source_type: "manual", source_metadata: {}, confidence: "", duration_minutes: null },
];

export async function hasDemoData(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { count } = await supabase
    .from("moments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .eq("is_demo", true);

  return (count ?? 0) > 0;
}

export async function seedDemoData(): Promise<void> {
  const already = await hasDemoData();
  if (already) return;

  for (const dm of demoMoments) {
    const ts = new Date();
    ts.setDate(ts.getDate() - dm.daysAgo);
    ts.setHours(dm.hour, dm.minute, 0, 0);

    await createMoment({
      category: dm.category,
      note: dm.note,
      source: dm.source,
      source_type: dm.source_type,
      source_metadata: dm.source_metadata,
      timestamp: ts.toISOString(),
      is_demo: true,
      confidence: dm.confidence || null,
      duration_minutes: dm.duration_minutes,
    });
  }
}
