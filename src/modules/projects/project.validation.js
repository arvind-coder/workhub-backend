import { AppError } from "../../middlewares/app-error.js";
export const validateCreateProject = (name, description, ownerId) => {
    if (typeof name !== "string" || name.trim().length === 0) {
        throw new AppError("Project name is required", 400);
    }
    if (typeof description !== "string" || description.trim().length === 0) {
        throw new AppError("Project description is required", 400);
    }
    if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
        throw new AppError("Project ownerId is required", 400);
    }
};
export const validateUpdateProject = (name, description, status) => {
    if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length === 0) {
            throw new AppError("Project name must be a valid string", 400);
        }
    }
    if (description !== undefined) {
        if (typeof description !== "string" ||
            description.trim().length === 0) {
            throw new AppError("Project description must be a valid string", 400);
        }
    }
    if (status !== undefined) {
        if (status !== "active" && status !== "archived") {
            throw new AppError("Project status must be active or archived", 400);
        }
    }
};
//# sourceMappingURL=project.validation.js.map