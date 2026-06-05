import { randomUUID } from "node:crypto";

const DEFAULT_SLOW_REQUEST_MS = 1000;

function getIncomingRequestId(req) {
  const headerValue = req.get?.("x-request-id") || req.headers?.["x-request-id"];

  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }

  return headerValue;
}

function writeLog(logger, level, message, details) {
  const log = logger[level] || logger.info || logger.log;

  if (typeof log === "function") {
    log.call(logger, message, details);
  }
}

export function createRequestLogger({
  logger = console,
  slowRequestMs = DEFAULT_SLOW_REQUEST_MS,
  now = () => Date.now(),
  createRequestId = randomUUID,
} = {}) {
  return (req, res, next) => {
    const startedAt = now();
    const requestId = getIncomingRequestId(req) || createRequestId();

    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
      const durationMs = Math.max(0, now() - startedAt);
      const details = {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
      };

      if (durationMs >= slowRequestMs) {
        writeLog(logger, "warn", "Slow request", details);
        return;
      }

      if (res.statusCode >= 500) {
        writeLog(logger, "error", "Request failed", details);
        return;
      }

      writeLog(logger, "info", "Request completed", details);
    });

    next();
  };
}
