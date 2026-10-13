import type {
  NextFunction,
  Request,
  Response
} from "express";

import { AppError } from "./app-error.js";
import type { UserRole } from "../modules/users/user.types.js";

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.authUser) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      next(
        new AppError(
          "You do not have permission to perform this action",
          403
        )
      );
      return;
    }

    next();
  };
};