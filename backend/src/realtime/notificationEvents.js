import {
  addRealtimeClient,
  publishRealtimeEvent,
  REALTIME_NOTIFICATION_EVENTS,
} from "./broker.js";

export function addNotificationClient(userId, res) {
  return addRealtimeClient(userId, res, {
    events: REALTIME_NOTIFICATION_EVENTS,
    trackPresence: false,
  });
}

export function publishNotification(userId, notification) {
  publishRealtimeEvent(userId, "notification", notification);
}
