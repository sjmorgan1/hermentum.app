// ─────────────────────────────────────────────────────────────────────────────
// Moment Extraction Service
//
// Takes a transcribed sentence and splits it into individual suggested moments.
// Detects category keywords to assign suggested categories.
//
// This is pure rule-based text parsing — NOT a chatbot or conversational AI.
// It simply breaks a spoken sentence into discrete items using configurable
// action-verb detection, clause splitting, and keyword-based categorisation.
//
// Architecture:
//   MomentExtractionService (interface)
//     └─ RuleBasedMomentExtractionService (current implementation)
//   A future AIModelMomentExtractionService can implement the same interface
//   and be swapped in via getMomentExtractionService() without touching callers.
// ─────────────────────────────────────────────────────────────────────────────

import type { CategoryKey } from "./theme";
import { categories } from "./theme";

export interface ParsedMoment {
  id: string;
  category: CategoryKey;
  text: string;
}

export interface MomentExtractionService {
  extract(transcript: string): ParsedMoment[];
}

// ── Action verbs ──────────────────────────────────────────────────────────────
// Common action verbs associated with completed activities in Hermentum.
// Easy to extend — just add to the array.

const ACTION_VERBS: string[] = [
  "made", "cooked", "cleaned", "washed", "packed", "organised", "booked",
  "called", "emailed", "answered", "sent", "collected", "dropped", "drove",
  "walked", "ran", "worked", "exercised", "fed", "bathed", "dressed",
  "helped", "planned", "remembered", "paid", "ordered", "bought",
  "arranged", "sorted", "tidied", "prepared", "attended", "completed",
  "finished", "dealt", "checked", "returned", "scheduled",
  // Common additions
  "got", "put", "took", "did", "went", "started", "picked", "filled",
  "wrote", "read", "reviewed", "submitted", "caught", "gave", "collected",
];

// Build a single regex that matches any action verb as a whole word.
const ACTION_VERB_RE = new RegExp(
  `\\b(${ACTION_VERBS.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);

// ── Connectors that join clauses ──────────────────────────────────────────────
// Splitting on these separates multiple completed actions within one sentence.

const CLAUSE_CONNECTORS = [
  "and then", "before", "after", "whilst", "while", "so that", "because",
  "and", "then", "also", "as well", "plus",
];

const CONNECTOR_RE = new RegExp(
  `\\s+(?:${CLAUSE_CONNECTORS.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s+`,
  "i",
);

// ── Category keyword mapping ──────────────────────────────────────────────────
// Words/phrases that suggest a category. Order matters: more specific first.

const categoryKeywords: { key: CategoryKey; words: string[] }[] = [
  {
    key: "care",
    words: [
      "kids", "kid", "children", "child", "school", "lunch", "lunches",
      "baby", "bath", "bedtime", "nursery", "school run", "dropped off",
      "picked up", "packed", "uniform", "homework", "story", "nappy",
      "dressed", "dressed the kids", "got the kids", "took them", "took the kids",
      "school bags", "packed lunch", "school bags", "everyone into bed",
      "helped with", "school run", "picked up the kids",
    ],
  },
  {
    key: "home",
    words: [
      "dinner", "cooked", "cooking", "laundry", "washing", "wash on",
      "hoover", "vacuum", "cleaned", "cleaning", "dishes", "tidied",
      "tidying", "beds", "changed sheets", "ironing", "shopping", "shop",
      "parcels", "bins", "recycling", "made breakfast", "made dinner",
      "made lunch", "put a wash", "put the washing", "breakfast",
    ],
  },
  {
    key: "work",
    words: [
      "email", "emails", "meeting", "call", "client", "report",
      "presentation", "deadline", "submitted", "review", "reviewed",
      "colleague", "boss", "project", "document", "spreadsheet",
      "answered emails", "answered some emails", "dealt with emails",
      "work", "worked",
    ],
  },
  {
    key: "life",
    words: [
      "dentist", "doctor", "pharmacy", "appointment", "booked",
      "organised", "arranged", "paid", "bills", "bank",
      "forms", "admin", "insurance", "tax", "childcare", "sorted",
      "booked the dentist", "booked a dentist", "remembered to book",
    ],
  },
  {
    key: "me",
    words: [
      "walk", "ran", "run", "workout", "gym", "yoga", "cycle", "cycled",
      "swim", "swimming", "read", "reading", "book", "meditate",
      "meditation", "journal", "bath", "called mum", "called dad",
      "phone call", "rested", "rest", "slept", "nap", "went for a run",
      "went for a walk", "exercised", "for me",
    ],
  },
];

function detectCategory(text: string): CategoryKey {
  const lower = text.toLowerCase();
  const scores: Record<CategoryKey, number> = {
    care: 0, home: 0, work: 0, life: 0, me: 0,
  };

  for (const { key, words } of categoryKeywords) {
    for (const word of words) {
      const regex = new RegExp(
        `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      );
      if (regex.test(lower)) {
        scores[key] += 1;
      }
    }
  }

  // Find the category with the highest score.
  let best: CategoryKey = "life";
  let bestScore = 0;
  (Object.keys(scores) as CategoryKey[]).forEach((k) => {
    if (scores[k] > bestScore) {
      bestScore = scores[k];
      best = k;
    }
  });

  // Default to "life" if no keyword matches — it's the most neutral category.
  return best;
}

// ── Text cleaning ─────────────────────────────────────────────────────────────

function cleanFragment(text: string): string {
  let clean = text.trim();
  // Strip leading "I " — moments read better as "Made breakfast" than "I made breakfast"
  clean = clean.replace(/^I\s+/i, "");
  // Strip leading conjunctions that may remain after splitting
  clean = clean.replace(/^(?:then|also|so|and|but)\s+/i, "");
  // Strip trailing punctuation
  clean = clean.replace(/[.!?]+$/g, "").trim();
  // Capitalise first letter
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

function generateId(): string {
  return `parsed-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// ── Rule-Based Extraction Service ─────────────────────────────────────────────

class RuleBasedMomentExtractionService implements MomentExtractionService {
  extract(transcript: string): ParsedMoment[] {
    const trimmed = transcript.trim();
    if (!trimmed) return [];

    // Normalise whitespace
    const normalized = trimmed.replace(/\s+/g, " ").trim();

    // Split into sentences first
    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);

    const moments: ParsedMoment[] = [];

    for (const sentence of sentences) {
      const extracted = this.extractFromSentence(sentence);
      for (const text of extracted) {
        const clean = cleanFragment(text);
        if (clean.length > 0) {
          moments.push({
            id: generateId(),
            category: detectCategory(clean),
            text: clean,
          });
        }
      }
    }

    // If nothing was extracted, return the whole transcript as one moment
    if (moments.length === 0) {
      const clean = cleanFragment(normalized);
      if (clean.length > 0) {
        moments.push({
          id: generateId(),
          category: detectCategory(clean),
          text: clean,
        });
      }
    }

    return moments;
  }

  private extractFromSentence(sentence: string): string[] {
    // Split the sentence into clauses on connectors and commas.
    // We use a marker-based approach to preserve the text between connectors.

    // Replace connectors with a split marker, then split on the marker.
    // We also split on commas.
    let marked = sentence;

    // Split on connectors (and, then, before, after, etc.)
    // We do this by replacing connector phrases with a sentinel.
    const SENTINEL = "\u0001SPLIT\u0001";
    marked = marked.replace(CONNECTOR_RE, SENTINEL);

    // Split on commas
    marked = marked.replace(/,\s*/g, SENTINEL);

    // Now split on the sentinel
    const rawFragments = marked
      .split(SENTINEL)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    // If only one fragment, the sentence had no connectors — return it whole.
    if (rawFragments.length <= 1) {
      return [sentence.trim()];
    }

    // Now we need to decide which fragments are real moments.
    // A fragment is a real moment if:
    //   - it contains an action verb, OR
    //   - it's the first fragment (it started the sentence), OR
    //   - it follows a fragment that had an action verb (continuation)
    //
    // But we also want to handle the case where a fragment like "getting
    // everyone into bed" follows "before" — it's still an action.

    const fragments: string[] = [];
    let prevHadVerb = true; // first fragment is always included

    for (const frag of rawFragments) {
      const hasVerb = ACTION_VERB_RE.test(frag) || /(?:ing|ed)\b/i.test(frag);

      if (frag === rawFragments[0] || hasVerb || prevHadVerb) {
        fragments.push(frag);
      } else {
        // Merge into the previous fragment — it wasn't a separate action
        if (fragments.length > 0) {
          fragments[fragments.length - 1] += " " + frag;
        } else {
          fragments.push(frag);
        }
      }
      prevHadVerb = hasVerb;
    }

    return fragments;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

let cachedService: MomentExtractionService | null = null;

export function getMomentExtractionService(): MomentExtractionService {
  if (cachedService) return cachedService;
  cachedService = new RuleBasedMomentExtractionService();
  return cachedService;
}

// ── Backward-compatible export ────────────────────────────────────────────────
// Existing callers import parseMoments; we keep it as a thin wrapper over the
// service so the rest of the app doesn't need to change.

export function parseMoments(transcript: string): ParsedMoment[] {
  return getMomentExtractionService().extract(transcript);
}

export function categoryLabel(key: CategoryKey): string {
  return categories.find((c) => c.key === key)?.label ?? key.toUpperCase();
}
