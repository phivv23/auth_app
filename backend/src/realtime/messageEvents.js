import { query } from "../db/pool.js";

const messageClients = new Map();

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

const getUserClients = (userId) => {
  const key = String(userId);

  if (!messageClients.has(key)) {
    messageClients.set(key, new Set());
  }

  return messageClients.get(key);
}

export function addMessageClient(userId, res) {
  const clients = getUserClients(userId);
  const wasOffline = clients.size === 0;
  clients.add(res);

  if (wasOffline) {
    broadcastMessageEvent("presence", {
      userId,
      isOnline: true,
    });
  }

  return () => {
    clients.delete(res);

    if (clients.size === 0) {
      messageClients.delete(String(userId));
      updateUserLastSeen(userId);
      broadcastMessageEvent("presence", {
        userId,
        isOnline: false,
      });
    }
  };
}

export function isUserOnline(userId) {
  const clients = messageClients.get(String(userId));

  return Boolean(clients && clients.size > 0);
}

export function publishMessageEvent(userId, eventName, data) {
  const clients = messageClients.get(String(userId));

  if (!clients || clients.size === 0) {
    return;
  }

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

export function broadcastMessageEvent(eventName, data) {
  for (const clients of messageClients.values()) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of clients) {
      client.write(payload);
    }
  }
}

export function publishMessage(userId, message) {
  publishMessageEvent(userId, "message", message);
}
