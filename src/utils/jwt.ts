import jwt from "jsonwebtoken";
import type { UserRole } from "../modules/users/user.types.js";

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
    expiresIn: "15m"
  });
};