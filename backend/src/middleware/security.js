const BASE_SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "script-src 'none'",
    "style-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Frame-Options": "DENY",
};

const PRODUCTION_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
};

export function getSecurityHeaders({ isProduction = false } = {}) {
  return {
    ...BASE_SECURITY_HEADERS,
    ...(isProduction ? PRODUCTION_SECURITY_HEADERS : {}),
  };
}

export function applySecurityMiddleware(
  app,
  { isProduction = false, trustProxy = false } = {}
) {
  app.disable("x-powered-by");

  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use((req, res, next) => {
    const headers = getSecurityHeaders({
      isProduction,
    });

    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }

    next();
  });
}
