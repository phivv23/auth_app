const messageClients = new Map();

function getUserClients(userId) {
  const key = String(userId);

  if (!messageClients.has(key)) {
    messageClients.set(key, new Set());
  }

  return messageClients.get(key);
}

export function addMessageClient(userId, res) {
  const clients = getUserClients(userId);
  clients.add(res);

  return () => {
    clients.delete(res);

    if (clients.size === 0) {
      messageClients.delete(String(userId));
    }
  };
}

export function publishMessage(userId, message) {
  const clients = messageClients.get(String(userId));

  if (!clients || clients.size === 0) {
    return;
  }

  const payload = `event: message\ndata: ${JSON.stringify(message)}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}
