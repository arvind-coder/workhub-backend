import type {
  NextFunction,
  Request,
  Response
} from "express";

import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { AppError } from "./app-error.js";
import type { UserRole } from "../modules/users/user.types.js";

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
}

const allowedRoles: UserRole[] = [
  "ADMIN",
  "PROJECT_MANAGER",
  "MEMBER"
];

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
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

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      !decoded.sub ||
      typeof decoded.role !== "string" ||
      !allowedRoles.includes(decoded.role as UserRole)
    ) {
      throw new AppError("Invalid authentication token", 401);
    }

    req.authUser = {
      userId: decoded.sub,
      role: decoded.role as UserRole
    };

    next();
  } catch (error) {
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