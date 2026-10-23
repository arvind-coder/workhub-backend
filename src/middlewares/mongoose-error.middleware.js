import mongoose from "mongoose";
import { AppError } from "./app-error.js";
export const mongooseErrorMiddleware = (err, _req, _res, next) => {
    // Invalid MongoDB ObjectId
    if (err instanceof mongoose.Error.CastError) {
        next(new AppError("Invalid MongoDB ID", 400));
        return;
    }
    // Mongoose validation error
    if (err instanceof mongoose.Error.ValidationError) {
        const messages = Object.values(err.errors).map((error) => error.message);
        next(new AppError(messages.join(", "), 400));
        return;
    }
    // Duplicate key (unique index violation), e.g. concurrent registrations
    if (err.code === 11000) {
        next(new AppError("Resource already exists", 409));
        return;
    }
    next(err);
};
//# sourceMappingURL=mongoose-error.middleware.js.map