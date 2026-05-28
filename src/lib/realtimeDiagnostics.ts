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

let listenerBindCount = 0;
let reconnectBindCount = 0;

export function trackListenerBind() { if (isDev) listenerBindCount++; }
export function trackReconnectBind() { if (isDev) reconnectBindCount++; }

export function registerPoolSnapshot(getSnapshot: () => unknown) {
  if (isDev && typeof window !== "undefined") {
    (window as any).__REALTIME_DEBUG.poolSnapshot = getSnapshot;
  }
}

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
    rtLog(`\u2713${name}`);
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

// ==================== TRACE INFRASTRUCTURE ====================

let traceSeq = 0;
const MAX_TRACE = 1000;

interface TraceEntry {
  seq: number;
  ts: number;
  type: string;
  label: string;
  details: Record<string, unknown>;
}

const mutationBuffer: TraceEntry[] = [];
const messageVisibilityBuffer: TraceEntry[] = [];
const conversationBuffer: TraceEntry[] = [];
const realtimeEventLog: TraceEntry[] = [];
const apiResponseLog: TraceEntry[] = [];
const tempMessageLog: TraceEntry[] = [];
const audioTraceBuffer: TraceEntry[] = [];
const lifecycleBuffer: TraceEntry[] = [];
const asyncOrderBuffer: TraceEntry[] = [];
const renderAuthorityBuffer: TraceEntry[] = [];

// ==================== FORENSIC BUFFERS ====================
const messageLifecycleBuffer: TraceEntry[] = [];
const renderSkipBuffer: TraceEntry[] = [];
const authorityTimelineBuffer: TraceEntry[] = [];
const audioFailureBuffer: TraceEntry[] = [];
const realtimeLatencyBuffer: TraceEntry[] = [];
const remountBuffer: TraceEntry[] = [];

function boundedPush(arr: TraceEntry[], entry: TraceEntry, max: number) {
  arr.unshift(entry);
  if (arr.length > max) arr.length = max;
}

function pushEntry(type: string, label: string, details: Record<string, unknown> = {}) {
  if (!isDev) return null;
  const entry: TraceEntry = {
    seq: ++traceSeq,
    ts: Date.now(),
    type,
    label,
    details,
  };
  return entry;
}

// ==================== 1. MESSAGE STATE MUTATION TRACE ====================
export function traceMessageMutation(
  source: string,
  label: string,
  prevIds: string[],
  nextIds: string[],
  selectedUserId: string | null | undefined,
  conversationId: string | null | undefined,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const removedIds = prevIds.filter(id => !nextIds.includes(id));
  const addedIds = nextIds.filter(id => !prevIds.includes(id));
  const entry = pushEntry("STATE_MUTATION", label, {
    source,
    prevLength: prevIds.length,
    nextLength: nextIds.length,
    prevIds,
    nextIds,
    removedIds,
    addedIds,
    selectedUserId: selectedUserId || null,
    conversationId: conversationId || null,
    tempIdsPreserved: nextIds.filter(id => id.startsWith("temp_")),
    tempIdsLost: prevIds.filter(id => id.startsWith("temp_") && !nextIds.includes(id)),
    ...extra,
  });
  if (entry) boundedPush(mutationBuffer, entry, 500);

  if (label.startsWith("REALTIME_") || label === "LOAD_MESSAGES_API") {
    const msgEntry = pushEntry("MESSAGE_VISIBILITY", label, {
      ...extra,
      prevIds,
      nextIds,
      selectedUserId: selectedUserId || null,
    });
    if (msgEntry) boundedPush(messageVisibilityBuffer, msgEntry, 300);
  }

  // ===== FORENSIC: Track removed messages =====
  if (removedIds.length > 0) {
    for (const removedId of removedIds) {
      const lifecycleEntry = pushEntry("MESSAGE_LIFECYCLE", "MESSAGE_REMOVED_FROM_STATE", {
        msgId: removedId,
        source,
        label,
        selectedUserId: selectedUserId || null,
        conversationId: conversationId || null,
        wasTemp: removedId.startsWith("temp_"),
        mutationSeq: entry?.seq || 0,
        ...extra,
      });
      if (lifecycleEntry) boundedPush(messageLifecycleBuffer, lifecycleEntry, 500);
    }
  }

  // ===== FORENSIC: Track added messages =====
  if (addedIds.length > 0) {
    for (const addedId of addedIds) {
      const lifecycleEntry = pushEntry("MESSAGE_LIFECYCLE", "MESSAGE_ENTERED_STATE", {
        msgId: addedId,
        source,
        label,
        selectedUserId: selectedUserId || null,
        conversationId: conversationId || null,
        isTemp: addedId.startsWith("temp_"),
        mutationSeq: entry?.seq || 0,
        ...extra,
      });
      if (lifecycleEntry) boundedPush(messageLifecycleBuffer, lifecycleEntry, 500);
    }
  }

  // ===== FORENSIC: Track authority timeline =====
  const authEntry = pushEntry("AUTHORITY_TIMELINE", label, {
    source,
    msgCount: nextIds.length,
    removedCount: removedIds.length,
    addedCount: addedIds.length,
    selectedUserId: selectedUserId || null,
    ...extra,
  });
  if (authEntry) boundedPush(authorityTimelineBuffer, authEntry, 300);
}

// ==================== 2. MESSAGE VISIBILITY TRACE ====================
export function traceMessageVisibility(
  eventPayloadId: string,
  senderId: string,
  receiverId: string,
  selectedUserId: string | null | undefined,
  enteredState: boolean,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("MESSAGE_VISIBILITY", "VISIBILITY_CHECK", {
    eventPayloadId,
    senderId,
    receiverId,
    selectedUserId: selectedUserId || null,
    enteredState,
    ...extra,
  });
  if (entry) boundedPush(messageVisibilityBuffer, entry, 300);
}

// ==================== 2b. FORENSIC: Render skip tracking ====================
export function traceRenderSkip(
  totalInState: number,
  rendered: number,
  skippedIds: string[],
  reason: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("RENDER_SKIP", reason, {
    totalInState,
    rendered,
    skippedCount: skippedIds.length,
    skippedIds,
    reason,
    ...extra,
  });
  if (entry) boundedPush(renderSkipBuffer, entry, 300);

  // Also add MESSAGE_NOT_RENDERED to lifecycle
  for (const skippedId of skippedIds) {
    const lcEntry = pushEntry("MESSAGE_LIFECYCLE", "MESSAGE_NOT_RENDERED", {
      msgId: skippedId,
      reason,
      totalInState,
      ...extra,
    });
    if (lcEntry) boundedPush(messageLifecycleBuffer, lcEntry, 200);
  }
}

// ==================== 2c. FORENSIC: Message lifecycle ====================
export function traceMessageLifecycle(
  label: string,
  msgId: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("MESSAGE_LIFECYCLE", label, {
    msgId,
    ...extra,
  });
  if (entry) boundedPush(messageLifecycleBuffer, entry, 500);
}

// ==================== 3. CONVERSATION AUTHORITY TRACE ====================
export function traceConversationMutation(
  source: string,
  label: string,
  prevIds: string[],
  nextIds: string[],
  prevUnread: number,
  nextUnread: number,
  selectedUserId: string | null | undefined,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("CONVERSATION_MUTATION", label, {
    source,
    prevLength: prevIds.length,
    nextLength: nextIds.length,
    prevIds,
    nextIds,
    prevUnread,
    nextUnread,
    selectedUserId: selectedUserId || null,
    ...extra,
  });
  if (entry) boundedPush(conversationBuffer, entry, 300);
}

// ==================== 4. ASYNC RESPONSE ORDER TRACE ====================
let asyncSeqCounter = 0;

export function traceAsyncRequest(
  endpoint: string,
  label: string,
  selectedUserId: string | null | undefined,
  extra: Record<string, unknown> = {},
): number {
  if (!isDev) return 0;
  const seqId = ++asyncSeqCounter;
  const entry = pushEntry("API_REQUEST", label, {
    endpoint,
    seqId,
    requestTimestamp: Date.now(),
    selectedUserId: selectedUserId || null,
    ...extra,
  });
  if (entry) boundedPush(apiResponseLog, entry, 200);
  if (entry) boundedPush(asyncOrderBuffer, entry, 200);
  return seqId;
}

export function traceAsyncResponse(
  endpoint: string,
  label: string,
  seqId: number,
  requestTimestamp: number,
  selectedUserIdAtResponse: string | null | undefined,
  latestRealtimeTimestamp: number | null,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const responseTimestamp = Date.now();
  const latency = requestTimestamp > 0 ? responseTimestamp - requestTimestamp : -1;
  const isStale = latestRealtimeTimestamp != null && requestTimestamp < latestRealtimeTimestamp;
  const entry = pushEntry("API_RESPONSE", label, {
    endpoint,
    seqId,
    requestTimestamp,
    responseTimestamp,
    latency,
    isStale,
    flag: isStale ? "API_RESPONSE_STALE" : "API_RESPONSE_LIVE",
    selectedUserIdAtResponse,
    latestRealtimeTimestamp,
    ...extra,
  });
  if (entry) {
    boundedPush(apiResponseLog, entry, 200);
    boundedPush(asyncOrderBuffer, entry, 200);

    // FORENSIC: Track API overwhelm of realtime
    if (isStale) {
      const overwriteEntry = pushEntry("AUTHORITY_TIMELINE", "API_RESPONSE_OVERRULED_REALTIME", {
        seqId,
        endpoint,
        requestTimestamp,
        responseTimestamp,
        realtimeTimestamp: latestRealtimeTimestamp,
        staleAge: responseTimestamp - (latestRealtimeTimestamp || responseTimestamp),
        ...extra,
      });
      if (overwriteEntry) boundedPush(authorityTimelineBuffer, overwriteEntry, 200);
    }
  }
}

// ==================== 5. REALTIME EVENT EXECUTION TRACE ====================
let _lastRealtimeArrivalAt = 0;

export function traceRealtimeEvent(
  eventType: string,
  payloadId: string | null | undefined,
  arrivalTimestamp: number,
  selectedUserIdAtArrival: string | null | undefined,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  _lastRealtimeArrivalAt = arrivalTimestamp;
  const handlerTs = Date.now();
  const entry = pushEntry("REALTIME_EVENT", eventType, {
    payloadId: payloadId || null,
    arrivalTimestamp,
    handlerExecutionTimestamp: handlerTs,
    latency: handlerTs - arrivalTimestamp,
    selectedUserIdAtArrival: selectedUserIdAtArrival || null,
    ...extra,
  });
  if (entry) boundedPush(realtimeEventLog, entry, 300);

  // FORENSIC: Realtime latency tracking
  const latencyEntry = pushEntry("REALTIME_LATENCY", eventType, {
    payloadId: payloadId || null,
    arrivalTimestamp,
    handlerExecutionTimestamp: handlerTs,
    realtimeToHandlerMs: handlerTs - arrivalTimestamp,
    stateMutationTimestamp: 0,
    renderTimestamp: 0,
    stage: "handler_executed",
    ...extra,
  });
  if (latencyEntry) boundedPush(realtimeLatencyBuffer, latencyEntry, 200);
}

export function getLastRealtimeArrivalAt() { return _lastRealtimeArrivalAt; }

// ==================== 6. OPTIMISTIC MESSAGE TRACE ====================
export function traceOptimistic(
  label: string,
  tempId: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("OPTIMISTIC", label, {
    tempId,
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) boundedPush(tempMessageLog, entry, 200);
}

// ==================== 7. AUDIO EXECUTION TRACE ====================
export function traceAudio(
  label: string,
  notificationType: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("AUDIO", label, {
    notificationType,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
    pathname: typeof window !== "undefined" ? window.location.pathname : "unknown",
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) boundedPush(audioTraceBuffer, entry, 300);
}

// ==================== 7b. FORENSIC: Audio failure tracking ====================
export function traceAudioForensic(
  label: string,
  notificationType: string,
  rejectionReason: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("AUDIO_FAILURE", label, {
    notificationType,
    rejectionReason,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
    pathname: typeof window !== "undefined" ? window.location.pathname : "unknown",
    isActiveTab: false, // set by caller if known
    throttleRemaining: 0, // set by caller if known
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) boundedPush(audioFailureBuffer, entry, 200);

  const audioEntry = pushEntry("AUDIO", label, {
    notificationType,
    rejectionReason,
    forensicFailure: true,
    ...extra,
  });
  if (audioEntry) boundedPush(audioTraceBuffer, audioEntry, 300);
}

// ==================== 8. COMPONENT LIFECYCLE TRACE ====================
export function traceLifecycle(
  component: string,
  event: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("LIFECYCLE", `${component}_${event}`, {
    component,
    event,
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) {
    boundedPush(lifecycleBuffer, entry, 200);

    // FORENSIC: Detect remount resets
    if (event === "MOUNT") {
      const remountEntry = pushEntry("REMOUNT", "COMPONENT_MOUNT", {
        component,
        ...extra,
      });
      if (remountEntry) boundedPush(remountBuffer, remountEntry, 100);
    }
    if (event === "UNMOUNT") {
      const remountEntry = pushEntry("REMOUNT", "COMPONENT_UNMOUNT", {
        component,
        ...extra,
      });
      if (remountEntry) boundedPush(remountBuffer, remountEntry, 100);
    }
  }
}

// ==================== 10. PRESENCE DIAGNOSTIC TRACE ====================
const presenceTraceBuffer: TraceEntry[] = [];
const typingTraceBuffer: TraceEntry[] = [];

export function tracePresence(
  label: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("PRESENCE", label, {
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) boundedPush(presenceTraceBuffer, entry, 200);
}

export function traceTyping(
  label: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("TYPING", label, {
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) boundedPush(typingTraceBuffer, entry, 200);
}

export function dumpPresenceTrace() { return presenceTraceBuffer.slice(); }
export function dumpTypingTrace() { return typingTraceBuffer.slice(); }

// ==================== 9. RENDER AUTHORITY TRACE ====================
export function traceRenderAuthority(
  component: string,
  mutationSource: string,
  selectedUserId: string | null | undefined,
  extra: Record<string, unknown> = {},
) {
  if (!isDev) return;
  const entry = pushEntry("RENDER_AUTHORITY", `${component}_${mutationSource}`, {
    component,
    mutationSource,
    selectedUserId: selectedUserId || null,
    timestamp: Date.now(),
    ...extra,
  });
  if (entry) boundedPush(renderAuthorityBuffer, entry, 200);
}

// ==================== FORENSIC: Final state ownership ====================
let _lastOwner: string = "none";
let _lastRealtimeOwner: string = "none";
let _lastApiOwner: string = "none";
let _lastStateTimestamp: number = 0;

export function trackMutationTimestamp(source: string) {
  const now = Date.now();
  _lastStateTimestamp = now;
  _lastOwner = source;
  if (source.startsWith("REALTIME") || source.startsWith("CLIENT_OPTIMISTIC")) {
    _lastRealtimeOwner = source;
  } else if (source.startsWith("API") || source.startsWith("LOAD") || source.startsWith("CLIENT_SEND") || source.startsWith("CLIENT_CLOSE") || source.startsWith("CLIENT_CONVERSATION")) {
    _lastApiOwner = source;
  }
}

export function getLastRealtimeMutationAt() { return _lastStateTimestamp; }
export function getLastApiMutationAt() { return _lastApiOwner !== "none" ? _lastStateTimestamp : 0; }
export function getLastMutationSource() { return _lastOwner; }
export function getLastOwner() { return _lastOwner; }
export function getLastRealtimeOwner() { return _lastRealtimeOwner; }
export function getLastApiOwner() { return _lastApiOwner; }

// ==================== FORENSIC: Realtime latency stage update ====================
export function updateRealtimeLatencyMutation(payloadId: string | null | undefined) {
  if (!isDev || !payloadId) return;
  const now = Date.now();
  const entry = pushEntry("REALTIME_LATENCY", "state_mutation", {
    payloadId,
    stateMutationTimestamp: now,
    stage: "state_mutated",
  });
  if (entry) boundedPush(realtimeLatencyBuffer, entry, 200);
}

export function updateRealtimeLatencyRender(payloadId: string | null | undefined) {
  if (!isDev || !payloadId) return;
  const now = Date.now();
  const entry = pushEntry("REALTIME_LATENCY", "render", {
    payloadId,
    renderTimestamp: now,
    stage: "render_completed",
  });
  if (entry) boundedPush(realtimeLatencyBuffer, entry, 200);
}

// ==================== WINDOW FORENSICS API ====================
if (typeof window !== "undefined" && isDev) {
  (window as any).__REALTIME_TRACE = {
    dumpMessages: () => mutationBuffer.slice(),
    dumpConversations: () => conversationBuffer.slice(),
    dumpPendingTemps: () => tempMessageLog.slice(),
    dumpRealtimeEvents: () => realtimeEventLog.slice(),
    dumpApiResponses: () => apiResponseLog.slice(),
    dumpStateMutations: () => mutationBuffer.slice(),
    dumpAudioTrace: () => audioTraceBuffer.slice(),
    dumpLifecycle: () => lifecycleBuffer.slice(),
    dumpAuthority: () => renderAuthorityBuffer.slice(),
    dumpVisibility: () => messageVisibilityBuffer.slice(),
    dumpAsyncOrder: () => asyncOrderBuffer.slice(),
    dumpPresenceTrace: () => presenceTraceBuffer.slice(),
    dumpTypingTrace: () => typingTraceBuffer.slice(),
    dumpAll: () => ({
      mutations: mutationBuffer.slice(),
      conversations: conversationBuffer.slice(),
      temps: tempMessageLog.slice(),
      realtime: realtimeEventLog.slice(),
      api: apiResponseLog.slice(),
      audio: audioTraceBuffer.slice(),
      lifecycle: lifecycleBuffer.slice(),
      authority: renderAuthorityBuffer.slice(),
      visibility: messageVisibilityBuffer.slice(),
      asyncOrder: asyncOrderBuffer.slice(),
    }),
    getLatestRealtimeTimestamp: () => _lastStateTimestamp,
    getLatestApiTimestamp: () => _lastApiOwner !== "none" ? _lastStateTimestamp : 0,
    getLastMutationSource: () => _lastOwner,
    clear: () => {
      mutationBuffer.length = 0;
      conversationBuffer.length = 0;
      tempMessageLog.length = 0;
      realtimeEventLog.length = 0;
      apiResponseLog.length = 0;
      audioTraceBuffer.length = 0;
      lifecycleBuffer.length = 0;
      renderAuthorityBuffer.length = 0;
      messageVisibilityBuffer.length = 0;
      asyncOrderBuffer.length = 0;
      messageLifecycleBuffer.length = 0;
      renderSkipBuffer.length = 0;
      authorityTimelineBuffer.length = 0;
      audioFailureBuffer.length = 0;
      realtimeLatencyBuffer.length = 0;
      remountBuffer.length = 0;
      traceSeq = 0;
      _lastOwner = "none";
      _lastRealtimeOwner = "none";
      _lastApiOwner = "none";
      _lastStateTimestamp = 0;
      _lastRealtimeArrivalAt = 0;
      if (process.env.NODE_ENV === "development") console.log("[RT_FORENSICS] Cleared all buffers");
    },
  };

  (window as any).__REALTIME_FORENSICS = {
    // Message lifecycle
    dumpMessageLifecycle: () => messageLifecycleBuffer.slice(),
    dumpRemovedMessages: () =>
      messageLifecycleBuffer.filter((e) => e.label === "MESSAGE_REMOVED_FROM_STATE"),
    dumpRenderSkips: () => renderSkipBuffer.slice(),

    // Authority
    dumpAuthorityTimeline: () => authorityTimelineBuffer.slice(),
    dumpFinalOwners: () => ({
      lastOwner: _lastOwner,
      lastRealtimeOwner: _lastRealtimeOwner,
      lastApiOwner: _lastApiOwner,
      lastStateTimestamp: _lastStateTimestamp,
    }),

    // API vs Realtime
    dumpApiVsRealtime: () =>
      asyncOrderBuffer.filter((e) =>
        e.type === "API_RESPONSE" && (e.details as any)?.flag === "API_RESPONSE_STALE"
      ),

    // Audio
    dumpAudioFailures: () => audioFailureBuffer.slice(),

    // Latency
    dumpRealtimeLatency: () => realtimeLatencyBuffer.slice(),

    // Remounts
    dumpRemounts: () => {
      const mounts = remountBuffer.filter((e) => e.label === "COMPONENT_MOUNT");
      const unmounts = remountBuffer.filter((e) => e.label === "COMPONENT_UNMOUNT");
      const suspicious: TraceEntry[] = [];
      // Detect rapid mount→unmount→mount cycles (remounts within 5s)
      for (let i = 0; i < mounts.length - 1; i++) {
        const m1 = mounts[i];
        const m2 = mounts[i + 1];
        if (m1.ts && m2.ts && (m2.ts - m1.ts < 5000)) {
          const unmount = unmounts.find(
            (u) => u.details?.component === m1.details?.component && u.ts > m1.ts && u.ts < m2.ts
          );
          suspicious.push({
            ...m1,
            label: "COMPONENT_REMOUNT_RESET",
            details: {
              ...m1.details,
              previousMountAt: m1.ts,
              nextMountAt: m2.ts,
              deltaMs: m2.ts - m1.ts,
              unmountFound: !!unmount,
            },
          });
        }
      }
      return suspicious.length > 0 ? suspicious : [{ seq: 0, ts: Date.now(), type: "REMOUNT", label: "NO_SUSPICIOUS_REMOUNTS", details: { totalMounts: mounts.length, totalUnmounts: unmounts.length } }];
    },

    // Summary
    dumpEverything: () => ({
      messageLifecycle: messageLifecycleBuffer.slice(),
      renderSkips: renderSkipBuffer.slice(),
      authorityTimeline: authorityTimelineBuffer.slice(),
      audioFailures: audioFailureBuffer.slice(),
      realtimeLatency: realtimeLatencyBuffer.slice(),
      remounts: remountBuffer.slice(),
      finalOwners: {
        lastOwner: _lastOwner,
        lastRealtimeOwner: _lastRealtimeOwner,
        lastApiOwner: _lastApiOwner,
      },
    }),

    clear: () => {
      messageLifecycleBuffer.length = 0;
      renderSkipBuffer.length = 0;
      authorityTimelineBuffer.length = 0;
      audioFailureBuffer.length = 0;
      realtimeLatencyBuffer.length = 0;
      remountBuffer.length = 0;
      _lastOwner = "none";
      _lastRealtimeOwner = "none";
      _lastApiOwner = "none";
      _lastStateTimestamp = 0;
      _lastRealtimeArrivalAt = 0;
      if (process.env.NODE_ENV === "development") console.log("[RT_FORENSICS] Cleared forensic buffers");
    },
  };
  rtLog("Forensics API: window.__REALTIME_FORENSICS");
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
    listenerBinds: () => listenerBindCount,
    reconnectBinds: () => reconnectBindCount,
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
      (window as any).__REALTIME_DEBUG.poolSnapshot = undefined;
      listenerBindCount = 0;
      reconnectBindCount = 0;
      notifRefreshCount = 0;
      notifSkippedCount = 0;
      notifDedupHits = 0;
      notifReconnectCount = 0;
      notifLastRefreshAt = 0;
    },
  };
  rtLog("Debug API: window.__REALTIME_DEBUG");
}

// ==================== AUTONOMOUS ROOT-CAUSE ANALYZER ====================

interface AnalyzerVerdict {
  rootCause: string;
  confidence: number;
  responsibleMutation: Record<string, unknown>;
  authorityWinner: string;
  destroyedMessages: string[];
  audioFailureCause: string;
  realtimeOverwritten: boolean;
  renderCorruption: boolean;
  remountDetected: boolean;
  evidenceChain: string[];
  scores: Record<string, number>;
}

// ==================== 1. Message Disappearance Analyzer ====================
function analyzeMessageDisappearances() {
  const removed: TraceEntry[] = messageLifecycleBuffer.filter(e => e.label === "MESSAGE_REMOVED_FROM_STATE");
  const entered: TraceEntry[] = messageLifecycleBuffer.filter(e => e.label === "MESSAGE_ENTERED_STATE");
  const rendered: TraceEntry[] = messageLifecycleBuffer.filter(e => e.label === "MESSAGE_RENDERED");

  const result: Array<{
    msgId: string;
    enteredAt: number;
    removedAt: number;
    enteredBy: string;
    removedBy: string;
    previousOwner: string;
    finalOwner: string;
    renderedBeforeRemoval: boolean;
    suspectedCause: string;
    confidence: number;
  }> = [];

  for (const rem of removed) {
    const details = rem.details as any;
    const msgId = details?.msgId;
    if (!msgId) continue;

    const enterEvent = entered.find(e => (e.details as any)?.msgId === msgId);
    const renderEvents = rendered.filter(e => (e.details as any)?.msgId === msgId);
    const renderedBefore = renderEvents.some(r => r.ts < rem.ts);

    let cause = "UNKNOWN";
    let confidence = 50;

    const source = details?.source || "";
    const label = details?.label || "";

    if (source.startsWith("API") || label === "LOAD_MESSAGES_API") {
      cause = "API_OVERWRITE";
      confidence = details?.isStale ? 95 : 75;
    } else if (source === "REALTIME" && label === "MESSAGE_DELETE") {
      cause = "REALTIME_OVERWRITE";
      confidence = 100;
    } else if (label === "CONVERSATION_SWITCH") {
      cause = "REMOUNT_RESET";
      confidence = 60;
    } else if (source === "CLIENT" && label === "CONVERSATION_SWITCH") {
      cause = "REMOUNT_RESET";
      confidence = 70;
    }

    // If the message was entered by realtime but removed by API → classic stale overwrite
    if (enterEvent) {
      const enterSource = (enterEvent.details as any)?.source || "";
      if (enterSource.startsWith("REALTIME") && source.startsWith("API")) {
        cause = "API_OVERWRITE";
        confidence = Math.max(confidence, 90);
      }
    }

    result.push({
      msgId,
      enteredAt: enterEvent?.ts || 0,
      removedAt: rem.ts,
      enteredBy: (enterEvent?.details as any)?.source || "unknown",
      removedBy: source,
      previousOwner: (enterEvent?.details as any)?.label || "unknown",
      finalOwner: label || "unknown",
      renderedBeforeRemoval: renderedBefore,
      suspectedCause: cause,
      confidence,
    });
  }

  return result;
}

// ==================== 2. API vs Realtime Conflict Analyzer ====================
function analyzeApiConflicts() {
  const results: Array<{
    requestId: number;
    requestTs: number;
    responseTs: number;
    staleByMs: number;
    realtimeMutationTs: number | null;
    overwrittenMessages: string[];
    authorityWinner: string;
    conflictSeverity: string;
  }> = [];

  const staleEntries = asyncOrderBuffer.filter(
    e => e.type === "API_RESPONSE" && (e.details as any)?.isStale === true
  );

  for (const entry of staleEntries) {
    const d = entry.details as any;
    const requestTs = d?.requestTimestamp || 0;
    const responseTs = d?.responseTimestamp || 0;
    const realtimeTs = d?.latestRealtimeTimestamp || null;
    const seqId = d?.seqId || 0;

    // Find messages removed around this time
    const nearbyRemovals = messageLifecycleBuffer.filter(
      e => e.label === "MESSAGE_REMOVED_FROM_STATE" &&
        e.ts >= requestTs && e.ts <= responseTs + 1000
    );
    const removedIds = nearbyRemovals.map(e => (e.details as any)?.msgId).filter(Boolean);

    results.push({
      requestId: seqId,
      requestTs,
      responseTs,
      staleByMs: realtimeTs ? responseTs - realtimeTs : -1,
      realtimeMutationTs: realtimeTs,
      overwrittenMessages: removedIds,
      authorityWinner: "API",
      conflictSeverity: removedIds.length > 0 ? "CRITICAL_STALE_OVERWRITE" : "SAFE_RESPONSE",
    });
  }

  // Also check non-stale conflicts (API arrived, realtime arrived during request)
  const allApi = asyncOrderBuffer.filter(e => e.type === "API_RESPONSE");
  for (const entry of allApi) {
    const d = entry.details as any;
    if (d?.isStale) continue; // already handled
    const requestTs = d?.requestTimestamp || 0;
    const responseTs = d?.responseTimestamp || 0;

    // Check if realtime events happened during the API request window
    const realtimeDuring = realtimeEventLog.filter(
      e => e.ts > requestTs && e.ts < responseTs
    );
    if (realtimeDuring.length > 0) {
      const overwrittenIds: string[] = [];
      for (const rtEvt of realtimeDuring) {
        const rtPayloadId = (rtEvt.details as any)?.payloadId;
        const removedLater = messageLifecycleBuffer.find(
          e => e.label === "MESSAGE_REMOVED_FROM_STATE" &&
            (e.details as any)?.msgId === rtPayloadId &&
            e.ts > rtEvt.ts && e.ts < responseTs + 100
        );
        if (removedLater) overwrittenIds.push(rtPayloadId);
      }
      if (overwrittenIds.length > 0) {
        results.push({
          requestId: d?.seqId || 0,
          requestTs,
          responseTs,
          staleByMs: -1,
          realtimeMutationTs: realtimeDuring[0]?.ts || null,
          overwrittenMessages: overwrittenIds,
          authorityWinner: "API",
          conflictSeverity: "AUTHORITY_CONFLICT",
        });
      }
    }
  }

  return results;
}

// ==================== 3. Render Rejection Analyzer ====================
function analyzeRenderFailures() {
  const results: Array<{
    msgId: string;
    statePresent: boolean;
    rendered: boolean;
    rejectionReason: string;
    renderOwner: string;
    confidence: number;
  }> = [];

  const renderSkips = renderSkipBuffer.slice();
  for (const skip of renderSkips) {
    const d = skip.details as any;
    const skippedIds: string[] = d?.skippedIds || [];
    const reason = d?.reason || "UNKNOWN_RENDER_FAILURE";

    for (const msgId of skippedIds) {
      // Check if this message was in state
      const inState = messageLifecycleBuffer.some(
        e => (e.details as any)?.msgId === msgId && e.label === "MESSAGE_ENTERED_STATE"
      );
      const rendered = messageLifecycleBuffer.some(
        e => (e.details as any)?.msgId === msgId && e.label === "MESSAGE_RENDERED"
      );

      let classification = reason;
      let confidence = 80;
      if (reason === "SEARCH_FILTER") {
        classification = "SEARCH_FILTER";
        confidence = 100;
      } else if (reason === "UNKNOWN_SKIP") {
        classification = "UNKNOWN_RENDER_FAILURE";
        confidence = 60;
      }

      results.push({
        msgId,
        statePresent: inState,
        rendered,
        rejectionReason: classification,
        renderOwner: d?.selectedUserId || "unknown",
        confidence,
      });
    }
  }

  return results;
}

// ==================== 4. Audio Failure Analyzer ====================
function analyzeAudioFailures() {
  const failureEntries = audioFailureBuffer.slice();
  const result: Array<{
    notificationId: string;
    rejectionReason: string;
    visibilityState: string;
    activeTab: boolean;
    pathname: string;
    browserAllowed: boolean;
    finalVerdict: string;
    confidence: number;
  }> = [];

  // Check if there's any AUDIO_PLAY_CONFIRMED - if so, audio worked at least once
  const anySuccess = audioTraceBuffer.some(e => e.label === "AUDIO_PLAY_CONFIRMED" || e.label === "AUDIO_PLAY_SUCCESS");

  for (const entry of failureEntries) {
    if (entry.label === "AUDIO_PLAY_CONFIRMED" || entry.label === "AUDIO_ALLOWED") continue;
    const d = entry.details as any;
    const rejectionReason = d?.rejectionReason || "unknown";
    const notificationId = d?.payloadId || "unknown";

    let finalVerdict = "UNKNOWN_AUDIO_FAILURE";
    let confidence = 70;

    if (rejectionReason.includes("visibility") || rejectionReason === "hidden") {
      finalVerdict = "VISIBILITY_HIDDEN";
      confidence = 95;
    } else if (rejectionReason === "unauthorized" || rejectionReason === "inactive_tab") {
      finalVerdict = anySuccess ? "TAB_INACTIVE" : "AUTHORITY_BLOCK";
      confidence = 85;
    } else if (rejectionReason === "throttle") {
      finalVerdict = "THROTTLED";
      confidence = 100;
    } else if (rejectionReason === "unmounted") {
      finalVerdict = "COMPONENT_UNMOUNTED";
      confidence = 100;
    } else if (rejectionReason === "route_chat") {
      finalVerdict = "ROUTE_BLOCK";
      confidence = 100;
    } else if (rejectionReason === "promise_rejected") {
      finalVerdict = "PROMISE_REJECTION";
      confidence = 80;
    } else if (rejectionReason === "exception") {
      finalVerdict = "BROWSER_POLICY";
      confidence = 70;
    } else if (rejectionReason === "duplicate") {
      finalVerdict = "DUPLICATE_SUPPRESSED";
      confidence = 100;
    }

    result.push({
      notificationId,
      rejectionReason,
      visibilityState: d?.visibilityState || "unknown",
      activeTab: d?.isActiveTab === true,
      pathname: d?.pathname || "unknown",
      browserAllowed: anySuccess,
      finalVerdict,
      confidence,
    });
  }

  // If no failures but audio events exist, check trace audit buffer
  if (result.length === 0) {
    const audioEvents = audioTraceBuffer.filter(
      e => e.label.startsWith("AUDIO_SKIPPED_") || e.label.startsWith("AUDIO_BLOCKED_")
    );
    for (const ae of audioEvents) {
      const d = ae.details as any;
      result.push({
        notificationId: d?.payloadId || "unknown",
        rejectionReason: ae.label,
        visibilityState: d?.visibilityState || "unknown",
        activeTab: false,
        pathname: d?.pathname || "unknown",
        browserAllowed: anySuccess,
        finalVerdict: ae.label.replace("AUDIO_", ""),
        confidence: 90,
      });
    }
  }

  return result;
}

// ==================== 5. Authority Analyzer ====================
function analyzeAuthority() {
  const mutations = mutationBuffer.slice();
  const rtMutations = mutations.filter(m => (m.details as any)?.source?.startsWith("REALTIME"));
  const apiMutations = mutations.filter(m => (m.details as any)?.source?.startsWith("API") || (m.details as any)?.source?.startsWith("LOAD"));
  const clientMutations = mutations.filter(m => (m.details as any)?.source === "CLIENT");

  const lastMutation = mutations[0]; // newest first
  const lastRt = rtMutations[0];
  const lastApi = apiMutations[0];
  const lastClient = clientMutations[0];

  let authorityConflict = false;
  let authorityWinner = "none";
  let evidenceLevel = 0;

  if (lastMutation) {
    const lastSource = (lastMutation.details as any)?.source || "";
    if (lastSource.startsWith("API") || lastSource.startsWith("LOAD")) {
      authorityWinner = "API";
      // If realtime happened after API request but before API response → conflict
      if (lastRt && lastApi && lastRt.ts > lastApi.ts) {
        authorityConflict = true;
        evidenceLevel = 8;
      }
    } else if (lastSource.startsWith("REALTIME")) {
      authorityWinner = "REALTIME";
    } else if (lastSource === "CLIENT") {
      authorityWinner = "CLIENT";
    }
  }

  // Check timeline for alternation
  const timeline: string[] = [];
  for (const m of mutations.slice(0, 20)) { // last 20
    const source = (m.details as any)?.source || "";
    const label = m.label;
    timeline.push(`${source}/${label}`);
  }

  // Detect alternation pattern (API → REALTIME → API)
  const sourcePattern = timeline.map(s => s.split("/")[0]);
  let alternations = 0;
  for (let i = 1; i < sourcePattern.length; i++) {
    if (sourcePattern[i] !== sourcePattern[i-1] &&
        (sourcePattern[i].startsWith("API") && sourcePattern[i-1].startsWith("REALTIME")) ||
        (sourcePattern[i].startsWith("REALTIME") && sourcePattern[i-1].startsWith("API"))) {
      alternations++;
    }
  }
  if (alternations >= 2) {
    authorityConflict = true;
    evidenceLevel = Math.max(evidenceLevel, 7);
  }

  return {
    finalMessageAuthority: _lastOwner,
    finalConversationAuthority: _lastOwner,
    lastRealtimeOwner: _lastRealtimeOwner,
    lastApiOwner: _lastApiOwner,
    lastClientOwner: lastClient ? (lastClient.details as any)?.source || "none" : "none",
    authorityConflictDetected: authorityConflict,
    authorityWinner,
    authorityConflictLevel: evidenceLevel,
    alternationCount: alternations,
    authorityTimeline: timeline.slice(0, 10),
  };
}

// ==================== 6. Remount/Hydration Analyzer ====================
function analyzeRemounts() {
  const mounts = lifecycleBuffer.filter(e => e.label.endsWith("_MOUNT"));
  const unmounts = lifecycleBuffer.filter(e => e.label.endsWith("_UNMOUNT"));

  const results: Array<{
    component: string;
    classification: string;
    mountTs: number;
    unmountTs: number | null;
    deltaMs: number;
    stateDestroyed: boolean;
    confidence: number;
  }> = [];

  // Detect mount → unmount → mount chains within 5s
  for (let i = 0; i < mounts.length - 1; i++) {
    const m1 = mounts[i];
    const m2 = mounts[i + 1];
    const deltaMs = m2.ts - m1.ts;

    if (deltaMs < 5000) {
      const component1 = m1.label.replace("_MOUNT", "");
      const component2 = m2.label.replace("_MOUNT", "");

      if (component1 !== component2) continue; // different components

      const unmount = unmounts.find(
        u => u.label.replace("_UNMOUNT", "") === component1 &&
          u.ts > m1.ts && u.ts < m2.ts
      );

      // Check if messages were cleared after remount
      const stateCleared = mutationBuffer.some(
        m => m.label === "CONVERSATION_SWITCH" && m.ts > m1.ts && m.ts < m2.ts + 500
      );

      results.push({
        component: component1,
        classification: unmount ? "STATE_DESTRUCTIVE_REMOUNT" : "SAFE_REMOUNT",
        mountTs: m1.ts,
        unmountTs: unmount?.ts || null,
        deltaMs,
        stateDestroyed: stateCleared,
        confidence: unmount ? 90 : 50,
      });
    }
  }

  // Detect hydration: mount followed by API load within 100ms
  for (const mount of mounts) {
    const apiLoad = mutationBuffer.find(
      m => (m.label === "LOAD_MESSAGES_API" || m.label === "LOAD_CONVERSATIONS") &&
        m.ts > mount.ts && m.ts < mount.ts + 100
    );
    if (apiLoad) {
      const comp = mount.label.replace("_MOUNT", "");
      // Check if realtime event arrived before this mount
      const rtBefore = realtimeEventLog.some(e => e.ts > mount.ts - 2000 && e.ts < mount.ts);
      results.push({
        component: comp,
        classification: rtBefore ? "HYDRATION_OVERRIDE" : "SAFE_REMOUNT",
        mountTs: mount.ts,
        unmountTs: null,
        deltaMs: apiLoad.ts - mount.ts,
        stateDestroyed: true,
        confidence: rtBefore ? 85 : 40,
      });
    }
  }

  return results;
}

// ==================== 7. Realtime Latency Analyzer ====================
function analyzeLatency() {
  const latencyEntries = realtimeLatencyBuffer.slice();
  const results: Array<{
    eventType: string;
    realtimeArrivalTs: number;
    handlerExecutionTs: number;
    mutationTs: number;
    renderTs: number;
    totalLatency: number;
    suspiciousDelay: boolean;
    flag: string;
  }> = [];

  const eventGroups = new Map<string, TraceEntry[]>();
  for (const entry of latencyEntries) {
    const payloadId = (entry.details as any)?.payloadId || "unknown";
    if (!eventGroups.has(payloadId)) eventGroups.set(payloadId, []);
    eventGroups.get(payloadId)!.push(entry);
  }

  for (const [, group] of eventGroups) {
    const handlerStage = group.find(e => (e.details as any)?.stage === "handler_executed");
    const mutationStage = group.find(e => (e.details as any)?.stage === "state_mutated");
    const renderStage = group.find(e => (e.details as any)?.stage === "render_completed");

    if (!handlerStage) continue;

    const d = handlerStage.details as any;
    const arrivalTs = d?.arrivalTimestamp || handlerStage.ts;
    const handlerTs = d?.handlerExecutionTimestamp || handlerStage.ts;
    const mutationTs = mutationStage ? (mutationStage.details as any)?.stateMutationTimestamp || mutationStage.ts : 0;
    const renderTs = renderStage ? (renderStage.details as any)?.renderTimestamp || renderStage.ts : 0;

    const handlerLatency = handlerTs - arrivalTs;
    const mutationLatency = mutationTs > 0 ? mutationTs - handlerTs : -1;
    const renderLatency = renderTs > 0 ? renderTs - mutationTs : -1;
    const totalLatency = renderTs > 0 ? renderTs - arrivalTs : (mutationTs > 0 ? mutationTs - arrivalTs : handlerLatency);

    let flag = "LATENCY_SAFE";
    let suspicious = false;
    if (handlerLatency > 500) {
      flag = "LATENCY_SUSPICIOUS";
      suspicious = true;
    }
    // If handler→mutation takes > 1000ms, API could have snuck in
    if (mutationLatency > 1000) {
      flag = "LATENCY_CAUSED_OVERWRITE";
      suspicious = true;
    }

    results.push({
      eventType: handlerStage.label,
      realtimeArrivalTs: arrivalTs,
      handlerExecutionTs: handlerTs,
      mutationTs,
      renderTs,
      totalLatency,
      suspiciousDelay: suspicious,
      flag,
    });
  }

  return results;
}

// ==================== Final Verdict Engine ====================
function computeFinalVerdict() {
  const msgDisappearances = analyzeMessageDisappearances();
  const apiConflicts = analyzeApiConflicts();
  const renderFailures = analyzeRenderFailures();
  const audioFailures = analyzeAudioFailures();
  const authorityResult = analyzeAuthority();
  const remountResults = analyzeRemounts();
  const latencyResults = analyzeLatency();

  const scores: Record<string, number> = {
    "stale API overwrite": 0,
    "render-layer rejection": 0,
    "reconciliation corruption": 0,
    "remount reset": 0,
    "authority corruption": 0,
    "audio authority corruption": 0,
    "hydration overwrite": 0,
    "latency corruption": 0,
    "unknown": 5,
  };

  const evidence: string[] = [];
  const destroyedMessages: string[] = [];

  // --- Evidence: Stale API overwrite ---
  const staleConflicts = apiConflicts.filter(c => c.conflictSeverity === "CRITICAL_STALE_OVERWRITE" || c.conflictSeverity === "AUTHORITY_CONFLICT");
  if (staleConflicts.length > 0) {
    const severity = staleConflicts.length;
    const msgsLost = staleConflicts.reduce((acc, c) => acc + c.overwrittenMessages.length, 0);
    scores["stale API overwrite"] = Math.min(95, 30 + severity * 20 + msgsLost * 10);
    evidence.push(`Found ${staleConflicts.length} stale API responses overwriting realtime mutations`);
    if (msgsLost > 0) {
      evidence.push(`${msgsLost} message(s) lost due to stale API overwrite`);
      for (const c of staleConflicts) {
        destroyedMessages.push(...c.overwrittenMessages);
      }
    }
  }

  // --- Evidence: API vs Realtime authority ---
  if (authorityResult.authorityConflictDetected && authorityResult.authorityWinner === "API") {
    scores["stale API overwrite"] = Math.max(scores["stale API overwrite"], 70);
    scores["authority corruption"] = Math.max(scores["authority corruption"], 50 + authorityResult.authorityConflictLevel * 3);
    evidence.push(`Authority conflict: ${authorityResult.alternationCount} alternations between API and Realtime`);
    evidence.push(`Final authority: ${authorityResult.authorityWinner}`);
  }

  // --- Evidence: Render rejection ---
  const unknownSkips = renderFailures.filter(r => r.rejectionReason === "UNKNOWN_RENDER_FAILURE");
  if (unknownSkips.length > 0) {
    scores["render-layer rejection"] = Math.min(95, 40 + unknownSkips.length * 15);
    evidence.push(`${unknownSkips.length} message(s) in state but not rendered (unknown reason)`);
    for (const r of unknownSkips) {
      evidence.push(`  Message ${r.msgId}: inState=${r.statePresent}, rendered=${r.rendered}`);
    }
  }

  // --- Evidence: Audio failure ---
  const audioFailClasses = new Set(audioFailures.map(a => a.finalVerdict));
  if (audioFailClasses.has("PROMISE_REJECTION") || audioFailClasses.has("BROWSER_POLICY")) {
    scores["audio authority corruption"] = Math.max(scores["audio authority corruption"], 80);
    evidence.push(`Audio promise rejected by browser policy`);
  }
  if (audioFailClasses.has("AUTHORITY_BLOCK")) {
    scores["audio authority corruption"] = Math.max(scores["audio authority corruption"], 70);
    evidence.push(`Audio blocked by tab authority check despite visible tab`);
  }
  if (audioFailClasses.has("VISIBILITY_HIDDEN")) {
    // This is expected behavior, not a bug
    evidence.push(`Audio skipped due to hidden tab (expected)`);
  }
  if (audioFailClasses.has("THROTTLED")) {
    evidence.push(`Audio throttled (multiple rapid notifications)`);
  }
  if (audioFailures.length > 0 && !audioFailClasses.has("PROMISE_REJECTION") && !audioFailClasses.has("AUTHORITY_BLOCK") && !audioFailClasses.has("BROWSER_POLICY")) {
    // Audio was skipped for expected reasons, not a real bug
  }

  // --- Evidence: Remount ---
  const destructiveRemounts = remountResults.filter(r => r.classification === "STATE_DESTRUCTIVE_REMOUNT");
  if (destructiveRemounts.length > 0) {
    scores["remount reset"] = Math.max(scores["remount reset"], 40 + destructiveRemounts.length * 20);
    evidence.push(`${destructiveRemounts.length} destructive remount(s) detected`);
    for (const r of destructiveRemounts) {
      evidence.push(`  ${r.component}: remount in ${r.deltaMs}ms, state destroyed=${r.stateDestroyed}`);
    }
  }

  // --- Evidence: Hydration ---
  const hydrationOverrides = remountResults.filter(r => r.classification === "HYDRATION_OVERRIDE");
  if (hydrationOverrides.length > 0) {
    scores["hydration overwrite"] = Math.max(scores["hydration overwrite"], 40 + hydrationOverrides.length * 20);
    evidence.push(`${hydrationOverrides.length} hydration override(s) detected`);
  }

  // --- Evidence: Latency ---
  const latencyOverwrites = latencyResults.filter(r => r.flag === "LATENCY_CAUSED_OVERWRITE");
  if (latencyOverwrites.length > 0) {
    scores["latency corruption"] = Math.max(scores["latency corruption"], 60 + latencyOverwrites.length * 10);
    evidence.push(`${latencyOverwrites.length} high-latency realtime handler(s) allowed API overwrite`);
  }

  // --- Evidence: Reconciliation ---
  const tempsCreated = tempMessageLog.filter(e => e.label === "TEMP_CREATED");
  const tempsReplaced = tempMessageLog.filter(e => e.label.startsWith("TEMP_REPLACED"));
  if (tempsCreated.length > tempsReplaced.length) {
    const orphaned = tempsCreated.length - tempsReplaced.length;
    scores["reconciliation corruption"] = Math.min(95, 50 + orphaned * 15);
    evidence.push(`${orphaned} temp message(s) were never replaced (reconciliation failure)`);
  }

  // --- Pick winner ---
  let rootCause = "unknown";
  let maxScore = 0;
  for (const [cause, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      rootCause = cause;
    }
  }

  // Confidence is just the max score
  const confidence = Math.round(maxScore);

  // Determine the responsible mutation
  let responsibleMutation: Record<string, unknown> = {};
  if (rootCause === "stale API overwrite" && staleConflicts.length > 0) {
    const worst = staleConflicts.reduce((a, b) => a.overwrittenMessages.length > b.overwrittenMessages.length ? a : b);
    responsibleMutation = {
      type: "API_RESPONSE",
      requestId: worst.requestId,
      requestTs: worst.requestTs,
      responseTs: worst.responseTs,
      overwrittenCount: worst.overwrittenMessages.length,
    };
  } else if (rootCause === "remount reset" && destructiveRemounts.length > 0) {
    responsibleMutation = {
      type: "REMOUNT",
      component: destructiveRemounts[0].component,
      deltaMs: destructiveRemounts[0].deltaMs,
    };
  } else if (rootCause === "render-layer rejection" && unknownSkips.length > 0) {
    responsibleMutation = {
      type: "RENDER_SKIP",
      skippedCount: unknownSkips.length,
      firstSkipped: unknownSkips[0].msgId,
    };
  }

  // Audio failure cause
  const primaryAudioFailure = audioFailures.length > 0
    ? audioFailures.reduce((a, b) => a.confidence > b.confidence ? a : b)
    : null;

  const verdict: AnalyzerVerdict = {
    rootCause,
    confidence,
    responsibleMutation,
    authorityWinner: authorityResult.authorityWinner,
    destroyedMessages: [...new Set(destroyedMessages)],
    audioFailureCause: primaryAudioFailure?.finalVerdict || "none",
    realtimeOverwritten: staleConflicts.length > 0,
    renderCorruption: unknownSkips.length > 0,
    remountDetected: destructiveRemounts.length > 0,
    evidenceChain: evidence,
    scores,
  };

  return verdict;
}

// ==================== WINDOW ANALYZER API ====================
if (typeof window !== "undefined" && isDev) {
  (window as any).__REALTIME_ANALYZER = {
    analyzeMessages: () => analyzeMessageDisappearances(),
    analyzeApiConflicts: () => analyzeApiConflicts(),
    analyzeRenderFailures: () => analyzeRenderFailures(),
    analyzeAudioFailures: () => analyzeAudioFailures(),
    analyzeAuthority: () => analyzeAuthority(),
    analyzeRemounts: () => analyzeRemounts(),
    analyzeLatency: () => analyzeLatency(),
    analyzeEverything: () => {
      if (!isDev) return { error: "Not in dev mode" };
      const verdict = computeFinalVerdict();
      const output = [
        "========================",
        "FINAL ROOT CAUSE",
        "========================",
        "",
        "Root Cause:            " + verdict.rootCause,
        "Confidence:            " + verdict.confidence + "%",
        "Responsible Mutation:  " + JSON.stringify(verdict.responsibleMutation),
        "Authority Winner:      " + verdict.authorityWinner,
        "Destroyed Messages:    " + (verdict.destroyedMessages.length > 0 ? verdict.destroyedMessages.join(", ") : "none detected"),
        "Audio Failure Cause:   " + verdict.audioFailureCause,
        "Realtime Overwritten:  " + (verdict.realtimeOverwritten ? "YES" : "NO"),
        "Render Corruption:     " + (verdict.renderCorruption ? "YES" : "NO"),
        "Remount Detected:      " + (verdict.remountDetected ? "YES" : "NO"),
        "",
        "========================",
        "EVIDENCE CHAIN",
        "========================",
      ];
      for (const ev of verdict.evidenceChain) {
        output.push("  " + ev);
      }
      output.push("");
      output.push("========================");
      output.push("CAUSE SCORES");
      output.push("========================");
      for (const [cause, score] of Object.entries(verdict.scores).sort((a, b) => b[1] - a[1])) {
        const marker = cause === verdict.rootCause ? " <<<" : "";
        output.push("  " + cause + ": " + score + "%" + marker);
      }
      console.log(output.join("\n"));
      return verdict;
    },
    getFinalVerdict: () => computeFinalVerdict(),
    getEvidenceChain: () => computeFinalVerdict().evidenceChain,
    getResponsibleMutation: () => computeFinalVerdict().responsibleMutation,
    getAuthorityWinner: () => computeFinalVerdict().authorityWinner,
  };

  (window as any).__PRESENCE_DEBUG = {
    trace: () => presenceTraceBuffer.slice(),
    typingTrace: () => typingTraceBuffer.slice(),
    presenceCount: () => presenceTraceBuffer.length,
    typingCount: () => typingTraceBuffer.length,
  };

  // Add presence/typing health to analyzer
  (window as any).__REALTIME_ANALYZER.analyzePresenceHealth = () => {
    const entries = presenceTraceBuffer.slice();
    const issues: string[] = [];
    // Check for dead subscriptions
    const channelErrors = entries.filter(e => e.label === "PRESENCE_CHANNEL_ERROR" || e.label === "PRESENCE_CLOSED" || e.label === "PRESENCE_TIMED_OUT");
    if (channelErrors.length > 0) {
      issues.push(`${channelErrors.length} presence channel error(s) detected`);
    }
    // Check for "no active tab" pattern
    const standbyCount = entries.filter(e => e.label === "PRESENCE_STANDBY").length;
    const activeCount = entries.filter(e => e.label === "PRESENCE_ACTIVE").length;
    if (standbyCount > activeCount && activeCount === 0) {
      issues.push("No tab has claimed active presence role");
    }
    // Check for missing track after subscribe
    const subscribeEntries = entries.filter(e => e.label === "PRESENCE_SUBSCRIBED");
    const trackEntries = entries.filter(e => e.label === "PRESENCE_TRACKED");
    for (const sub of subscribeEntries) {
      const trackedSoonAfter = trackEntries.some(t => Math.abs(t.ts - sub.ts) < 5000);
      if (!trackedSoonAfter) {
        issues.push("Presence subscribed but no track() call within 5s");
        break;
      }
    }
    return {
      healthy: issues.length === 0,
      issues,
      totalPresenceEvents: entries.length,
      channelErrors: channelErrors.length,
      lastEvent: entries[0] || null,
    };
  };

  (window as any).__REALTIME_ANALYZER.analyzeTypingHealth = () => {
    const entries = typingTraceBuffer.slice();
    const issues: string[] = [];
    // Check for typing_start without typing_stop (stuck state)
    const starts = entries.filter(e => e.label === "TYPING_START");
    const stops = entries.filter(e => e.label === "TYPING_STOP");
    if (starts.length > stops.length + 1) {
      issues.push(`${starts.length - stops.length} typing indicator(s) may be stuck (start without stop)`);
    }
    // Check for stale typing (last event was a start more than 10s ago)
    if (entries.length > 0 && entries[0].label === "TYPING_START") {
      if (Date.now() - entries[0].ts > 10000) {
        issues.push("Stale typing indicator: last event was TYPING_START >10s ago");
      }
    }
    return {
      healthy: issues.length === 0,
      issues,
      totalTypingEvents: entries.length,
      stuckCount: Math.max(0, starts.length - stops.length),
      lastEvent: entries[0] || null,
    };
  };

  rtLog("Analyzer API: window.__REALTIME_ANALYZER");
  rtLog("Presence Debug API: window.__PRESENCE_DEBUG");
}
