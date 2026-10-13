import { AppError } from "../../middlewares/app-error.js";
const isTaskStatus = (value) => value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "DONE";
const isTaskPriority = (value) => value === "LOW" ||
    value === "MEDIUM" ||
    value === "HIGH";
const isValidDateString = (value) => value.trim().length > 0 &&
    !Number.isNaN(Date.parse(value)) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value);
export const validateCreateTask = (title, description, status, priority, dueDate) => {
    if (typeof title !== "string" ||
        title.trim().length < 3 ||
        title.trim().length > 150) {
        throw new AppError("Title must be between 3 and 150 characters", 400);
    }
    if (typeof description !== "string" ||
        description.trim().length < 1 ||
        description.trim().length > 2000) {
        throw new AppError("Description must be between 1 and 2000 characters", 400);
    }
    if (status !== undefined && !isTaskStatus(status)) {
        throw new AppError("Status must be TODO, IN_PROGRESS or DONE", 400);
    }
    if (priority !== undefined &&
        !isTaskPriority(priority)) {
        throw new AppError("Priority must be LOW, MEDIUM or HIGH", 400);
    }
    if (dueDate !== undefined) {
        if (typeof dueDate !== "string" ||
            !isValidDateString(dueDate)) {
            throw new AppError("dueDate must be a valid ISO datetime string", 400);
        }
    }
};
export const validateUpdateTask = (data) => {
    const allowedFields = [
        "title",
        "description",
        "assignedTo",
        "status",
        "priority",
        "dueDate"
    ];
    const unsupportedFields = Object.keys(data).filter((key) => !allowedFields.includes(key));
    if (unsupportedFields.length > 0) {
        throw new AppError(`Unsupported fields: ${unsupportedFields.join(", ")}`, 400);
    }
    if (Object.keys(data).length === 0) {
        throw new AppError("At least one field is required to update", 400);
    }
    if (data.title !== undefined &&
        (typeof data.title !== "string" ||
            data.title.trim().length < 3 ||
            data.title.trim().length > 150)) {
        throw new AppError("Title must be between 3 and 150 characters", 400);
    }
    if (data.description !== undefined &&
        (typeof data.description !== "string" ||
            data.description.trim().length < 1 ||
            data.description.trim().length > 2000)) {
        throw new AppError("Description must be between 1 and 2000 characters", 400);
    }
    if (data.status !== undefined &&
        !isTaskStatus(data.status)) {
        throw new AppError("Status must be TODO, IN_PROGRESS or DONE", 400);
    }
    if (data.priority !== undefined &&
        !isTaskPriority(data.priority)) {
        throw new AppError("Priority must be LOW, MEDIUM or HIGH", 400);
    }
    if (data.assignedTo !== undefined &&
        data.assignedTo !== null &&
        (typeof data.assignedTo !== "string" ||
            data.assignedTo.trim().length === 0)) {
        throw new AppError("assignedTo must be a valid user ID or null", 400);
    }
    if (data.dueDate !== undefined && data.dueDate !== null) {
        if (typeof data.dueDate !== "string" ||
            !isValidDateString(data.dueDate)) {
            throw new AppError("dueDate must be a valid ISO datetime string or null", 400);
        }
    }
};
//# sourceMappingURL=task.validation.js.map