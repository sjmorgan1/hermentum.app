import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { colors, fonts, transitions } from "../lib/theme";
import { BottomNav, type TabId } from "../lib/ui";
import { track } from "../lib/analytics";
import {
  type SourceKey,
  type AutomaticEvent,
  type PermissionState,
  getAllAdapters,
  getAdapter,
  eventLabel,
} from "../lib/datasource";
import { createMoment } from "../lib/moments";
import {
  getNotificationLevel,
  setNotificationLevel,
  getNotificationAdapter,
  type NotificationLevel,
} from "../lib/notifications";
import {
  syncHealthData,
  initialHealthImport,
  getLastSyncAt,
  scopeToSince,
  type ImportScope,
  type SyncResult,
} from "../lib/healthSync";
import {
  isTestModeEnabled,
  toggleTestMode,
  simulateTestRecord,
  generateTestBatch,
  type TestActivityType,
} from "../lib/healthTestMode";
import { healthDataService, healthRecordToEvent } from "../lib/healthDataService";

interface Props {
  onNavigate: (tab: TabId) => void;
}

interface ConnectedSource {
  source_key: SourceKey;
  connected_at: string;
}

export default function PrivacyView({ onNavigate }: Props) {
  const [view, setView] = useState<"main" | "sources" | "source" | "admin" | "notifications">("main");
  const [connectedSources, setConnectedSources] = useState<ConnectedSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceKey | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    const { data } = await supabase
      .from("connected_accounts")
      .select("source_key, connected_at, disconnected_at")
      .order("connected_at", { ascending: false });
    if (data) {
      const active = data
        .filter((r: { disconnected_at: string | null }) => !r.disconnected_at)
        .map((r: { source_key: SourceKey; connected_at: string }) => ({
          source_key: r.source_key,
          connected_at: r.connected_at,
        }));
      setConnectedSources(active);
    }
  };

  const isSourceConnected = (key: SourceKey): boolean =>
    connectedSources.some(s => s.source_key === key);

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
      {view === "main" && (
        <PrivacyMain
          onNavigate={onNavigate}
          onSources={() => setView("sources")}
          onAdmin={() => setView("admin")}
          onNotifications={() => setView("notifications")}
          connectedCount={connectedSources.length}
        />
      )}
      {view === "notifications" && (
        <NotificationPreferences onBack={() => setView("main")} />
      )}
      {view === "sources" && (
        <SourcesList
          onBack={() => setView("main")}
          onSelectSource={(key) => { setSelectedSource(key); setView("source"); }}
          isSourceConnected={isSourceConnected}
        />
      )}
      {view === "source" && selectedSource && (
        <SourceDetail
          sourceKey={selectedSource}
          onBack={() => setView("sources")}
          isConnected={isSourceConnected(selectedSource)}
          onConnected={loadConnections}
          onDisconnected={loadConnections}
        />
      )}
      {view === "admin" && (
        <AdminView onBack={() => setView("main")} />
      )}
    </div>
  );
}

// ─── Privacy Main ─────────────────────────────────────────────────────────────

function PrivacyMain({ onNavigate, onSources, onAdmin, onNotifications, connectedCount }: {
  onNavigate: (tab: TabId) => void;
  onSources: () => void;
  onAdmin: () => void;
  onNotifications: () => void;
  connectedCount: number;
}) {
  const [notifLevel, setNotifLevel] = useState<NotificationLevel>("low");

  useEffect(() => {
    getNotificationLevel().then(setNotifLevel);
  }, []);

  return (
    <>
      <div style={{ padding: "20px 24px 0" }}>
        <h1 style={{
          fontSize: 28, fontWeight: 300, color: colors.ink,
          margin: 0, lineHeight: 1.2,
        }}>
          Privacy
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 120px" }}>
        {/* Privacy statement */}
        <div style={{
          background: colors.paper, borderRadius: 16,
          border: `1px solid ${colors.rule}`,
          padding: "24px 20px", marginBottom: 24,
        }}>
          <p style={{
            fontSize: 16, color: colors.ink, fontFamily: fonts.serif,
            lineHeight: 1.7, margin: 0, fontWeight: 300,
          }}>
            Hermentum is your record.
          </p>
          <p style={{
            fontSize: 14, color: colors.body, fontFamily: fonts.serif,
            lineHeight: 1.7, margin: "8px 0 0",
          }}>
            You decide what Hermentum can see. You can disconnect data sources at any time. Your private record is never public.
          </p>
        </div>

        {/* Connected sources */}
        <p style={{
          fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
          letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
        }}>
          Connected sources
        </p>

        <button onClick={onSources} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "16px 18px", background: colors.paper,
          border: `1px solid ${colors.rule}`, borderRadius: 14,
          cursor: "pointer", textAlign: "left", marginBottom: 10,
          transition: `all ${transitions.fast}`,
          WebkitTapHighlightColor: "transparent",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: colors.stone, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>⊕</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: colors.ink, fontFamily: fonts.serif }}>
              Data sources
            </div>
            <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.sans, marginTop: 2 }}>
              {connectedCount > 0
                ? `${connectedCount} source${connectedCount !== 1 ? "s" : ""} connected`
                : "Apple Health, Health Connect, Calendar, Demo Data"}
            </div>
          </div>
          <span style={{ fontSize: 14, color: colors.faint }}>›</span>
        </button>

        {/* Notifications */}
        <p style={{
          fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
          letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, marginTop: 32,
        }}>
          Reminders
        </p>

        <button onClick={onNotifications} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "16px 18px", background: colors.paper,
          border: `1px solid ${colors.rule}`, borderRadius: 14,
          cursor: "pointer", textAlign: "left", marginBottom: 10,
          transition: `all ${transitions.fast}`,
          WebkitTapHighlightColor: "transparent",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: colors.stone, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>◉</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: colors.ink, fontFamily: fonts.serif }}>
              Reminders
            </div>
            <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.sans, marginTop: 2 }}>
              {notifLevel === "off" ? "Off" : notifLevel === "low" ? "Low — gentle, infrequent" : "Normal — daily"}
            </div>
          </div>
          <span style={{ fontSize: 14, color: colors.faint }}>›</span>
        </button>

        {/* Admin link */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.ruleSoft}` }}>
          <button onClick={onAdmin} style={{
            background: "none", border: "none", color: colors.faint,
            fontFamily: fonts.sans, fontSize: 13, cursor: "pointer", padding: 0,
          }}>
            Admin & metrics →
          </button>
        </div>
      </div>

      <BottomNav active="privacy" onChange={onNavigate} />
    </>
  );
}

// ─── Notification Preferences ─────────────────────────────────────────────────

function NotificationPreferences({ onBack }: { onBack: () => void }) {
  const [level, setLevel] = useState<NotificationLevel>("low");
  const [permState, setPermState] = useState<NotificationPermission>("denied");
  const adapter = getNotificationAdapter();

  useEffect(() => {
    getNotificationLevel().then(setLevel);
    setPermState(adapter.getPermissionState());
  }, []);

  const handleLevelChange = async (newLevel: NotificationLevel) => {
    setLevel(newLevel);
    await setNotificationLevel(newLevel);
    track("notification_level_changed", { level: newLevel });
  };

  const handleRequestPermission = async () => {
    const result = await adapter.requestPermission();
    setPermState(result);
  };

  const levels: { value: NotificationLevel; label: string; description: string }[] = [
    { value: "off", label: "Off", description: "No reminders at all." },
    { value: "low", label: "Low", description: "At most one gentle reminder per day, only if you haven't recorded anything." },
    { value: "normal", label: "Normal", description: "At most one gentle reminder per day." },
  ];

  return (
    <>
      <div style={{ padding: "16px 24px 0" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 14, cursor: "pointer", padding: 0,
        }}>
          ← Back
        </button>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <h1 style={{
          fontSize: 24, fontWeight: 300, color: colors.ink,
          margin: "0 0 4px", lineHeight: 1.3,
        }}>
          Reminders
        </h1>
        <p style={{
          fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
          lineHeight: 1.6, margin: "0 0 24px",
        }}>
          Gentle invitations. Never guilt. You can turn them off at any time.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 120px" }}>
        {/* Permission status */}
        {adapter.isAvailable && permState !== "granted" && (
          <div style={{
            background: colors.warningBg, border: `1px solid ${colors.warning}`,
            borderRadius: 12, padding: "14px 16px", marginBottom: 20,
          }}>
            <p style={{
              fontSize: 13, color: colors.body, fontFamily: fonts.sans,
              lineHeight: 1.6, margin: "0 0 8px",
            }}>
              {permState === "denied"
                ? "Notifications are blocked in your browser settings. You'll need to enable them to receive reminders."
                : "Allow notifications to receive gentle reminders."}
            </p>
            {permState === "default" && (
              <button onClick={handleRequestPermission} style={{
                background: colors.ink, border: "none", borderRadius: 999,
                color: colors.cream, fontSize: 13, fontFamily: fonts.sans,
                padding: "10px 20px", cursor: "pointer",
              }}>
                Allow notifications
              </button>
            )}
          </div>
        )}

        {!adapter.isAvailable && (
          <div style={{
            background: colors.stone, borderRadius: 12, padding: "14px 16px", marginBottom: 20,
          }}>
            <p style={{
              fontSize: 13, color: colors.body, fontFamily: fonts.sans,
              lineHeight: 1.6, margin: 0,
            }}>
              Browser notifications are not available in this environment. When Hermentum is installed as an app, native reminders will be available here.
            </p>
          </div>
        )}

        {/* Level options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {levels.map((l) => (
            <button
              key={l.value}
              onClick={() => handleLevelChange(l.value)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "18px 18px", background: colors.paper,
                border: `1px solid ${level === l.value ? colors.ink : colors.rule}`,
                borderRadius: 14, cursor: "pointer", textAlign: "left",
                transition: `all ${transitions.fast}`,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: `2px solid ${level === l.value ? colors.ink : colors.whisper}`,
                flexShrink: 0, marginTop: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {level === l.value && (
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.ink }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15, color: colors.ink, fontFamily: fonts.serif,
                  fontWeight: level === l.value ? 600 : 400,
                }}>
                  {l.label}
                </div>
                <div style={{
                  fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
                  marginTop: 4, lineHeight: 1.5,
                }}>
                  {l.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Sample messages */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.ruleSoft}` }}>
          <p style={{
            fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
          }}>
            What reminders look like
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              background: colors.paper, borderRadius: 12,
              border: `1px solid ${colors.rule}`, padding: "14px 16px",
            }}>
              <p style={{ fontSize: 12, color: colors.faint, fontFamily: fonts.sans, margin: "0 0 4px", fontWeight: 600 }}>
                Hermentum
              </p>
              <p style={{ fontSize: 14, color: colors.ink, fontFamily: fonts.serif, margin: 0, lineHeight: 1.5 }}>
                Your record is waiting.
              </p>
            </div>
            <div style={{
              background: colors.paper, borderRadius: 12,
              border: `1px solid ${colors.rule}`, padding: "14px 16px",
            }}>
              <p style={{ fontSize: 12, color: colors.faint, fontFamily: fonts.sans, margin: "0 0 4px", fontWeight: 600 }}>
                Hermentum
              </p>
              <p style={{ fontSize: 14, color: colors.ink, fontFamily: fonts.serif, margin: 0, lineHeight: 1.5 }}>
                Your day isn't empty. Add anything Hermentum couldn't see.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sources List ─────────────────────────────────────────────────────────────

function SourcesList({ onBack, onSelectSource, isSourceConnected }: {
  onBack: () => void;
  onSelectSource: (key: SourceKey) => void;
  isSourceConnected: (key: SourceKey) => boolean;
}) {
  const adapters = getAllAdapters();

  return (
    <>
      <div style={{ padding: "16px 24px 0" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 14, cursor: "pointer", padding: 0,
        }}>
          ← Back
        </button>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <h1 style={{
          fontSize: 24, fontWeight: 300, color: colors.ink,
          margin: "0 0 4px", lineHeight: 1.3,
        }}>
          Connected Sources
        </h1>
        <p style={{
          fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
          lineHeight: 1.6, margin: "0 0 24px",
        }}>
          Hermentum can notice things your phone already knows. Choose what to connect.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {adapters.map(adapter => {
            const connected = isSourceConnected(adapter.sourceKey);
            return (
              <button
                key={adapter.sourceKey}
                onClick={() => onSelectSource(adapter.sourceKey)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px", background: colors.paper,
                  border: `1px solid ${colors.rule}`, borderRadius: 14,
                  cursor: "pointer", textAlign: "left",
                  transition: `all ${transitions.fast}`,
                  WebkitTapHighlightColor: "transparent",
                  opacity: adapter.isAvailable || adapter.isDemo ? 1 : 0.6,
                }}
              >
                <SourceIcon sourceKey={adapter.sourceKey} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: colors.ink, fontFamily: fonts.serif }}>
                    {adapter.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.sans, marginTop: 2 }}>
                    {connected
                      ? "Connected"
                      : adapter.isAvailable || adapter.isDemo
                        ? "Not connected"
                        : "Not available on this device"}
                  </div>
                </div>
                {connected && (
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: colors.success, flexShrink: 0,
                  }} />
                )}
                <span style={{ fontSize: 14, color: colors.faint }}>›</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Source Detail ───────────────────────────────────────────────────────────

function SourceDetail({ sourceKey, onBack, isConnected, onConnected, onDisconnected }: {
  sourceKey: SourceKey;
  onBack: () => void;
  isConnected: boolean;
  onConnected: () => void;
  onDisconnected: () => void;
}) {
  const adapter = getAdapter(sourceKey);
  const isHealthKit = sourceKey === "healthkit";
  const [permState, setPermState] = useState<PermissionState>("unknown");
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<AutomaticEvent[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [denied, setDenied] = useState(false);
  const [available, setAvailable] = useState(false);
  const [showScopePicker, setShowScopePicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [testMode, setTestMode] = useState(isTestModeEnabled());

  useEffect(() => {
    (async () => {
      const avail = await adapter.checkAvailability();
      setAvailable(avail);
      if (isHealthKit) {
        const status = await healthDataService.getAuthorizationStatus();
        setPermState(status);
      } else {
        setPermState(adapter.getPermissionState());
      }
      if (isHealthKit) {
        setLastSync(await getLastSyncAt());
      }
    })();
  }, [sourceKey]);

  const handleConnect = async () => {
    setConnecting(true);
    setDenied(false);
    const state = await adapter.requestPermission();
    setPermState(state);
    if (state === "granted") {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("connected_accounts").insert({
          user_id: session.user.id,
          source_key: adapter.sourceKey,
        });
        track("automatic_source_connected", {
          source: adapter.sourceKey,
          is_demo: adapter.isDemo,
        });
        onConnected();
        if (isHealthKit) {
          setShowScopePicker(true);
        }
      }
    } else if (state === "denied" || state === "unavailable") {
      setDenied(true);
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    await supabase
      .from("connected_accounts")
      .update({ disconnected_at: new Date().toISOString() })
      .eq("source_key", adapter.sourceKey)
      .is("disconnected_at", null);
    onDisconnected();
  };

  const handleImport = async () => {
    setImporting(true);
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const fetched = await adapter.fetchEvents(since);
    setEvents(fetched);

    let count = 0;
    for (const e of fetched) {
      await createMoment({
        category: "me",
        source: e.source,
        source_type: e.source_type,
        source_metadata: { label: eventLabel(e), ...e.metadata },
        timestamp: e.timestamp,
        is_demo: adapter.isDemo,
        confidence: e.confidence,
        duration_minutes: e.duration_minutes ?? null,
      });
      count++;
      track("automatic_moment_created", {
        source: e.source,
        source_type: e.source_type,
        is_demo: adapter.isDemo,
      });
    }
    setImportedCount(count);
    setImporting(false);
  };

  const handleScopeImport = async (scope: ImportScope) => {
    setImporting(true);
    setSyncResult(null);
    const result = isHealthKit
      ? await initialHealthImport(scope)
      : await (async () => {
          const since = scopeToSince(scope);
          const fetched = await adapter.fetchEvents(since);
          setEvents(fetched);
          let count = 0;
          for (const e of fetched) {
            await createMoment({
              category: "me",
              source: e.source,
              source_type: e.source_type,
              source_metadata: { label: eventLabel(e), ...e.metadata },
              timestamp: e.timestamp,
              is_demo: adapter.isDemo,
              confidence: e.confidence,
              duration_minutes: e.duration_minutes ?? null,
            });
            count++;
          }
          return { imported: count, skippedDuplicates: 0, unavailable: false, lastSyncAt: new Date().toISOString() } as SyncResult;
        })();
    setSyncResult(result);
    setImportedCount(result.imported);
    setLastSync(result.lastSyncAt);
    setShowScopePicker(false);
    setImporting(false);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncHealthData();
    setSyncResult(result);
    setLastSync(result.lastSyncAt);
    setSyncing(false);
  };

  const handleTestModeToggle = () => {
    const newState = toggleTestMode();
    setTestMode(newState);
  };

  const handleSimulateTest = async (type: TestActivityType) => {
    const record = simulateTestRecord({ type, offsetMinutes: -Math.floor(Math.random() * 600), durationMinutes: 20 + Math.floor(Math.random() * 40) });
    const event = healthRecordToEvent(record);
    setEvents(prev => [event, ...prev]);
  };

  const handleImportTestBatch = async () => {
    const batch = generateTestBatch();
    const testEvents = batch.map(healthRecordToEvent);
    setEvents(testEvents);
    let count = 0;
    for (const e of testEvents) {
      try {
        await createMoment({
          category: "me",
          source: "healthkit",
          source_type: "automatic",
          source_metadata: { label: eventLabel(e), ...e.metadata, is_test: true },
          timestamp: e.timestamp,
          confidence: e.confidence,
          duration_minutes: e.duration_minutes ?? null,
          external_id: (e.metadata as Record<string, unknown>).external_id as string,
        });
        count++;
      } catch { /* duplicate skip */ }
    }
    setImportedCount(count);
  };

  // ─── HealthKit-specific copy ───
  const healthKitDescription = isHealthKit
    ? "Let Hermentum see the activity your phone or Apple Watch already records. Workouts, walks, runs, cycling and sleep can become part of your Hermentum record automatically."
    : adapter.dataDescription;

  return (
    <>
      <div style={{ padding: "16px 24px 0" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 14, cursor: "pointer", padding: 0,
        }}>
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 120px" }}>
        {/* Source header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <SourceIcon sourceKey={adapter.sourceKey} large />
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 300, color: colors.ink,
              margin: 0, lineHeight: 1.3,
            }}>
              {adapter.displayName}
            </h1>
            <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.sans, marginTop: 2 }}>
              {isConnected ? "Connected" : available || adapter.isDemo ? "Not connected" : isHealthKit ? "Available on iPhone" : "Not available on this device"}
            </div>
          </div>
        </div>

        {/* Demo mode banner — unmistakable */}
        {adapter.isDemo && (
          <div style={{
            background: colors.warningBg,
            border: `1px solid ${colors.warning}`,
            borderRadius: 12, padding: "14px 16px", marginBottom: 20,
          }}>
            <p style={{
              fontSize: 12, color: colors.body, fontFamily: fonts.sans,
              lineHeight: 1.6, margin: 0,
            }}>
              <strong>Development mode.</strong> This is demo data — not real health data. It is clearly labelled in your record and never represented as live data.
            </p>
          </div>
        )}

        {/* What Hermentum uses */}
        <p style={{
          fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
          letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
        }}>
          What Hermentum will use
        </p>
        <div style={{
          background: colors.paper, borderRadius: 14,
          border: `1px solid ${colors.rule}`,
          padding: "18px 18px", marginBottom: 24,
        }}>
          <p style={{
            fontSize: 14, color: colors.body, fontFamily: fonts.serif,
            lineHeight: 1.7, margin: 0,
          }}>
            {healthKitDescription}
          </p>
        </div>

        {/* Privacy statement for health sources */}
        {isHealthKit && (
          <div style={{
            background: colors.paper, borderRadius: 14,
            border: `1px solid ${colors.rule}`,
            padding: "18px 18px", marginBottom: 24,
          }}>
            <p style={{
              fontSize: 13, color: colors.body, fontFamily: fonts.serif,
              lineHeight: 1.7, margin: 0, fontStyle: "italic",
            }}>
              Hermentum only uses the health information you choose to share with us to create your private record.
            </p>
          </div>
        )}

        {/* Supported event types for health sources */}
        {(isHealthKit || adapter.sourceKey === "health_connect" || adapter.sourceKey === "demo") && (
          <div style={{ marginBottom: 24 }}>
            <p style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
            }}>
              Automatic moments
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Workout", "Walk", "Run", "Cycle", "Sleep"].map(t => (
                <div key={t} style={{
                  padding: "6px 14px", background: colors.paper,
                  border: `1px solid ${colors.rule}`, borderRadius: 999,
                  fontSize: 12, color: colors.body, fontFamily: fonts.sans,
                }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connection state — not connected, available */}
        {!isConnected && (available || adapter.isDemo) && permState !== "granted" && !showScopePicker && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              width: "100%", padding: "16px 24px",
              background: connecting ? colors.sand : colors.ink,
              border: "none", borderRadius: 999,
              color: connecting ? colors.faint : colors.cream,
              fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
              cursor: connecting ? "default" : "pointer",
            }}
          >
            {connecting ? "Connecting..." : isHealthKit ? "CONNECT APPLE HEALTH" : `Connect ${adapter.displayName}`}
          </button>
        )}

        {/* Permission denied — graceful fallback */}
        {denied && !isConnected && (
          <div style={{
            background: colors.paper, borderRadius: 14,
            border: `1px solid ${colors.rule}`,
            padding: "18px 18px", marginBottom: 20,
          }}>
            <p style={{
              fontSize: 14, color: colors.body, fontFamily: fonts.serif,
              lineHeight: 1.7, margin: 0,
            }}>
              That's completely fine. Hermentum will still work normally. You can connect Apple Health later.
            </p>
          </div>
        )}

        {/* Web fallback — not available on this device */}
        {!isConnected && !available && !adapter.isDemo && (
          <div style={{
            background: colors.stone, borderRadius: 12, padding: "14px 16px",
          }}>
            <p style={{
              fontSize: 13, color: colors.body, fontFamily: fonts.sans,
              lineHeight: 1.6, margin: 0,
            }}>
              {isHealthKit
                ? "Apple Health is available on iPhone. When you install Hermentum as an app on your iPhone, your workouts, walks, runs, cycling and sleep can become part of your record automatically."
                : "This source requires a native app. It will be available when Hermentum is installed as an app on your device."}
            </p>
          </div>
        )}

        {/* Initial import scope picker — first connect */}
        {showScopePicker && isHealthKit && (
          <div style={{ marginBottom: 24 }}>
            <p style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
            }}>
              How much of your record should we bring in?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { value: "today", label: "Today", desc: "Just today's activity." },
                { value: "week", label: "This week", desc: "The last 7 days. Recommended." },
                { value: "month", label: "This month", desc: "The last 30 days." },
              ] as { value: ImportScope; label: string; desc: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleScopeImport(opt.value)}
                  disabled={importing}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "18px 18px", background: colors.paper,
                    border: `1px solid ${opt.value === "week" ? colors.ink : colors.rule}`,
                    borderRadius: 14, cursor: importing ? "default" : "pointer", textAlign: "left",
                    transition: `all ${transitions.fast}`,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${opt.value === "week" ? colors.ink : colors.whisper}`,
                    flexShrink: 0, marginTop: 2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {opt.value === "week" && (
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.ink }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 15, color: colors.ink, fontFamily: fonts.serif,
                      fontWeight: opt.value === "week" ? 600 : 400,
                    }}>
                      {opt.label}
                    </div>
                    <div style={{
                      fontSize: 13, color: colors.muted, fontFamily: fonts.sans,
                      marginTop: 4, lineHeight: 1.5,
                    }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {importing && (
              <p style={{ fontSize: 13, color: colors.faint, fontFamily: fonts.sans, marginTop: 12 }}>
                Importing...
              </p>
            )}
          </div>
        )}

        {/* Connected state — sync + disconnect */}
        {isConnected && (
          <>
            <div style={{
              background: colors.successBg, border: `1px solid ${colors.success}`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 20,
            }}>
              <p style={{
                fontSize: 13, color: colors.success, fontFamily: fonts.sans,
                margin: 0, fontWeight: 600,
              }}>
                Connected
              </p>
              {lastSync && (
                <p style={{
                  fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
                  margin: "4px 0 0",
                }}>
                  Last synced {new Date(lastSync).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            {/* Sync now button */}
            {isHealthKit && (
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                style={{
                  width: "100%", padding: "16px 24px",
                  background: syncing ? colors.sand : colors.ink,
                  border: "none", borderRadius: 999,
                  color: syncing ? colors.faint : colors.cream,
                  fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
                  cursor: syncing ? "default" : "pointer", marginBottom: 16,
                }}
              >
                {syncing ? "Syncing..." : "SYNC NOW"}
              </button>
            )}

            {/* Sync result */}
            {syncResult && (
              <div style={{
                background: colors.paper, borderRadius: 12,
                border: `1px solid ${colors.rule}`, padding: "14px 16px",
                marginBottom: 20,
              }}>
                <p style={{
                  fontSize: 14, color: colors.ink, fontFamily: fonts.serif,
                  margin: 0,
                }}>
                  {syncResult.imported > 0
                    ? `${syncResult.imported} new ${syncResult.imported === 1 ? "moment" : "moments"} added to your record.`
                    : syncResult.skippedDuplicates > 0
                      ? `No new moments. ${syncResult.skippedDuplicates} duplicate${syncResult.skippedDuplicates !== 1 ? "s" : ""} skipped.`
                      : "No new moments found."}
                </p>
                {syncResult.error && (
                  <p style={{ fontSize: 12, color: colors.error, fontFamily: fonts.sans, margin: "4px 0 0" }}>
                    {syncResult.error === "not_authorized" ? "Apple Health permission needed. Please reconnect." : syncResult.error}
                  </p>
                )}
              </div>
            )}

            {/* Import button (non-HealthKit sources) */}
            {!isHealthKit && (
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  width: "100%", padding: "16px 24px",
                  background: importing ? colors.sand : colors.ink,
                  border: "none", borderRadius: 999,
                  color: importing ? colors.faint : colors.cream,
                  fontSize: 15, fontFamily: fonts.sans, letterSpacing: 0.5,
                  cursor: importing ? "default" : "pointer", marginBottom: 16,
                }}
              >
                {importing ? "Importing..." : "Import activities (last 7 days)"}
              </button>
            )}

            {importedCount > 0 && !syncResult && (
              <div style={{
                background: colors.paper, borderRadius: 12,
                border: `1px solid ${colors.rule}`, padding: "14px 16px",
                marginBottom: 20,
              }}>
                <p style={{
                  fontSize: 14, color: colors.ink, fontFamily: fonts.serif,
                  margin: 0,
                }}>
                  {importedCount} {importedCount === 1 ? "moment" : "moments"} added to your record.
                </p>
              </div>
            )}

            {/* Preview of found events */}
            {events.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
                  letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
                }}>
                  Hermentum Found
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {events.map((e, i) => (
                    <FoundEventRow key={i} event={e} />
                  ))}
                </div>
              </div>
            )}

            {/* Disconnect */}
            <button
              onClick={handleDisconnect}
              style={{
                width: "100%", padding: "14px 24px",
                background: "transparent",
                border: `1px solid ${colors.rule}`,
              borderRadius: 999, color: colors.error,
              fontSize: 14, fontFamily: fonts.sans, letterSpacing: 0.5,
              cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          </>
        )}

        {/* Development-only HealthKit test mode */}
        {isHealthKit && import.meta.env.DEV && (
          <div style={{
            marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.ruleSoft}`,
          }}>
            <div style={{
              background: colors.warningBg, border: `1px solid ${colors.warning}`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 16,
            }}>
              <p style={{
                fontSize: 12, color: colors.body, fontFamily: fonts.sans,
                lineHeight: 1.6, margin: "0 0 8px",
              }}>
                <strong>DEVELOPMENT ONLY.</strong> Simulated HealthKit records for testing sync and deduplication. Never enabled for production users.
              </p>
              <button onClick={handleTestModeToggle} style={{
                background: testMode ? colors.ink : "transparent",
                border: `1px solid ${testMode ? colors.ink : colors.rule}`,
                borderRadius: 999, color: testMode ? colors.cream : colors.ink,
                fontSize: 12, fontFamily: fonts.sans, padding: "8px 16px",
                cursor: "pointer",
              }}>
                {testMode ? "Test mode ON" : "Enable test mode"}
              </button>
            </div>

            {testMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{
                  fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  Simulate a record
                </p>
                {(["workout", "walk", "run", "cycle", "sleep"] as TestActivityType[]).map(type => (
                  <button key={type} onClick={() => handleSimulateTest(type)} style={{
                    padding: "10px 16px", background: colors.paper,
                    border: `1px solid ${colors.rule}`, borderRadius: 10,
                    color: colors.ink, fontSize: 13, fontFamily: fonts.sans,
                    cursor: "pointer", textAlign: "left", textTransform: "capitalize",
                  }}>
                    + Simulate {type}
                  </button>
                ))}
                <button onClick={handleImportTestBatch} style={{
                  padding: "10px 16px", background: colors.ink,
                  border: "none", borderRadius: 10,
                  color: colors.cream, fontSize: 13, fontFamily: fonts.sans,
                  cursor: "pointer", marginTop: 4,
                }}>
                  Import test batch (7 days)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Found Event Row — the clean HERMENTUM FOUND component ─────────────────────

function FoundEventRow({ event }: { event: AutomaticEvent }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", background: colors.foundBg,
      borderRadius: 10,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: "50%",
        background: colors.foundText, flexShrink: 0,
      }} />
      <span style={{
        fontSize: 9, color: colors.foundText, fontFamily: fonts.sans,
        letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
      }}>
        Found
      </span>
      <span style={{
        fontSize: 15, color: colors.ink, fontFamily: fonts.serif, flex: 1,
      }}>
        {eventLabel(event)}
      </span>
      <span style={{
        fontSize: 11, color: colors.faint, fontFamily: fonts.sans,
      }}>
        {new Date(event.timestamp).toLocaleDateString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

// ─── Source Icon ──────────────────────────────────────────────────────────────

function SourceIcon({ sourceKey, large }: { sourceKey: SourceKey; large?: boolean }) {
  const size = large ? 48 : 40;
  const iconSize = large ? 22 : 18;

  const icons: Record<SourceKey, string> = {
    healthkit: "♥",
    health_connect: "♥",
    calendar: "▦",
    demo: "◐",
    manual: "✎",
  };

  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: colors.stone, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: iconSize,
    }}>
      {icons[sourceKey] ?? "⊕"}
    </div>
  );
}

// ─── Admin View (unchanged) ───────────────────────────────────────────────────

function AdminView({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ADMIN_PASSWORD = "hermentum-founder";

  const handleAuth = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect password.");
    }
  };

  useEffect(() => {
    if (authed) loadMetrics();
  }, [authed]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_metrics");
      if (error) throw error;
      setMetrics(data as Record<string, unknown>);
    } catch {
      setError("Could not load metrics.");
    }
    setLoading(false);
  };

  if (!authed) {
    return (
      <>
        <div style={{ padding: "16px 24px 0" }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", color: colors.muted,
            fontFamily: fonts.sans, fontSize: 14, cursor: "pointer", padding: 0,
          }}>
            ← Back
          </button>
        </div>
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "0 24px 120px",
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 300, color: colors.ink, margin: "0 0 8px" }}>
            Admin
          </h1>
          <p style={{ fontSize: 13, color: colors.muted, fontFamily: fonts.sans, margin: "0 0 24px" }}>
            Enter the founder password to view aggregate metrics.
          </p>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            placeholder="Password"
            style={{
              width: "100%", padding: "14px 16px",
              border: `1px solid ${colors.rule}`, borderRadius: 12,
              fontSize: 15, fontFamily: fonts.sans, color: colors.ink,
              background: colors.paper, outline: "none", boxSizing: "border-box",
              marginBottom: 12,
            }}
          />
          {error && <p style={{ fontSize: 13, color: colors.error, fontFamily: fonts.sans, marginBottom: 12 }}>{error}</p>}
          <button onClick={handleAuth} style={{
            width: "100%", padding: "16px 24px",
            background: colors.ink, border: "none", borderRadius: 999,
            color: colors.cream, fontSize: 15, fontFamily: fonts.sans,
            letterSpacing: 0.5, cursor: "pointer",
          }}>
            View metrics →
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ padding: "16px 24px 0" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: colors.muted,
          fontFamily: fonts.sans, fontSize: 14, cursor: "pointer", padding: 0,
        }}>
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 120px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, color: colors.ink, margin: "8px 0 24px" }}>
          Product Metrics
        </h1>

        {loading ? (
          <p style={{ fontSize: 13, color: colors.faint, fontFamily: fonts.sans }}>Loading...</p>
        ) : metrics ? (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <MetricCard label="Total users" value={metrics.total_users as number} />
              <MetricCard label="Active (7d)" value={metrics.active_users_7d as number} />
              <MetricCard label="Moments today" value={metrics.moments_today as number} />
              <MetricCard label="Avg per user" value={metrics.avg_moments_per_active_user as number} />
              <MetricCard label="Manual today" value={metrics.manual_today as number} />
              <MetricCard label="Automatic today" value={metrics.automatic_today as number} />
              <MetricCard label="Day 7 retention" value={`${Math.round((metrics.day7_retention as number) * 100)}%`} />
            </div>

            <p style={{
              fontSize: 11, color: colors.muted, fontFamily: fonts.sans,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
            }}>
              Category distribution (30d)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries((metrics.category_distribution ?? {}) as Record<string, number>)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "10px 14px", background: colors.paper,
                    border: `1px solid ${colors.rule}`, borderRadius: 10,
                  }}>
                    <span style={{
                      fontSize: 12, color: colors.body, fontFamily: fonts.sans,
                      textTransform: "uppercase", letterSpacing: 1, fontWeight: 600,
                    }}>{cat}</span>
                    <span style={{ fontSize: 14, color: colors.ink, fontFamily: fonts.serif }}>{count}</span>
                  </div>
                ))}
            </div>

            <button onClick={loadMetrics} style={{
              marginTop: 24, background: "none", border: "none",
              color: colors.faint, fontFamily: fonts.sans, fontSize: 13,
              cursor: "pointer", padding: 0,
            }}>Refresh</button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: colors.error, fontFamily: fonts.sans }}>{error}</p>
        )}
      </div>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: colors.paper, borderRadius: 12,
      border: `1px solid ${colors.rule}`, padding: "16px 16px",
      flex: "1 1 140px",
    }}>
      <div style={{
        fontSize: 28, fontWeight: 300, color: colors.ink,
        fontFamily: fonts.serif, lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 10, color: colors.muted, fontFamily: fonts.sans,
        letterSpacing: 1, textTransform: "uppercase", marginTop: 6,
      }}>{label}</div>
    </div>
  );
}
