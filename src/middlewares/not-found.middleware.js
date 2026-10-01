import { AppError } from "./app-error.js";
export const notFoundMiddleware = (req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};
//# sourceMappingURL=not-found.middleware.js.map