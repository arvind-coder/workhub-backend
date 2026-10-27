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

  // Body-parser errors (malformed JSON, payload too large) carry their
  // own 4xx status and must not surface as 500.
  const parserError = err as Error & {
    status?: number;
    type?: string;
  };

  if (parserError.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      message: "Malformed JSON in request body"
    });

    return;
  }

  if (parserError.type === "entity.too.large") {
    res.status(413).json({
      success: false,
      message: "Request body is too large"
    });

    return;
  }

  if (
    parserError.type === "charset.unsupported" ||
    parserError.type === "encoding.unsupported"
  ) {
    res.status(415).json({
      success: false,
      message: "Unsupported request encoding"
    });

    return;
  }

  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};