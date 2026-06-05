import { useContext, useEffect, useRef } from "react";

import { RealtimeContext } from "./realtimeContext.js";

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function useRealtimeSubscription(
  streamName,
  eventName,
  handler,
  { enabled = true } = {}
) {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return subscribe(streamName, eventName, (event) => {
      handlerRef.current?.(event);
    });
  }, [enabled, eventName, streamName, subscribe]);
}
