const MIN_SECRET_LENGTH = 32;
const required = (name) => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is not defined`);
    }
    return value;
};
// Whole number >= min. TRUST_PROXY legitimately allows 0 (no proxy).
const parseInteger = (name, fallback, min) => {
    const raw = process.env[name]?.trim();
    if (!raw)
        return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < min) {
        throw new Error(`${name} must be an integer >= ${min}`);
    }
    return Number(raw);
};
// Validate configuration once at startup so misconfiguration fails fast
// instead of at the first login request.
export const loadEnv = () => {
    const accessSecret = required("JWT_ACCESS_SECRET");
    const refreshSecret = required("JWT_REFRESH_SECRET");
    if (accessSecret.length < MIN_SECRET_LENGTH ||
        refreshSecret.length < MIN_SECRET_LENGTH) {
        throw new Error(`JWT secrets must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (accessSecret === refreshSecret) {
        throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
    }
    required("MONGODB_URI");
    const corsOrigins = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    return {
        corsOrigins,
        trustProxy: parseInteger("TRUST_PROXY", 0, 0),
        authRateLimitMax: parseInteger("AUTH_RATE_LIMIT_MAX", 10, 1),
        apiRateLimitMax: parseInteger("API_RATE_LIMIT_MAX", 300, 1)
    };
};
//# sourceMappingURL=env.js.map