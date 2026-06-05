import { useCallback, useEffect, useMemo, useRef } from "react";

import { getMessageStreamUrl } from "../api/message.api.js";
import { getNotificationStreamUrl } from "../api/notification.api.js";
import { connectReconnectingEventSource } from "../utils/reconnectingEventSource.js";
import { useAuth } from "./useAuth.js";
import { RealtimeContext } from "./realtimeContext.js";

const STREAM_CONFIG = {
  messages: {
    getUrl: getMessageStreamUrl,
    events: ["message", "messageUpdate", "typing", "read", "reaction", "presence"],
  },
  notifications: {
    getUrl: getNotificationStreamUrl,
    events: ["notification"],
  },
};

function getListenerSet(registry, streamName, eventName) {
  const key = `${streamName}:${eventName}`;

  if (!registry.has(key)) {
    registry.set(key, new Set());
  }

  return registry.get(key);
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const listenersRef = useRef(new Map());

  const subscribe = useCallback((streamName, eventName, handler) => {
    const stream = STREAM_CONFIG[streamName];

    if (!stream || !stream.events.includes(eventName)) {
      return () => {};
    }

    const listeners = getListenerSet(listenersRef.current, streamName, eventName);
    listeners.add(handler);

    return () => {
      listeners.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const connections = Object.entries(STREAM_CONFIG).map(
      ([streamName, stream]) => {
        const streamListeners = Object.fromEntries(
          stream.events.map((eventName) => [
            eventName,
            (event) => {
              const listeners = getListenerSet(
                listenersRef.current,
                streamName,
                eventName
              );

              for (const listener of listeners) {
                listener(event);
              }
            },
          ])
        );

        return connectReconnectingEventSource(stream.getUrl(), {
          listeners: streamListeners,
        });
      }
    );

    return () => {
      for (const connection of connections) {
        connection.close();
      }
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
