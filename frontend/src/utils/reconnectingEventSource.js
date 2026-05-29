export function connectReconnectingEventSource(
  url,
  { listeners = {}, withCredentials = true, maxDelayMs = 30000 } = {}
) {
  let eventSource = null;
  let closed = false;
  let retryDelayMs = 1000;
  let retryTimeoutId = null;

  function connect() {
    if (closed) {
      return;
    }

    eventSource = new EventSource(url, {
      withCredentials,
    });

    for (const [eventName, listener] of Object.entries(listeners)) {
      eventSource.addEventListener(eventName, listener);
    }

    eventSource.addEventListener("open", () => {
      retryDelayMs = 1000;
    });

    eventSource.addEventListener("error", () => {
      eventSource?.close();

      if (closed) {
        return;
      }

      retryTimeoutId = window.setTimeout(() => {
        retryDelayMs = Math.min(retryDelayMs * 2, maxDelayMs);
        connect();
      }, retryDelayMs);
    });
  }

  connect();

  return {
    close() {
      closed = true;
      window.clearTimeout(retryTimeoutId);
      eventSource?.close();
    },
  };
}
