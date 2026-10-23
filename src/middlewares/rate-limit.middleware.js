import { rateLimit } from "express-rate-limit";
import { AppError } from "./app-error.js";
const buildLimiter = (max, windowMs, message) => rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Route through the central error handler for a consistent shape.
    handler: (_req, _res, next) => {
        next(new AppError(message, 429));
    }
});
// Strict limiter for register, login, refresh and logout.
export const createAuthRateLimiter = (max) => buildLimiter(max, 15 * 60 * 1000, "Too many authentication attempts, please try again later");
// General limiter for the rest of the API.
export const createApiRateLimiter = (max) => buildLimiter(max, 15 * 60 * 1000, "Too many requests, please try again later");
//# sourceMappingURL=rate-limit.middleware.js.map