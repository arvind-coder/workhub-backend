import jwt from "jsonwebtoken";
import { AppError } from "./app-error.js";
const allowedRoles = [
    "ADMIN",
    "PROJECT_MANAGER",
    "MEMBER"
];
export const authMiddleware = (req, _res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
        next(new AppError("Authentication token is required", 401));
        return;
    }
    const token = authorization.slice(7).trim();
    if (!token) {
        next(new AppError("Authentication token is required", 401));
        return;
    }
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        next(new Error("JWT_ACCESS_SECRET is not configured"));
        return;
    }
    try {
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === "string" ||
            typeof decoded.sub !== "string" ||
            !decoded.sub ||
            typeof decoded.role !== "string" ||
            !allowedRoles.includes(decoded.role)) {
            throw new AppError("Invalid authentication token", 401);
        }
        req.authUser = {
            userId: decoded.sub,
            role: decoded.role
        };
        next();
    }
    catch (error) {
        if (error instanceof AppError) {
            next(error);
            return;
        }
        if (error instanceof jwt.TokenExpiredError) {
            next(new AppError("Access token has expired", 401));
            return;
        }
        if (error instanceof jwt.JsonWebTokenError) {
            next(new AppError("Invalid authentication token", 401));
            return;
        }
        next(error);
    }
};
//# sourceMappingURL=auth.middleware.js.map