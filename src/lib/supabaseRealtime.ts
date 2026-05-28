import { createClient } from "@supabase/supabase-js";
import { tracePresence } from "./realtimeDiagnostics";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

export function getSupabase() {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  return supabase;
}

// ==================== نظام Broadcast عبر WebSocket ====================

const MAX_CHANNELS = 10;

interface ChannelEntry {
  channel: any;
  ready: boolean;
  queue: any[];
  lastUsedAt: number;
}

const channels: Record<string, ChannelEntry> = {};

function evictOldestChannel() {
  const entries = Object.entries(channels);
  if (entries.length < MAX_CHANNELS) return;

  let oldestKey = entries[0][0];
  let oldestTime = entries[0][1].lastUsedAt;

  for (const [key, entry] of entries) {
    if (entry.lastUsedAt < oldestTime) {
      oldestKey = key;
      oldestTime = entry.lastUsedAt;
    }
  }

  channels[oldestKey]?.channel?.unsubscribe();
  delete channels[oldestKey];
}

function getOrCreateChannel(channelName: string) {
  if (!channels[channelName]) {
    // إذا وصلنا للحد الأقصى، نطرد الأقدم استخداماً
    if (Object.keys(channels).length >= MAX_CHANNELS) {
      evictOldestChannel();
    }

    const entry: ChannelEntry = {
      channel: null,
      ready: false,
      queue: [],
      lastUsedAt: Date.now(),
    };

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        entry.ready = true;
        for (const msg of entry.queue) {
          channel
            .send({
              type: "broadcast",
              event: msg.event,
              payload: msg.payload,
            })
            .catch(() => {});
        }
        entry.queue = [];
      }
    });

    entry.channel = channel;
    channels[channelName] = entry;
  } else {
    // تحديث وقت الاستخدام
    channels[channelName].lastUsedAt = Date.now();
  }

  return channels[channelName];
}

export function broadcastEvent(
  channelName: string,
  eventName: string,
  data: any,
): void {
  try {
    const entry = getOrCreateChannel(channelName);

    if (entry.ready) {
      // WebSocket جاهز - إرسال فوري
      entry.channel
        .send({
          type: "broadcast",
          event: eventName,
          payload: data,
        })
        .catch(() => {});
    } else {
      // القناة لم تشترك بعد - تخزين مؤقت
      entry.queue.push({ event: eventName, payload: data });
    }
  } catch (error) {
    console.warn("[Broadcast] Failed to send event:", error);
  }
}

// ==================== نظام Presence (قناة واحدة مشتركة) ====================

function hashPresenceKey(userId: string): string {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash) + userId.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

const MAX_PRESENCE_LISTENERS = 1000;
const LISTENER_MONITOR_INTERVAL = 600_000; // 10 دقائق
const HEARTBEAT_INTERVAL = 10000; // 10 ثوانٍ (optimized for free plan)

// Tracking / guard refs for presence hardening
let lastSuccessfulTrackAt = 0;
let failedHeartbeatCount = 0;
let isTrackingPresence = false;
let heartbeatCount = 0;
let reconnectRetrackCount = 0;
let visibilityRecoveryCount = 0;
let visibilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let listenerMonitorInterval: ReturnType<typeof setInterval> | null = null;

// Heartbeat failover: track last heartbeat from active tab
let lastHeartbeatReceivedAt = 0;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;

// Guard against duplicate initPresenceChannel calls
let initInProgress = false;

// Audio diagnostic counters
let audioPlayed = 0;
let audioSkippedHidden = 0;
let audioSkippedThrottle = 0;
let audioSkippedInactiveTab = 0;
let audioSkippedUnmounted = 0;
let audioDuplicatePrevented = 0;

// Audio diagnostic incrementers (DEV ONLY)
export function trackAudioPlayed() { if (process.env.NODE_ENV === "development") audioPlayed++; }
export function trackAudioSkippedHidden() { if (process.env.NODE_ENV === "development") audioSkippedHidden++; }
export function trackAudioSkippedThrottle() { if (process.env.NODE_ENV === "development") audioSkippedThrottle++; }
export function trackAudioSkippedInactiveTab() { if (process.env.NODE_ENV === "development") audioSkippedInactiveTab++; }
export function trackAudioSkippedUnmounted() { if (process.env.NODE_ENV === "development") audioSkippedUnmounted++; }
export function trackAudioDuplicatePrevented() { if (process.env.NODE_ENV === "development") audioDuplicatePrevented++; }

// تحميل اسم قناة presence من السيرفر
let resolvedPresenceChannelName: string | null = null;
let presenceResolvePromise: Promise<string> | null = null;

async function getPresenceChannelName(): Promise<string> {
  if (resolvedPresenceChannelName) return resolvedPresenceChannelName;
  if (presenceResolvePromise) return presenceResolvePromise;

  presenceResolvePromise = (async () => {
    try {
      const res = await fetch("/api/realtime/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType: "presence" }),
      });
      const data = await res.json();
      if (data.authorized && data.channelName) {
        resolvedPresenceChannelName = data.channelName;
        return data.channelName;
      }
    } catch {
      // fallback — لن يحدث استخدام القناة دون تفويض
    }
    return "";
  })();

  return presenceResolvePromise;
}

let presenceChannel: any = null;
let presenceUserId: string = "";
let listenerIdCounter = 0;
const presenceListeners = new Map<
  number,
  { callback: (users: string[]) => void }
>();

// تنسيق التبويبات المتعددة عبر BroadcastChannel
let tabId = "";
let isActiveTab = false;
let broadcastChannel: BroadcastChannel | null = null;
let heartbeatInterval: any = null;

function setupMultiTabCoordination(userId: string) {
  if (typeof window === "undefined") return;

  tabId = crypto.randomUUID();

  try {
    broadcastChannel = new BroadcastChannel("presence-coordination");
  } catch (error) {
    console.warn("[Presence] BroadcastChannel unavailable, tabs independent:", error);
    isActiveTab = true;
    return;
  }

  lastHeartbeatReceivedAt = Date.now();

  // Re-add visibility listener if it was removed by cleanupPresence()
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  broadcastChannel.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || msg.type !== "presence") return;

    if (msg.action === "CLAIM_ACTIVE" && msg.tabId !== tabId) {
      if (isActiveTab) {
        goToStandby();
      }
    } else if (msg.action === "HEARTBEAT" && msg.tabId !== tabId) {
      // Record heartbeat from active tab for failover detection
      lastHeartbeatReceivedAt = Date.now();
    }
  };

  // Start watchdog: if standby tab sees no heartbeat for >35s, claim active
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    if (isActiveTab) return; // active tab controls itself via heartbeat
    const elapsed = Date.now() - lastHeartbeatReceivedAt;
    if (elapsed > HEARTBEAT_INTERVAL * 3.5) {
      tracePresence("PRESENCE_WATCHDOG_FAILOVER", { tabId, elapsedMs: elapsed, userId });
      claimActive(userId);
    }
  }, HEARTBEAT_INTERVAL);

  claimActive(userId);
}

function claimActive(userId: string) {
  if (typeof window === "undefined") return;

  if (isActiveTab) return;

  tracePresence("PRESENCE_ACTIVE", { tabId, userId });
  isActiveTab = true;

  // Reset heartbeat tracking since we are now the active tab
  lastHeartbeatReceivedAt = Date.now();

  broadcastChannel?.postMessage({ type: "presence", action: "CLAIM_ACTIVE", tabId });

  clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    heartbeatCount++;
    broadcastChannel?.postMessage({ type: "presence", action: "HEARTBEAT", tabId });
    const elapsed = Date.now() - lastSuccessfulTrackAt;
    if (elapsed > HEARTBEAT_INTERVAL * 3) {
      failedHeartbeatCount++;
      if (failedHeartbeatCount >= 3) {
        failedHeartbeatCount = 0;
        reconnectRetrackCount++;
        if (presenceChannel) {
          presenceChannel.track({ userId, online_at: new Date().toISOString() })
            .then(() => { lastSuccessfulTrackAt = Date.now(); })
            .catch(() => {});
        }
      }
    } else {
      failedHeartbeatCount = 0;
    }
  }, HEARTBEAT_INTERVAL);

  initPresenceChannel(userId);
}

function goToStandby() {
  tracePresence("PRESENCE_STANDBY", { tabId, userId: presenceUserId });
  isActiveTab = false;

  clearInterval(heartbeatInterval);
  if (visibilityDebounceTimer) {
    clearTimeout(visibilityDebounceTimer);
    visibilityDebounceTimer = null;
  }

  if (presenceChannel) {
    presenceChannel.unsubscribe();
    presenceChannel = null;
  }

  lastSuccessfulTrackAt = 0;
  failedHeartbeatCount = 0;
  isTrackingPresence = false;
}

async function initPresenceChannel(userId: string) {
  if (initInProgress) {
    tracePresence("PRESENCE_INIT_SKIPPED_DUPLICATE", { tabId, userId });
    return;
  }
  initInProgress = true;
  tracePresence("PRESENCE_INIT_START", { tabId, userId });

  try {
    const channelName = await getPresenceChannelName();
    if (!channelName) {
      console.warn("[Presence] فشل الحصول على اسم قناة الحضور عبر /api/realtime/authorize");
      tracePresence("PRESENCE_INIT_NO_CHANNEL", { tabId, userId });
      return;
    }

    presenceUserId = userId;
    presenceChannel = supabase.channel(channelName, {
      config: { presence: { key: hashPresenceKey(userId) } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const onlineUsers = Object.values(state).map((entry: any) => entry.userId);
        tracePresence("PRESENCE_SYNC", { tabId, userId, onlineCount: onlineUsers.length });
        for (const [, listener] of presenceListeners) {
          listener.callback(onlineUsers);
        }
      })
      .subscribe((status: string) => {
        tracePresence("PRESENCE_STATUS", { tabId, userId, status });
        if (status === "SUBSCRIBED") {
          tracePresence("PRESENCE_SUBSCRIBED", { tabId, userId });
          presenceChannel.track({
            userId,
            online_at: new Date().toISOString(),
          })
            .then(() => {
              lastSuccessfulTrackAt = Date.now();
              tracePresence("PRESENCE_TRACKED", { tabId, userId });
            })
            .catch((err: unknown) => {
              tracePresence("PRESENCE_TRACK_FAILED", { tabId, userId, error: String(err) });
            });
        } else if (status === "CHANNEL_ERROR") {
          tracePresence("PRESENCE_CHANNEL_ERROR", { tabId, userId });
        } else if (status === "TIMED_OUT") {
          tracePresence("PRESENCE_TIMED_OUT", { tabId, userId });
        } else if (status === "CLOSED") {
          tracePresence("PRESENCE_CLOSED", { tabId, userId });
        }
      });
  } finally {
    initInProgress = false;
  }
}

// مراقبة الذاكرة: تسجيل عدد المستمعين كل 10 دقائق
if (typeof window !== "undefined") {
  listenerMonitorInterval = setInterval(() => {
    const count = presenceListeners.size;
    if (count > 500) {
      console.warn(
        `[Presence] High listener count: ${count}/${MAX_PRESENCE_LISTENERS}`,
      );
    }
  }, LISTENER_MONITOR_INTERVAL);
}

export function trackPresence(userId: string): void {
  if (isTrackingPresence) return;
  isTrackingPresence = true;

  (async () => {
    try {
      if (presenceChannel && isActiveTab) {
        tracePresence("PRESENCE_TRACK_REFRESH", { tabId, userId });
        presenceUserId = userId;
        await presenceChannel.track({
          userId,
          online_at: new Date().toISOString(),
        });
        lastSuccessfulTrackAt = Date.now();
        return;
      }

      if (presenceChannel && !isActiveTab) {
        tracePresence("PRESENCE_SKIPPED_STANDBY", { tabId, userId });
        return;
      }

      if (!broadcastChannel) {
        setupMultiTabCoordination(userId);
      } else if (!isActiveTab) {
        claimActive(userId);
      } else {
        await initPresenceChannel(userId);
      }
    } catch (error) {
      console.error("[Presence] trackPresence error:", error);
      tracePresence("PRESENCE_ERROR", { tabId, userId, error: String(error) });
    } finally {
      isTrackingPresence = false;
    }
  })();
}

// Visibility change handling with debounce
function onVisibilityChange() {
  if (visibilityDebounceTimer) clearTimeout(visibilityDebounceTimer);
  visibilityDebounceTimer = setTimeout(() => {
    visibilityDebounceTimer = null;
    if (document.visibilityState === "visible" && presenceUserId) {
      visibilityRecoveryCount++;
      if (!isActiveTab) {
        claimActive(presenceUserId);
      } else {
        trackPresence(presenceUserId);
      }
    }
  }, 500);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibilityChange);
}

export function subscribePresence(
  callback: (users: string[]) => void,
): () => void {
  if (presenceListeners.size >= MAX_PRESENCE_LISTENERS) {
    console.error(
      `[Presence] Max listeners (${MAX_PRESENCE_LISTENERS}) reached, rejecting new subscription`,
    );
    return () => {};
  }

  const id = ++listenerIdCounter;
  presenceListeners.set(id, { callback });

  // إرجاع دالة إلغاء الاشتراك
  return () => {
    presenceListeners.delete(id);
  };
}

/** @deprecated استخدم subscribePresence بدلاً من getOnlineUsers */
export function getOnlineUsers(
  callback: (users: string[]) => void,
): () => void {
  return subscribePresence(callback);
}

export function isUserOnline(userId: string): boolean {
  try {
    if (!presenceChannel) return false;
    const state = presenceChannel.presenceState();
    return Object.keys(state).includes(hashPresenceKey(userId));
  } catch (error) {
    console.warn("[Presence] isUserOnline error:", error);
    return false;
  }
}

/** Returns true if this tab is authorized to play audio (visible + active tab) */
export function isAudioAuthorized(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && isActiveTab;
}

/** Returns true if this tab is authorized to show toast notifications */
export function isToastAuthorized(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && isActiveTab;
}

/** Full cleanup — removes all presence artifacts (call on logout/unmount) */
export function cleanupPresence(): void {
  clearInterval(heartbeatInterval);
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = null;
  if (visibilityDebounceTimer) {
    clearTimeout(visibilityDebounceTimer);
    visibilityDebounceTimer = null;
  }
  if (listenerMonitorInterval) {
    clearInterval(listenerMonitorInterval);
    listenerMonitorInterval = null;
  }
  if (presenceChannel) {
    presenceChannel.unsubscribe();
    presenceChannel = null;
  }
  if (broadcastChannel) {
    broadcastChannel.onmessage = null;
    broadcastChannel.close();
    broadcastChannel = null;
  }
  // Remove visibility listener — setupMultiTabCoordination re-adds it on re-init
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  presenceUserId = "";
  isActiveTab = false;
  lastSuccessfulTrackAt = 0;
  failedHeartbeatCount = 0;
  isTrackingPresence = false;
  lastHeartbeatReceivedAt = 0;
  heartbeatCount = 0;
  reconnectRetrackCount = 0;
  visibilityRecoveryCount = 0;
  initInProgress = false;
  audioPlayed = 0;
  audioSkippedHidden = 0;
  audioSkippedThrottle = 0;
  audioSkippedInactiveTab = 0;
  audioSkippedUnmounted = 0;
  audioDuplicatePrevented = 0;
}

// Presence debug (dev only)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const dbg = (window as any).__REALTIME_DEBUG;
  if (dbg) {
    dbg.audio = () => ({
      played: audioPlayed,
      skippedHidden: audioSkippedHidden,
      skippedThrottle: audioSkippedThrottle,
      skippedInactiveTab: audioSkippedInactiveTab,
      skippedUnmounted: audioSkippedUnmounted,
      duplicatePrevented: audioDuplicatePrevented,
    });
    dbg.presence = () => ({
      activeTab: isActiveTab,
      tabId,
      heartbeatCount,
      failedHeartbeatCount,
      lastSuccessfulTrackAt: lastSuccessfulTrackAt || null,
      isTrackingPresence,
      reconnectRetrackCount,
      visibilityRecoveryCount,
      lastHeartbeatReceivedAt,
      watchdogActive: !!watchdogInterval,
      initInProgress,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL,
    });
  }

  // Dedicated presence debug API
  (window as any).__PRESENCE_DEBUG = {
    channels: () => ({
      presenceChannelExists: !!presenceChannel,
      broadcastChannelExists: !!broadcastChannel,
      isActiveTab,
      tabId,
      watchdogActive: !!watchdogInterval,
      initInProgress,
    }),
    presenceState: () => {
      if (!presenceChannel) return { error: "No presence channel" };
      try {
        const state = presenceChannel.presenceState();
        return { keys: Object.keys(state), count: Object.keys(state).length };
      } catch { return { error: "Failed to read presenceState" }; }
    },
    stats: () => ({
      activeTab: isActiveTab,
      tabId,
      heartbeatCount,
      failedHeartbeatCount,
      lastSuccessfulTrackAt: lastSuccessfulTrackAt || null,
      lastHeartbeatReceivedAt: lastHeartbeatReceivedAt || null,
      isTrackingPresence,
      reconnectRetrackCount,
      visibilityRecoveryCount,
      initInProgress,
      listenerCount: presenceListeners.size,
    }),
    cleanup: () => {
      cleanupPresence();
    },
    retrack: () => {
      if (presenceUserId) trackPresence(presenceUserId);
    },
  };
}

const supabaseRealtime = {
  getSupabase,
  broadcastEvent,
  trackPresence,
  subscribePresence,
  getOnlineUsers,
  isUserOnline,
  cleanupPresence,
  isToastAuthorized,
};

export default supabaseRealtime;
