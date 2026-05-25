import { useEffect, useRef, useCallback, useState } from "react";
import { getSupabase } from "@/lib/supabaseRealtime";

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

async function authorizeChannel(channelName: string, channelUserId?: string): Promise<{ authorized: boolean; channelName: string }> {
  const userId = channelUserId || extractUserId(channelName);
  try {
    const res = await fetch("/api/realtime/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelUserId: userId || null, channelName }),
    });
    const data = await res.json();
    return { authorized: data.authorized === true, channelName: data.channelName || channelName };
  } catch {
    return { authorized: false, channelName };
  }
}

function normalizeEvents(events: EventsArg, handler?: EventHandler): EventConfig[] {
  if (typeof events === "string") {
    if (handler) {
      return [{ event: events, handler }];
    }
    return [];
  }
  return events;
}

function calculateBackoff(attempt: number): number {
  const baseMs = 1000;
  const maxMs = 30000;
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponential * 0.1 * Math.random();
  return Math.floor(exponential + jitter);
}

export function useSupabaseRealtime(
  channelName: string,
  events: EventsArg,
  handler?: EventHandler,
) {
  const normalizedEvents = normalizeEvents(events, handler);
  const handlersRef = useRef<EventConfig[]>(normalizedEvents);
  const retryCountRef = useRef(0);
  const channelRef = useRef<any>(null);
  const retryTimerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const resolvedChannelRef = useRef<string>(channelName);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

  useEffect(() => {
    handlersRef.current = normalizedEvents;
  }, [normalizedEvents]);

  const doSubscribe = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const supabase = getSupabase();
      const channel = supabase.channel(resolvedChannelRef.current);

      for (const { event } of normalizedEvents) {
        channel.on("broadcast", { event }, (payload: any) => {
          const currentHandlers = handlersRef.current;
          const config = currentHandlers.find((e) => e.event === event);
          if (config) {
            config.handler(payload.payload);
          }
        });
      }

      channel.subscribe((status: string) => {
        if (!mountedRef.current) return;
        if (status === "SUBSCRIBED") {
          retryCountRef.current = 0;
          setConnectionState("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          retryCountRef.current += 1;
          setConnectionState("reconnecting");
          const delay = calculateBackoff(retryCountRef.current);
          retryTimerRef.current = setTimeout(() => doSubscribe(), delay);
        }
      });

      channelRef.current = channel;
    } catch {
      // ignore
    }
  }, [normalizedEvents]);

  useEffect(() => {
    mountedRef.current = true;
    const userId = extractUserId(channelName);

    authorizeChannel(channelName, userId || undefined).then((result) => {
      if (!mountedRef.current) return;
      if (result.authorized && result.channelName) {
        resolvedChannelRef.current = result.channelName;
        doSubscribe();
      } else {
        setConnectionState("disconnected");
      }
    });

    return () => {
      mountedRef.current = false;
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        const supabase = getSupabase();
        supabase.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
    };
  }, [channelName, doSubscribe]);

  return { connectionState };
}
