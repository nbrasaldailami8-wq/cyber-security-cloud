const isDev = process.env.NODE_ENV === "development";

export function rtLog(...args: unknown[]) {
  if (isDev) console.log("[RT]", ...args);
}

export function rtWarn(...args: unknown[]) {
  if (isDev) console.warn("[RT]", ...args);
}

const channels = new Map<string, { state: string; reconnects: number; createdAt: number }>();
const reconnectTimestamps: number[] = [];
const subscriptions = new Set<string>();
let duplicateJoins = 0;

// Notification diagnostics (dev-only — no-op in production)
let notifRefreshCount = 0;
let notifSkippedCount = 0;
let notifDedupHits = 0;
let notifReconnectCount = 0;
let notifLastRefreshAt = 0;

export function trackNotifRefresh() { if (isDev) { notifRefreshCount++; notifLastRefreshAt = Date.now(); } }
export function trackNotifSkipped() { if (isDev) notifSkippedCount++; }
export function trackNotifDedup() { if (isDev) notifDedupHits++; }
export function trackNotifReconnect() { if (isDev) notifReconnectCount++; }

const STORM_WINDOW = 60000;
const STORM_THRESHOLD = 10;

export function registerChannel(name: string, subKey: string) {
  if (channels.has(name)) {
    duplicateJoins++;
  } else {
    channels.set(name, { state: "created", reconnects: 0, createdAt: Date.now() });
  }
  if (subscriptions.has(subKey)) {
    duplicateJoins++;
    rtWarn(`Duplicate subscription: ${subKey}`);
  }
  subscriptions.add(subKey);
  rtLog(`+${name}`);
}

export function updateChannelState(name: string, state: string) {
  const c = channels.get(name);
  if (!c) return;
  c.state = state;
  if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "reconnecting"].includes(state)) {
    c.reconnects++;
    reconnectTimestamps.push(Date.now());
    const cutoff = Date.now() - STORM_WINDOW;
    while (reconnectTimestamps.length && reconnectTimestamps[0] < cutoff)
      reconnectTimestamps.shift();
    if (reconnectTimestamps.length > STORM_THRESHOLD) {
      rtWarn(`Reconnect storm: ${reconnectTimestamps.length} in 60s`);
    }
    rtLog(`~${name} (${c.reconnects})`);
  }
  if (state === "SUBSCRIBED" || state === "connected") {
    rtLog(`✓${name}`);
  }
}

export function unregisterChannel(name: string) {
  const c = channels.get(name);
  if (c) rtLog(`-${name} (${Date.now() - c.createdAt}ms)`);
  channels.delete(name);
}

export function getStormWarning(): boolean {
  const cutoff = Date.now() - STORM_WINDOW;
  while (reconnectTimestamps.length && reconnectTimestamps[0] < cutoff)
    reconnectTimestamps.shift();
  return reconnectTimestamps.length > STORM_THRESHOLD;
}

if (typeof window !== "undefined" && isDev) {
  (window as any).__REALTIME_DEBUG = {
    channels: () =>
      Array.from(channels.entries()).map(([n, c]) => ({
        name: n,
        ...c,
        ageMs: Date.now() - c.createdAt,
      })),
    reconnectCount: () => reconnectTimestamps.length,
    duplicateJoins: () => duplicateJoins,
    subscriptions: () => Array.from(subscriptions),
    stormWarning: () => getStormWarning(),
    notifications: () => ({
      lastRefreshAt: notifLastRefreshAt,
      refreshCount: notifRefreshCount,
      skippedCount: notifSkippedCount,
      dedupHits: notifDedupHits,
      reconnectCount: notifReconnectCount,
    }),
    clear: () => {
      channels.clear();
      subscriptions.clear();
      reconnectTimestamps.length = 0;
      duplicateJoins = 0;
      notifRefreshCount = 0;
      notifSkippedCount = 0;
      notifDedupHits = 0;
      notifReconnectCount = 0;
      notifLastRefreshAt = 0;
    },
  };
  rtLog("Debug API: window.__REALTIME_DEBUG");
}
