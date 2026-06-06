import { getRealtimeStreamUrl } from "../api/realtime.api.js";
import { connectReconnectingEventSource } from "../utils/reconnectingEventSource.js";

export const REALTIME_STREAM_CONFIG = {
  messages: [
    "message",
    "messageUpdate",
    "typing",
    "read",
    "reaction",
    "presence",
  ],
  notifications: ["notification"],
};

export function getListenerSet(registry, streamName, eventName) {
  const key = `${streamName}:${eventName}`;

  if (!registry.has(key)) {
    registry.set(key, new Set());
  }

  return registry.get(key);
}

export function subscribeRealtimeListener(
  registry,
  streamName,
  eventName,
  handler
) {
  const streamEvents = REALTIME_STREAM_CONFIG[streamName];

  if (!streamEvents || !streamEvents.includes(eventName)) {
    return () => {};
  }

  const listeners = getListenerSet(registry, streamName, eventName);
  listeners.add(handler);

  return () => {
    listeners.delete(handler);
  };
}

export function createRealtimeEventListeners(registry) {
  const listeners = {};

  for (const [streamName, eventNames] of Object.entries(REALTIME_STREAM_CONFIG)) {
    for (const eventName of eventNames) {
      listeners[eventName] = (event) => {
        const eventListeners = getListenerSet(registry, streamName, eventName);

        for (const listener of eventListeners) {
          listener(event);
        }
      };
    }
  }

  return listeners;
}

export function connectRealtimeStream(
  registry,
  {
    connect = connectReconnectingEventSource,
    onStatusChange = null,
  } = {}
) {
  return connect(getRealtimeStreamUrl(), {
    listeners: createRealtimeEventListeners(registry),
    onStatusChange,
  });
}
