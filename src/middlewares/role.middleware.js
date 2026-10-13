import { AppError } from "./app-error.js";
export const authorizeRoles = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.authUser) {
            next(new AppError("Authentication required", 401));
            return;
        }
        if (!allowedRoles.includes(req.authUser.role)) {
            next(new AppError("You do not have permission to perform this action", 403));
            return;
        }
        next();
    };
};
//# sourceMappingURL=role.middleware.js.map