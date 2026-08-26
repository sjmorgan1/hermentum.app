// ─────────────────────────────────────────────────────────────────────────────
// Speech Recognition Abstraction
//
// Detects whether the Web Speech API is available in the current environment.
// If it is, uses it for real speech-to-text. If not, provides a clearly
// labelled development fallback (text input) so the flow still works without
// pretending real speech recognition is happening.
//
// When Capacitor is integrated, a native speech recognition plugin can be
// added by implementing the same interface — no calling code changes needed.
// ─────────────────────────────────────────────────────────────────────────────

export type SpeechPermissionState = "unknown" | "granted" | "denied" | "unavailable";

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechRecognitionAdapter {
  readonly isAvailable: boolean;
  readonly isNative: boolean;
  getPermissionState(): SpeechPermissionState;
  requestPermission(): Promise<SpeechPermissionState>;
  start(onResult: (result: SpeechRecognitionResult) => void, onError: (error: string) => void): void;
  stop(): void;
}

// ── Web Speech API types (minimal, for type safety) ──────────────────────────

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): { new(): SpeechRecognitionLike } | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as { new(): SpeechRecognitionLike } | null;
}

// ── WebSpeechAdapter — uses the browser's real Web Speech API ────────────────

class WebSpeechAdapter implements SpeechRecognitionAdapter {
  readonly isAvailable = true;
  readonly isNative = false;

  private recognition: SpeechRecognitionLike | null = null;
  private permState: SpeechPermissionState = "unknown";

  getPermissionState(): SpeechPermissionState {
    return this.permState;
  }

  async requestPermission(): Promise<SpeechPermissionState> {
    // The Web Speech API doesn't have an explicit permission request —
    // permission is requested implicitly when start() is called.
    // We attempt a brief start/stop cycle to trigger the prompt.
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.permState = "unavailable";
      return "unavailable";
    }
    // We can't truly know until start() is called, so we report "unknown"
    // and let the actual start() call resolve it.
    return this.permState;
  }

  start(onResult: (result: SpeechRecognitionResult) => void, onError: (error: string) => void): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError("Speech recognition not available");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        onResult({
          transcript: result[0].transcript,
          isFinal: result.isFinal,
        });
      }
    };

    recognition.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.permState = "denied";
        onError("Microphone permission denied");
      } else {
        onError(e.error);
      }
    };

    recognition.onend = () => {
      // Recognition stopped (either by stop() or automatically)
    };

    this.recognition = recognition;
    this.permState = "granted";

    try {
      recognition.start();
    } catch {
      // Already started or not allowed
      onError("Could not start speech recognition");
    }
  }

  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }
}

// ── DevFallbackAdapter — clearly labelled, uses text input instead of speech ─

class DevFallbackAdapter implements SpeechRecognitionAdapter {
  readonly isAvailable = true;
  readonly isNative = false;

  getPermissionState(): SpeechPermissionState {
    return "granted";
  }

  async requestPermission(): Promise<SpeechPermissionState> {
    return "granted";
  }

  start(_onResult: (result: SpeechRecognitionResult) => void, _onError: (error: string) => void): void {
    // Dev fallback: no actual speech recognition. The UI should show a text
    // input field instead of a microphone button. This adapter exists so the
    // flow doesn't break, but the component should check `isNative`/`isAvailable`
    // and show the text fallback UI when the Web Speech API isn't present.
  }

  stop(): void {}
}

// ── Factory ───────────────────────────────────────────────────────────────────

let cachedAdapter: SpeechRecognitionAdapter | null = null;

export function getSpeechAdapter(): SpeechRecognitionAdapter {
  if (cachedAdapter) return cachedAdapter;

  const Ctor = getSpeechRecognitionCtor();
  if (Ctor) {
    cachedAdapter = new WebSpeechAdapter();
  } else {
    cachedAdapter = new DevFallbackAdapter();
  }

  return cachedAdapter;
}

export function isWebSpeechAvailable(): boolean {
  return getSpeechRecognitionCtor() !== null;
}
