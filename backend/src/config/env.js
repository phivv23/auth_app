import "dotenv/config";

const requiredEnv = [
  "CLIENT_URL",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
];

const weakJwtSecrets = new Set([
  "secret",
  "jwt_secret",
  "change_me",
  "change_this_to_a_long_random_secret_for_learning",
]);

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function assertRequiredEnv(source) {
  for (const key of requiredEnv) {
    if (!source[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export function validateProductionConfig(config) {
  if (config.nodeEnv !== "production") {
    return;
  }

  if (
    config.jwtSecret.length < 32 ||
    weakJwtSecrets.has(config.jwtSecret.toLowerCase())
  ) {
    throw new Error(
      "JWT_SECRET must be a strong random value with at least 32 characters in production."
    );
  }

  const clientUrl = new URL(config.clientUrl);

  if (clientUrl.protocol !== "https:") {
    throw new Error("CLIENT_URL must use HTTPS in production.");
  }
}

export function buildEnvConfig(source = process.env) {
  assertRequiredEnv(source);

  const nodeEnv = source.NODE_ENV || "development";
  const config = {
    port: Number(source.PORT || 5000),
    nodeEnv,
    clientUrl: source.CLIENT_URL,
    trustProxy: parseBoolean(source.TRUST_PROXY, nodeEnv === "production"),

    db: {
      host: source.DB_HOST,
      port: Number(source.DB_PORT || 3306),
      user: source.DB_USER,
      password: source.DB_PASSWORD,
      database: source.DB_NAME,
    },

    jwtSecret: source.JWT_SECRET,
    jwtExpiresIn: source.JWT_EXPIRES_IN || "7d",
  };

  validateProductionConfig(config);

  return config;
}

export const env = buildEnvConfig();
