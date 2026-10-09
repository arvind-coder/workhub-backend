import type { Request, Response } from "express";
import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { registerUser } from "./auth.service.js";

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