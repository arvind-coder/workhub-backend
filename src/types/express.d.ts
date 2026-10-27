import type { UserRole } from "../modules/users/user.types.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}

export {};