// Design tokens for Hermentum — quiet, premium, editorial, warm.
// No purple/violet hues. Warm neutrals with a single restrained accent.

export const colors = {
  // Backgrounds
  cream: "#FAF8F5",
  paper: "#FFFFFF",
  stone: "#F4F1ED",
  sand: "#EDE8E2",

  // Text
  ink: "#1C1A17",
  body: "#4A463F",
  muted: "#8A857C",
  faint: "#B5B0A8",
  whisper: "#D8D3CB",

  // Lines & borders
  rule: "#E8E3DC",
  ruleSoft: "#F0EDE7",

  // Accent — warm terracotta/clay
  accent: "#C68A5E",
  accentSoft: "#E8D5C4",
  accentBg: "#F5EAE0",

  // Category tints (subtle, warm)
  care: "#D4A574",   // warm amber
  home: "#A8B89A",   // sage
  work: "#8A9CB0",   // slate blue
  life: "#C4A0A8",   // dusty rose
  me: "#B8A5C4",     // muted lilac (not violet — warm muted)

  // Source distinction
  foundBg: "#F0EBE3",
  foundText: "#9A8B7A",

  // Semantic
  success: "#6A8A5A",
  successBg: "#EBF0E5",
  warning: "#C49A5A",
  warningBg: "#F5EDE0",
  error: "#B85A5A",
  errorBg: "#F5EAEA",
} as const;

export const fonts = {
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const shadows = {
  soft: "0 2px 12px rgba(28,26,23,0.05)",
  medium: "0 4px 20px rgba(28,26,23,0.08)",
  heavy: "0 8px 32px rgba(28,26,23,0.12)",
} as const;

export const transitions = {
  fast: "0.2s ease",
  base: "0.3s ease",
  slow: "0.5s cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export type CategoryKey = "care" | "home" | "work" | "life" | "me";

export const categories: { key: CategoryKey; label: string; tint: string; description: string }[] = [
  { key: "care", label: "CARE", tint: colors.care, description: "Caring for another person" },
  { key: "home", label: "HOME", tint: colors.home, description: "Keeping the home moving" },
  { key: "work", label: "WORK", tint: colors.work, description: "Paid work, professional life" },
  { key: "life", label: "LIFE", tint: colors.life, description: "Admin, planning, errands" },
  { key: "me", label: "FOR ME", tint: colors.me, description: "Something just for you" },
];

export function categoryColor(key: string): string {
  return (categories.find(c => c.key === key)?.tint) ?? colors.faint;
}

export function categoryLabel(key: string): string {
  return categories.find(c => c.key === key)?.label ?? key.toUpperCase();
}
