import type { NextFunction, Request, Response } from "express";
import { AppError } from "./app-error.js";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });

    return;
  }

  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};