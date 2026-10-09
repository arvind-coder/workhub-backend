import type { Request, Response } from "express";
import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { loginUser, logoutUser, registerUser } from "./auth.service.js";
import { refreshUserTokens } from "./auth.service.js";

export const register = async (
  req: Request,
  res: Response
) => {
  const { name, email, password } = req.body;

  if (
    typeof name !== "string" ||
    name.trim().length === 0
  ) {
    throw new AppError("Name is required", 400);
  }

  if (
    typeof email !== "string" ||
    email.trim().length === 0
  ) {
    throw new AppError("Email is required", 400);
  }

  if (
    typeof password !== "string" ||
    password.length < 6
  ) {
    throw new AppError(
      "Password must be at least 6 characters",
      400
    );
  }

  const user = await registerUser(
    name.trim(),
    email.trim().toLowerCase(),
    password
  );

  sendSuccess(res, user, 201);
};

export const login = async (
  req: Request,
  res: Response
) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    email.trim().length === 0
  ) {
    throw new AppError("Email is required", 400);
  }

  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new AppError("Password is required", 400);
  }

  const result = await loginUser(
    email.trim().toLowerCase(),
    password
  );

  sendSuccess(res, result);
};

export const refresh = async (
  req: Request,
  res: Response
) => {
  const { refreshToken } = req.body;

  if (
    typeof refreshToken !== "string" ||
    !refreshToken.trim()
  ) {
    throw new AppError("Refresh token is required", 400);
  }

  const tokens = await refreshUserTokens(refreshToken);

  sendSuccess(res, tokens);
};

export const logout = async (
  req: Request,
  res: Response
) => {
  const { refreshToken } = req.body;

  if (
    typeof refreshToken !== "string" ||
    !refreshToken.trim()
  ) {
    throw new AppError(
      "Refresh token is required",
      400
    );
  }

  await logoutUser(refreshToken);

  sendSuccess(res, {
    message: "Logged out successfully"
  });
};