const notificationClients = new Map();

function getUserClients(userId) {
  const key = String(userId);

  if (!notificationClients.has(key)) {
    notificationClients.set(key, new Set());
  }

  return notificationClients.get(key);
}

export function addNotificationClient(userId, res) {
  const clients = getUserClients(userId);
  clients.add(res);

  return () => {
    clients.delete(res);

    if (clients.size === 0) {
      notificationClients.delete(String(userId));
    }
  };
}

export function publishNotification(userId, notification) {
  const clients = notificationClients.get(String(userId));

  if (!clients || clients.size === 0) {
    return;
  }

  const payload = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}
