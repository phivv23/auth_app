import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAuth } from "./useAuth.js";
import { RealtimeContext } from "./realtimeContext.js";
import {
  connectRealtimeStream,
  subscribeRealtimeListener,
} from "./realtimeConnection.js";

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const listenersRef = useRef(new Map());

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

    const connection = connectRealtimeStream(listenersRef.current);

    return () => {
      connection.close();
    };
  }, [user]);

  const value = useMemo(
    () => ({
      subscribe,
    }),
    [subscribe]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
