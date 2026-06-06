import { query } from "../db/pool.js";

export const REALTIME_MESSAGE_EVENTS = [
  "message",
  "messageUpdate",
  "typing",
  "read",
  "reaction",
  "presence",
];
export const REALTIME_NOTIFICATION_EVENTS = ["notification"];
export const REALTIME_ALL_EVENTS = [
  ...REALTIME_MESSAGE_EVENTS,
  ...REALTIME_NOTIFICATION_EVENTS,
];

const realtimeClients = new Map();
let updateLastSeen = updateUserLastSeen;

async function updateUserLastSeen(userId) {
  try {
    await query(
      `
      UPDATE users
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [userId]
    );
  } catch {
    // Presence is best-effort; failed writes should not break open SSE streams.
  }
}

function normalizeEvents(events = REALTIME_ALL_EVENTS) {
  return new Set(events);
}

function getUserClients(userId) {
  const key = String(userId);

  if (!realtimeClients.has(key)) {
    realtimeClients.set(key, new Set());
  }

  return realtimeClients.get(key);
}

function getPresenceClientCount(userId) {
  const clients = realtimeClients.get(String(userId));

  if (!clients) {
    return 0;
  }

  let count = 0;

  for (const client of clients) {
    if (client.trackPresence) {
      count += 1;
    }
  }

  return count;
}

function clientAcceptsEvent(client, eventName) {
  return client.events.has(eventName);
}

export function formatRealtimeEvent(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function addRealtimeClient(
  userId,
  res,
  { events = REALTIME_ALL_EVENTS, trackPresence = true } = {}
) {
  const clients = getUserClients(userId);
  const wasOffline = getPresenceClientCount(userId) === 0;
  const client = {
    events: normalizeEvents(events),
    res,
    trackPresence,
  };

  clients.add(client);

  if (trackPresence && wasOffline) {
    broadcastRealtimeEvent("presence", {
      userId,
      isOnline: true,
    });
  }

  return () => {
    clients.delete(client);

    if (clients.size === 0) {
      realtimeClients.delete(String(userId));
    }

    if (trackPresence && getPresenceClientCount(userId) === 0) {
      updateLastSeen(userId);
      broadcastRealtimeEvent("presence", {
        userId,
        isOnline: false,
      });
    }
  };
}

export function publishRealtimeEvent(userId, eventName, data) {
  const clients = realtimeClients.get(String(userId));

  if (!clients || clients.size === 0) {
    return;
  }

  const payload = formatRealtimeEvent(eventName, data);

  for (const client of clients) {
    if (clientAcceptsEvent(client, eventName)) {
      client.res.write(payload);
    }
  }
}

export function broadcastRealtimeEvent(eventName, data) {
  const payload = formatRealtimeEvent(eventName, data);

  for (const clients of realtimeClients.values()) {
    for (const client of clients) {
      if (clientAcceptsEvent(client, eventName)) {
        client.res.write(payload);
      }
    }
  }
}

export function isRealtimeUserOnline(userId) {
  return getPresenceClientCount(userId) > 0;
}

export function getRealtimeClientCount(userId) {
  if (userId === undefined || userId === null) {
    let count = 0;

    for (const clients of realtimeClients.values()) {
      count += clients.size;
    }

    return count;
  }

  return realtimeClients.get(String(userId))?.size || 0;
}

export function resetRealtimeBrokerForTest() {
  realtimeClients.clear();
  updateLastSeen = updateUserLastSeen;
}

export function setRealtimeLastSeenUpdaterForTest(updater) {
  updateLastSeen = updater;
}
