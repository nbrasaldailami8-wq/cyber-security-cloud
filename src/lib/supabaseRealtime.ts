import { createClient } from "@supabase/supabase-js";

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

  broadcastChannel.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || msg.type !== "presence") return;

    if (msg.action === "CLAIM_ACTIVE" && msg.tabId !== tabId) {
      if (isActiveTab) {
        goToStandby();
      }
    } else if (msg.action === "HEARTBEAT" && msg.tabId !== tabId) {
      // نبضات من التبويب النشط
    }
  };

  claimActive(userId);
}

function claimActive(userId: string) {
  if (typeof window === "undefined") return;

  if (isActiveTab) return;

  isActiveTab = true;

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
  const channelName = await getPresenceChannelName();
  if (!channelName) return;

  presenceUserId = userId;
  presenceChannel = supabase.channel(channelName, {
    config: { presence: { key: hashPresenceKey(userId) } },
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const onlineUsers = Object.values(state).map((entry: any) => entry.userId);
      for (const [, listener] of presenceListeners) {
        listener.callback(onlineUsers);
      }
    })
    .subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          userId,
          online_at: new Date().toISOString(),
        });
        lastSuccessfulTrackAt = Date.now();
      }
    });
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
  try {
    if (presenceChannel && isActiveTab) {
      presenceUserId = userId;
      presenceChannel
        .track({
          userId,
          online_at: new Date().toISOString(),
        })
        .then(() => { lastSuccessfulTrackAt = Date.now(); })
        .catch(() => {});
      return;
    }

    if (presenceChannel && !isActiveTab) {
      return;
    }

    if (!broadcastChannel) {
      setupMultiTabCoordination(userId);
    } else if (!isActiveTab) {
      claimActive(userId);
    } else {
      initPresenceChannel(userId);
    }
  } catch (error) {
    console.error("[Presence] trackPresence error:", error);
  } finally {
    isTrackingPresence = false;
  }
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

/** Full cleanup — removes all presence artifacts (call on logout/unmount) */
export function cleanupPresence(): void {
  clearInterval(heartbeatInterval);
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
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  presenceUserId = "";
  isActiveTab = false;
  lastSuccessfulTrackAt = 0;
  failedHeartbeatCount = 0;
  isTrackingPresence = false;
  heartbeatCount = 0;
  reconnectRetrackCount = 0;
  visibilityRecoveryCount = 0;
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
      heartbeatIntervalMs: HEARTBEAT_INTERVAL,
    });
  }
}

const supabaseRealtime = {
  getSupabase,
  broadcastEvent,
  trackPresence,
  subscribePresence,
  getOnlineUsers,
  isUserOnline,
  cleanupPresence,
};

export default supabaseRealtime;
