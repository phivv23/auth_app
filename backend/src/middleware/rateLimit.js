import { sendError } from "../utils/http.js";

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createMemoryRateLimitStore() {
  const buckets = new Map();

  function cleanupExpiredBuckets(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    async increment(key, windowMs, now) {
      cleanupExpiredBuckets(now);

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

      return bucket;
    },
    clear() {
      buckets.clear();
    },
  };
}

export function rateLimit({
  windowMs = 60 * 1000,
  max = 60,
  keyPrefix = "global",
  keyGenerator = getClientIp,
  message = "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  store = createMemoryRateLimitStore(),
} = {}) {
  return async (req, res, next) => {
    const now = Date.now();

    try {
      const clientKey = keyGenerator(req);
      const key = `${keyPrefix}:${clientKey}`;
      const bucket = await store.increment(key, windowMs, now);
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, max - bucket.count))
      );
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.ceil(bucket.resetAt / 1000))
      );

      if (bucket.count > max) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return sendError(res, 429, message, "RATE_LIMITED");
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
