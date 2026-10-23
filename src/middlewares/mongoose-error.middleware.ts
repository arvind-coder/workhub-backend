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

  // Duplicate key (unique index violation), e.g. concurrent registrations
  if ((err as Error & { code?: number }).code === 11000) {
    next(new AppError("Resource already exists", 409));
    return;
  }

  next(err);
};