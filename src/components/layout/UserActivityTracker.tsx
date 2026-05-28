"use client";

import { useEffect } from "react";

export default function UserActivityTracker() {
  useEffect(() => {
    const ping = () => {
      try {
        navigator.sendBeacon("/api/user/ping", JSON.stringify({}));
      } catch {
        // silent — best-effort
      }
    };

    ping();

    window.addEventListener("beforeunload", ping);
    window.addEventListener("pagehide", ping);

    return () => {
      window.removeEventListener("beforeunload", ping);
      window.removeEventListener("pagehide", ping);
    };
  }, []);

  return null;
}
