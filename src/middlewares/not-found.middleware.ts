import type { NextFunction, Request, Response } from "express";
import { AppError } from "./app-error.js";

export const notFoundMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};