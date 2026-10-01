import { AppError } from "./app-error.js";
export const errorMiddleware = (err, _req, res, _next) => {
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
//# sourceMappingURL=error.middleware.js.map