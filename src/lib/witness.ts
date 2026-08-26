import { supabase } from "./supabase";

export interface WeeklyWitness {
  id: string;
  week_start: string;
  week_end: string;
  summary: string;
  stats: Record<string, unknown>;
  created_at: string;
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function fetchWeeklyWitnesses(): Promise<WeeklyWitness[]> {
  const { data, error } = await supabase
    .from("weekly_witnesses")
    .select("*")
    .order("week_start", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WeeklyWitness[];
}

export async function generateThisWeekWitness(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const weekStart = getWeekStart().toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("generate_weekly_witness", {
    p_user_id: session.user.id,
    p_week_start: weekStart,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchMonthlyRecords(): Promise<MonthlyRecord[]> {
  const { data, error } = await supabase
    .from("monthly_records")
    .select("*")
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthlyRecord[];
}

export interface MonthlyRecord {
  id: string;
  month: string;
  total_moments: number;
  days_recorded: number;
  category_breakdown: Record<string, number>;
  automatic_count: number;
  manual_count: number;
}

export async function generateMonthlyRecord(month: Date): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const { data: moments } = await supabase
    .from("moments")
    .select("category, source, timestamp")
    .eq("dismissed", false)
    .gte("timestamp", monthStart.toISOString())
    .lt("timestamp", monthEnd.toISOString());

  if (!moments) return;

  const total = moments.length;
  const days = new Set<string>();
  const catBreakdown: Record<string, number> = {};
  let auto = 0;
  let manual = 0;

  moments.forEach((m: { category: string; source: string; timestamp: string }) => {
    days.add(new Date(m.timestamp).toDateString());
    catBreakdown[m.category] = (catBreakdown[m.category] ?? 0) + 1;
    if (m.source === "manual") manual++; else auto++;
  });

  await supabase.from("monthly_records").upsert({
    user_id: session.user.id,
    month: monthStart.toISOString().slice(0, 10),
    total_moments: total,
    days_recorded: days.size,
    category_breakdown: catBreakdown,
    automatic_count: auto,
    manual_count: manual,
  }, { onConflict: "user_id,month" });
}
