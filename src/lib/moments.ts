import { supabase } from "./supabase";

export interface Moment {
  id: string;
  user_id: string;
  timestamp: string;
  category: string;
  note: string | null;
  source: string;
  source_type: string;
  source_metadata: Record<string, unknown> | null;
  is_demo: boolean;
  dismissed: boolean;
  confidence: string | null;
  duration_minutes: number | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewMoment {
  category: string;
  note?: string | null;
  source?: string;
  source_type?: string;
  source_metadata?: Record<string, unknown> | null;
  timestamp?: string;
  is_demo?: boolean;
  confidence?: string | null;
  duration_minutes?: number | null;
  external_id?: string | null;
}

export async function fetchMoments(opts: {
  startDate?: string;
  endDate?: string;
  includeDismissed?: boolean;
} = {}): Promise<Moment[]> {
  let query = supabase
    .from("moments")
    .select("*")
    .order("timestamp", { ascending: false });

  if (opts.startDate) query = query.gte("timestamp", opts.startDate);
  if (opts.endDate) query = query.lt("timestamp", opts.endDate);
  if (!opts.includeDismissed) query = query.eq("dismissed", false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Moment[];
}

export async function fetchTodayMoments(): Promise<Moment[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return fetchMoments({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });
}

export async function createMoment(input: NewMoment): Promise<Moment | null> {
  const { data, error } = await supabase
    .from("moments")
    .insert({
      category: input.category,
      note: input.note ?? null,
      source: input.source ?? "manual",
      source_type: input.source_type ?? "manual",
      source_metadata: input.source_metadata ?? {},
      timestamp: input.timestamp ?? new Date().toISOString(),
      is_demo: input.is_demo ?? false,
      confidence: input.confidence ?? null,
      duration_minutes: input.duration_minutes ?? null,
      external_id: input.external_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Moment;
}

export async function updateMoment(id: string, patch: Partial<Pick<Moment, "note" | "category" | "dismissed" | "timestamp">>): Promise<void> {
  const { error } = await supabase.from("moments").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMoment(id: string): Promise<void> {
  const { error } = await supabase.from("moments").delete().eq("id", id);
  if (error) throw error;
}

export function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function formatShortDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function isSameDay(ts: string, date: Date): boolean {
  const d = new Date(ts);
  return d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate();
}
