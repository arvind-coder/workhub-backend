import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import type { UserRole } from "../modules/users/user.types.js";

export const JWT_ALGORITHM = "HS256" as const;
export const JWT_ISSUER = "workhub-api";
export const JWT_AUDIENCE = "workhub-client";

// Shared by every jwt.verify call so algorithm, issuer and audience
// are always enforced.
export const jwtVerifyOptions = {
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE
};

const jwtSignOptions = {
  algorithm: JWT_ALGORITHM,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE
};

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export const generateAccessToken = (
  userId: string,
  role: UserRole
): string => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }

  const payload: AccessTokenPayload = {
    sub: userId,
    role
  };

  return jwt.sign(payload, secret, {
    ...jwtSignOptions,
    expiresIn: "15m"
  });
};

export const generateRefreshToken = (
  userId: string,
  role: UserRole
): string => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }

  return jwt.sign(
    {
      sub: userId,
      role
    },
    secret,
    {
      ...jwtSignOptions,
      // Unique per token: without it, two tokens issued in the same second
      // are identical, so a rotated token would still match its hash.
      jwtid: randomUUID(),
      expiresIn: "7d"
    }
  );
};