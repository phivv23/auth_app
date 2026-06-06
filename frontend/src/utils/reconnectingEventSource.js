export function connectReconnectingEventSource(
  url,
  {
    listeners = {},
    withCredentials = true,
    maxDelayMs = 30000,
    onStatusChange = null,
  } = {}
) {
  let eventSource = null;
  let closed = false;
  let retryDelayMs = 1000;
  let retryTimeoutId = null;

  function emitStatus(status) {
    onStatusChange?.(status);
  }

  function connect() {
    if (closed) {
      return;
    }

    emitStatus("connecting");
    eventSource = new EventSource(url, {
      withCredentials,
    });

    for (const [eventName, listener] of Object.entries(listeners)) {
      eventSource.addEventListener(eventName, listener);
    }

    eventSource.addEventListener("open", () => {
      retryDelayMs = 1000;
      emitStatus("open");
    });

    eventSource.addEventListener("error", () => {
      eventSource?.close();

      if (closed) {
        return;
      }

      emitStatus("reconnecting");
      window.clearTimeout(retryTimeoutId);
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
      emitStatus("closed");
    },
  };
}
