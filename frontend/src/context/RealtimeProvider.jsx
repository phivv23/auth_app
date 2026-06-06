import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "./useAuth.js";
import { RealtimeContext } from "./realtimeContext.js";
import {
  connectRealtimeStream,
  subscribeRealtimeListener,
} from "./realtimeConnection.js";

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const listenersRef = useRef(new Map());
  const [connectionStatus, setConnectionStatus] = useState("idle");

  const subscribe = useCallback((streamName, eventName, handler) => {
    return subscribeRealtimeListener(
      listenersRef.current,
      streamName,
      eventName,
      handler
    );
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const connection = connectRealtimeStream(listenersRef.current, {
      onStatusChange: setConnectionStatus,
    });

    return () => {
      connection.close();
    };
  }, [user]);

  const effectiveConnectionStatus = user ? connectionStatus : "idle";
  const value = useMemo(
    () => ({
      connectionStatus: effectiveConnectionStatus,
      subscribe,
    }),
    [effectiveConnectionStatus, subscribe]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
