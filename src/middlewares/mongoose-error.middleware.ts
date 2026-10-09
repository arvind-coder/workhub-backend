import mongoose from "mongoose";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./app-error.js";

export const mongooseErrorMiddleware = (
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  // Invalid MongoDB ObjectId
  if (err instanceof mongoose.Error.CastError) {
    next(new AppError("Invalid MongoDB ID", 400));
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map(
      (error) => error.message
    );

    next(new AppError(messages.join(", "), 400));
    return;
  }

  next(err);
};