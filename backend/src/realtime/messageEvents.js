import {
  addRealtimeClient,
  broadcastRealtimeEvent,
  isRealtimeUserOnline,
  publishRealtimeEvent,
  REALTIME_MESSAGE_EVENTS,
} from "./broker.js";

export function addMessageClient(userId, res) {
  return addRealtimeClient(userId, res, {
    events: REALTIME_MESSAGE_EVENTS,
    trackPresence: true,
  });
}

export function isUserOnline(userId) {
  return isRealtimeUserOnline(userId);
}

export function publishMessageEvent(userId, eventName, data) {
  publishRealtimeEvent(userId, eventName, data);
}

export function broadcastMessageEvent(eventName, data) {
  broadcastRealtimeEvent(eventName, data);
}

export function publishMessage(userId, message) {
  publishMessageEvent(userId, "message", message);
}
