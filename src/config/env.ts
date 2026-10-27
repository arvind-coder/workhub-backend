const MIN_SECRET_LENGTH = 32;

const required = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
};

// Whole number >= min. TRUST_PROXY legitimately allows 0 (no proxy).
const parseInteger = (
  name: string,
  fallback: number,
  min: number
): number => {
  const raw = process.env[name]?.trim();

  if (!raw) return fallback;

  if (!/^\d+$/.test(raw) || Number(raw) < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }

  return Number(raw);
};

// CORS entries must be exact origins (scheme + host [+ port]). Wildcards,
// paths and trailing slashes are rejected so a typo cannot silently widen
// or break the allow-list. The offending value is deliberately not echoed.
const parseCorsOrigins = (raw: string): string[] => {
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    let parsed: URL | undefined;

    try {
      parsed = new URL(origin);
    } catch {
      parsed = undefined;
    }

    if (
      !parsed ||
      origin.includes("*") ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.origin !== origin
    ) {
      throw new Error(
        "CORS_ORIGINS must be a comma-separated list of exact origins " +
          "such as https://app.example.com (no wildcard, path or trailing slash)"
      );
    }
  }

  return origins;
};

// Validate configuration once at startup so misconfiguration fails fast
// instead of at the first login request.
export const loadEnv = () => {
  const accessSecret = required("JWT_ACCESS_SECRET");
  const refreshSecret = required("JWT_REFRESH_SECRET");

  if (
    accessSecret.length < MIN_SECRET_LENGTH ||
    refreshSecret.length < MIN_SECRET_LENGTH
  ) {
    throw new Error(
      `JWT secrets must be at least ${MIN_SECRET_LENGTH} characters`
    );
  }

  if (accessSecret === refreshSecret) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ"
    );
  }

  required("MONGODB_URI");

  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS ?? "");
  const isProduction = process.env.NODE_ENV === "production";

  // ENABLE_API_DOCS overrides the default (docs on outside production).
  const docsFlag = process.env.ENABLE_API_DOCS?.trim().toLowerCase();

  if (
    docsFlag !== undefined &&
    docsFlag !== "" &&
    docsFlag !== "true" &&
    docsFlag !== "false"
  ) {
    throw new Error("ENABLE_API_DOCS must be true or false");
  }

  return {
    isProduction,
    apiDocsEnabled: docsFlag ? docsFlag === "true" : !isProduction,
    corsOrigins,
    trustProxy: parseInteger("TRUST_PROXY", 0, 0),
    authRateLimitMax: parseInteger("AUTH_RATE_LIMIT_MAX", 10, 1),
    apiRateLimitMax: parseInteger("API_RATE_LIMIT_MAX", 300, 1)
  };
};

export type AppEnv = ReturnType<typeof loadEnv>;
