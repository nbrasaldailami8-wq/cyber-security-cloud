import { getSupabase, trackPresence } from "./supabaseRealtime";
import {
  registerChannel,
  updateChannelState,
  unregisterChannel,
  trackListenerBind,
  trackReconnectBind,
  registerPoolSnapshot,
} from "./realtimeDiagnostics";

type ConnectionState = "connected" | "disconnected" | "reconnecting";

interface HandlerEntry {
  event: string;
  handler: (data: any) => void;
}

interface Subscriber {
  handlersRef: { current: HandlerEntry[] };
  onStateChange: (
    state: ConnectionState,
    meta: {
      reconnectCount: number;
      lastConnectedAt: number | null;
      lastReconnectAt: number | null;
    },
  ) => void;
  presenceUserId: string | null;
}

interface PoolEntry {
  channelName: string;
  channel: any;
  state: ConnectionState;
  subscribers: Map<string, Subscriber>;
  retryCount: number;
  lastConnectedAt: number | null;
  lastReconnectAt: number | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  registeredEvents: Set<string>;
  mounted: boolean;
}

const pool = new Map<string, PoolEntry>();

registerPoolSnapshot(() => ({
  size: pool.size,
  entries: Array.from(pool.entries()).map(([name, entry]) => ({
    channelName: name,
    state: entry.state,
    subscriberCount: entry.subscribers.size,
    registeredEvents: Array.from(entry.registeredEvents),
    retryCount: entry.retryCount,
    mounted: entry.mounted,
  })),
}));

function backoff(attempt: number): number {
  const baseMs = 1000;
  const maxMs = 30000;
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  return Math.floor(exponential + exponential * 0.1 * Math.random());
}

function notifyAll(entry: PoolEntry, state: ConnectionState) {
  entry.state = state;
  const meta = {
    reconnectCount: entry.retryCount,
    lastConnectedAt: entry.lastConnectedAt,
    lastReconnectAt: entry.lastReconnectAt,
  };
  for (const [, sub] of entry.subscribers) {
    sub.onStateChange(state, meta);
  }
}

// Register channel listeners for events not yet covered
function registerEventListeners(entry: PoolEntry, events: string[]) {
  if (!entry.channel) return;
  for (const evt of events) {
    if (entry.registeredEvents.has(evt)) continue;
    entry.channel.on("broadcast", { event: evt }, (payload: any) => {
      if (!entry.mounted) return;
      for (const [, sub] of entry.subscribers) {
        const h = sub.handlersRef.current.find((e) => e.event === evt);
        if (h) h.handler(payload.payload);
      }
    });
    trackListenerBind();
    entry.registeredEvents.add(evt);
  }
}

function collectNewEvents(entry: PoolEntry): string[] {
  const active = new Set<string>();
  for (const [, sub] of entry.subscribers) {
    for (const h of sub.handlersRef.current) {
      active.add(h.event);
    }
  }
  const result: string[] = [];
  for (const evt of active) {
    if (!entry.registeredEvents.has(evt)) result.push(evt);
  }
  return result;
}

function collectAllEvents(entry: PoolEntry): string[] {
  const active = new Set<string>();
  for (const [, sub] of entry.subscribers) {
    for (const h of sub.handlersRef.current) {
      active.add(h.event);
    }
  }
  return Array.from(active);
}

function subscribePoolEntry(entry: PoolEntry) {
  if (!entry.mounted) return;

  const supabase = getSupabase();

  // V011: Orphaned channel cleanup — remove old channel before creating fresh one
  if (entry.channel) {
    supabase.removeChannel(entry.channel).catch(() => {});
    entry.channel = null;
  }

  const channel = supabase.channel(entry.channelName);

  entry.channel = channel;
  entry.registeredEvents.clear();

  if (entry.retryCount > 0) trackReconnectBind();

  // Register all events from all current subscribers on the fresh channel
  const allEvents = collectAllEvents(entry);
  registerEventListeners(entry, allEvents);

  channel.subscribe((status: string) => {
    // V012: Stale callback guard — fail fast if channel has been replaced since subscription
    if (entry.channel !== channel) return;
    if (!entry.mounted) return;
    updateChannelState(entry.channelName, status);
    if (status === "SUBSCRIBED") {
      entry.retryCount = 0;
      entry.lastConnectedAt = Date.now();
      notifyAll(entry, "connected");
      for (const [, sub] of entry.subscribers) {
        if (sub.presenceUserId) trackPresence(sub.presenceUserId);
      }
    } else if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      entry.retryCount++;
      entry.lastReconnectAt = Date.now();
      notifyAll(entry, "reconnecting");
      const delay = backoff(entry.retryCount);
      // V017: Null stale retry timer before scheduling new retry to avoid stale reference
      entry.retryTimer = setTimeout(() => {
        entry.retryTimer = null;
        subscribePoolEntry(entry);
      }, delay);
    }
  });
}

export interface SharedSubscription {
  subscriberId: string;
  updateHandlers: (handlers: HandlerEntry[]) => void;
  leave: () => void;
}

let idCounter = 0;

export function joinSharedChannel(
  channelName: string,
  handlers: HandlerEntry[],
  onStateChange: Subscriber["onStateChange"],
  presenceUserId: string | null,
): SharedSubscription {
  const subscriberId = `sub_${++idCounter}_${Date.now()}`;

  if (!pool.has(channelName)) {
    const entry: PoolEntry = {
      channelName,
      channel: null,
      state: "disconnected",
      subscribers: new Map(),
      retryCount: 0,
      lastConnectedAt: null,
      lastReconnectAt: null,
      retryTimer: null,
      registeredEvents: new Set(),
      mounted: true,
    };
    pool.set(channelName, entry);
  }

  const entry = pool.get(channelName)!;
  const handlersRef = { current: handlers };

  entry.subscribers.set(subscriberId, {
    handlersRef,
    onStateChange,
    presenceUserId,
  });

  // Register any new events this subscriber brings
  const newEvents = collectNewEvents(entry);
  registerEventListeners(entry, newEvents);

  const eventNames = Array.from(entry.registeredEvents).sort().join(",");
  registerChannel(channelName, `${channelName}:${eventNames}`);

  if (!entry.channel) {
    subscribePoolEntry(entry);
  } else if (entry.state === "connected") {
    // Late joiner: immediately report current connected state
    onStateChange("connected", {
      reconnectCount: entry.retryCount,
      lastConnectedAt: entry.lastConnectedAt,
      lastReconnectAt: entry.lastReconnectAt,
    });
  }

  return {
    subscriberId,
    updateHandlers: (newHandlers: HandlerEntry[]) => {
      handlersRef.current = newHandlers;
      // Register any new events the subscriber may have added
      const added = collectNewEvents(entry);
      registerEventListeners(entry, added);
    },
    leave: () => {
      entry.subscribers.delete(subscriberId);
      if (entry.subscribers.size === 0) {
        entry.mounted = false;
        if (entry.retryTimer) clearTimeout(entry.retryTimer);
        if (entry.channel) {
          const supabase = getSupabase();
          supabase.removeChannel(entry.channel).catch(() => {});
        }
        unregisterChannel(channelName);
        pool.delete(channelName);
      }
    },
  };
}
