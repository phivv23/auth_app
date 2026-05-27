import { sendError } from "../utils/http.js";

const buckets = new Map();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function cleanupExpiredBuckets(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function rateLimit({
  windowMs = 60 * 1000,
  max = 60,
  keyPrefix = "global",
  keyGenerator = getClientIp,
  message = "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const clientKey = keyGenerator(req);
    const key = `${keyPrefix}:${clientKey}`;
    const currentBucket = buckets.get(key);
    const bucket =
      currentBucket && currentBucket.resetAt > now
        ? currentBucket
        : {
            count: 0,
            resetAt: now + windowMs,
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return sendError(res, 429, message, "RATE_LIMITED");
    }

    return next();
  };
}
