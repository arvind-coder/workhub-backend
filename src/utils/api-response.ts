import type { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200
) => {
  res.status(statusCode).json({
    success: true,
    data
  });
};

export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
) => {
  res.status(200).json({
    success: true,
    data,
    pagination
  });
};