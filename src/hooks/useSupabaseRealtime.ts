import { useEffect, useRef, useState } from "react";
import { trackPresence } from "@/lib/supabaseRealtime";
import {
  joinSharedChannel,
  SharedSubscription,
} from "@/lib/sharedChannelPool";
import { getStormWarning, rtLog, traceLifecycle, traceRealtimeEvent } from "@/lib/realtimeDiagnostics";

type EventHandler = (data: any) => void;

interface EventConfig {
  event: string;
  handler: EventHandler;
}

type EventsArg = EventConfig[] | string;

type ConnectionState = "connected" | "disconnected" | "reconnecting";

function extractUserId(channelName: string): string | null {
  const prefix = "user-";
  if (channelName.startsWith(prefix)) {
    return channelName.slice(prefix.length);
  }
  return null;
}

function authorizeChannel(
  channelName: string,
  channelUserId?: string,
): Promise<{ authorized: boolean; channelName: string }> {
  const userId = channelUserId || extractUserId(channelName);
  return fetch("/api/realtime/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelUserId: userId || null, channelName }),
  })
    .then((res) => res.json())
    .then((data) => ({
      authorized: data.authorized === true,
      channelName: data.channelName || channelName,
    }))
    .catch(() => ({ authorized: false, channelName }));
}

function normalizeEvents(
  events: EventsArg,
  handler?: EventHandler,
): EventConfig[] {
  if (typeof events === "string") {
    if (handler) return [{ event: events, handler }];
    return [];
  }
  return events;
}

export function useSupabaseRealtime(
  channelName: string,
  events: EventsArg,
  handler?: EventHandler,
) {
  const normalizedEvents = normalizeEvents(events, handler);
  const subRef = useRef<SharedSubscription | null>(null);
  const handlersRef = useRef<EventConfig[]>(normalizedEvents);
  const userIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const resolvedChannelRef = useRef<string>(channelName);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const reconnectCountRef = useRef(0);
  const lastConnectedAtRef = useRef<number | null>(null);
  const lastReconnectAtRef = useRef<number | null>(null);

  // Sync handlersRef with latest event configs after every render
  useEffect(() => {
    handlersRef.current = normalizedEvents;
    if (subRef.current) {
      subRef.current.updateHandlers(normalizedEvents);
    }
  });

  // Stable key derived from event names ONLY — NOT handler references.
  // Only actual event name changes cause subscription recreation.
  const eventsKeyRef = useRef("");
  const [subscribeEpoch, setSubscribeEpoch] = useState(0);

  const currentEventsKey = normalizedEvents
    .map((e) => e.event)
    .sort()
    .join(",");
  if (currentEventsKey !== eventsKeyRef.current) {
    eventsKeyRef.current = currentEventsKey;
    setSubscribeEpoch((e) => e + 1);
  }

  useEffect(() => {
    mountedRef.current = true;
    const userId = extractUserId(channelName);
    userIdRef.current = userId;
    traceLifecycle("useSupabaseRealtime", "MOUNT", { channelName, userId });

    authorizeChannel(channelName, userId || undefined).then((result) => {
      if (!mountedRef.current) return;
      if (result.authorized && result.channelName) {
        resolvedChannelRef.current = result.channelName;

        // Storm protection check before joining pool
        if (getStormWarning()) {
          rtLog("Storm protection active, delaying channel join");
          setTimeout(() => {
            if (mountedRef.current) {
              void subscribeEpoch; // force re-evaluation
              joinPool(result.channelName);
            }
          }, 5000);
          return;
        }

        joinPool(result.channelName);
      } else {
        setConnectionState("disconnected");
      }
    });

    return () => {
      mountedRef.current = false;
      traceLifecycle("useSupabaseRealtime", "UNMOUNT", { channelName, userId });
      if (subRef.current) {
        subRef.current.leave();
        subRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, subscribeEpoch]);

  function joinPool(resolvedName: string) {
    if (subRef.current) {
      subRef.current.leave();
      subRef.current = null;
    }

    // Wrap handlers with trace instrumentation
    const tracedHandlers = handlersRef.current.map((evt) => ({
      event: evt.event,
      handler: (data: any) => {
        const arrivalTs = Date.now();
        traceRealtimeEvent(evt.event, data?.id || data?.messageId || "unknown", arrivalTs, null, { channelName: resolvedName });
        evt.handler(data);
      },
    }));

    subRef.current = joinSharedChannel(
      resolvedName,
      tracedHandlers,
      (state, meta) => {
        if (!mountedRef.current) return;
        setConnectionState(state);
        reconnectCountRef.current = meta.reconnectCount;
        if (meta.lastConnectedAt) lastConnectedAtRef.current = meta.lastConnectedAt;
        if (meta.lastReconnectAt) lastReconnectAtRef.current = meta.lastReconnectAt;
        if (state === "connected" && userIdRef.current) {
          trackPresence(userIdRef.current);
        }
      },
      userIdRef.current,
    );
  }

  return {
    connectionState,
    reconnectCount: reconnectCountRef.current,
    lastConnectedAt: lastConnectedAtRef.current,
    lastReconnectAt: lastReconnectAtRef.current,
  };
}
