// ─────────────────────────────────────────────────────────────────────────────
// Notification Service Abstraction
//
// Provides a clean interface for scheduling gentle, guilt-free reminders.
// Uses the browser Notification API when available. When Capacitor is
// integrated, a native LocalNotifications adapter can be dropped in by
// implementing the same interface — no calling code changes needed.
//
// Principles:
//   - NEVER create guilt ("you haven't logged", "don't forget", "keep your streak")
//   - At most one reminder per day
//   - Default to LOW frequency
//   - Automatic moments appear in timeline without notification
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import { fetchTodayMoments } from "./moments";

export type NotificationLevel = "off" | "low" | "normal";

export interface NotificationAdapter {
  readonly isAvailable: boolean;
  readonly isNative: boolean;
  getPermissionState(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  show(title: string, body: string): void;
}

// ── Browser Notification Adapter ─────────────────────────────────────────────

class BrowserNotificationAdapter implements NotificationAdapter {
  readonly isNative = false;

  get isAvailable(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  getPermissionState(): NotificationPermission {
    if (!this.isAvailable) return "denied";
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isAvailable) return "denied";
    return Notification.requestPermission();
  }

  show(title: string, body: string): void {
    if (!this.isAvailable || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body });
    } catch {
      // Some browsers throw if the SW is not registered — ignore
    }
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

let cachedAdapter: NotificationAdapter | null = null;

export function getNotificationAdapter(): NotificationAdapter {
  if (cachedAdapter) return cachedAdapter;
  cachedAdapter = new BrowserNotificationAdapter();
  return cachedAdapter;
}

// ── Gentle reminder messages — never guilt-inducing ──────────────────────────

const gentleMessages: { title: string; body: string }[] = [
  {
    title: "Hermentum",
    body: "Your record is waiting.",
  },
  {
    title: "Hermentum",
    body: "Your day isn't empty. Add anything Hermentum couldn't see.",
  },
  {
    title: "Hermentum",
    body: "We noticed a few things today. What happened that we couldn't see?",
  },
];

function pickMessage(): { title: string; body: string } {
  return gentleMessages[Math.floor(Math.random() * gentleMessages.length)];
}

// ── Preference management ─────────────────────────────────────────────────────

export async function getNotificationLevel(): Promise<NotificationLevel> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return "low";

    const { data } = await supabase
      .from("user_preferences")
      .select("notification_level")
      .eq("user_id", session.user.id)
      .maybeSingle();

    return (data?.notification_level as NotificationLevel) ?? "low";
  } catch {
    return "low";
  }
}

export async function setNotificationLevel(level: NotificationLevel): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  await supabase
    .from("user_preferences")
    .update({ notification_level: level })
    .eq("user_id", session.user.id);
}

// ── Scheduling ───────────────────────────────────────────────────────────────

let reminderTimer: ReturnType<typeof setTimeout> | null = null;

export async function scheduleDailyReminder(): Promise<void> {
  cancelDailyReminder();

  const level = await getNotificationLevel();
  if (level === "off") return;

  const adapter = getNotificationAdapter();
  if (!adapter.isAvailable) return;

  // Ensure permission
  if (adapter.getPermissionState() === "default") {
    await adapter.requestPermission();
  }
  if (adapter.getPermissionState() !== "granted") return;

  // Check if we already notified today
  if (await wasNotifiedToday()) return;

  // Schedule for a reasonable evening time (around 7pm local)
  const now = new Date();
  const target = new Date();
  target.setHours(19, 0, 0, 0);

  // If it's already past 7pm, schedule for tomorrow
  if (now.getTime() > target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  reminderTimer = setTimeout(async () => {
    await maybeSendReminder();
    // Reschedule for next day
    scheduleDailyReminder();
  }, delay);
}

export function cancelDailyReminder(): void {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
}

async function maybeSendReminder(): Promise<void> {
  const level = await getNotificationLevel();
  if (level === "off") return;

  // Don't send multiple reminders in the same day
  if (await wasNotifiedToday()) return;

  // LOW: only remind if nothing recorded today
  if (level === "low") {
    try {
      const moments = await fetchTodayMoments();
      if (moments.length > 0) return;
    } catch {
      return;
    }
  }

  // NORMAL: always send (once per day)

  const msg = pickMessage();
  const adapter = getNotificationAdapter();
  adapter.show(msg.title, msg.body);

  await markNotifiedToday();
}

// ── Last-notified tracking ────────────────────────────────────────────────────

async function wasNotifiedToday(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { data } = await supabase
      .from("user_preferences")
      .select("last_notified_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!data?.last_notified_at) return false;

    const last = new Date(data.last_notified_at);
    const today = new Date();
    return last.getFullYear() === today.getFullYear() &&
      last.getMonth() === today.getMonth() &&
      last.getDate() === today.getDate();
  } catch {
    return false;
  }
}

async function markNotifiedToday(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase
      .from("user_preferences")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("user_id", session.user.id);
  } catch {
    // Ignore
  }
}
