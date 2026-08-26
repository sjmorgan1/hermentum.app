import { supabase } from "./supabase";

export type AnalyticsEventName =
  | "user_created"
  | "onboarding_completed"
  | "moment_created"
  | "moment_source"
  | "moment_category"
  | "automatic_source_connected"
  | "automatic_moment_created"
  | "automatic_moment_kept"
  | "automatic_moment_deleted"
  | "timeline_opened"
  | "week_viewed"
  | "month_viewed"
  | "witness_viewed"
  | "return_session"
  | "voice_capture_started"
  | "voice_capture_completed"
  | "voice_capture_cancelled"
  | "voice_moment_confirmed"
  | "notification_level_changed";

let sessionId: string | null = null;

export function initSessionId() {
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("hermentum_session", sessionId);
  }
  return sessionId;
}

export function getSessionId(): string | null {
  if (sessionId) return sessionId;
  sessionId = sessionStorage.getItem("hermentum_session");
  return sessionId;
}

export async function track(event: AnalyticsEventName, data: Record<string, unknown> = {}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from("analytics_events").insert({
      event_name: event,
      event_data: data,
      session_id: getSessionId(),
    });
  } catch {
    // Analytics should never break the user experience
  }
}
