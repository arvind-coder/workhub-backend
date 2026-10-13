import { AppError } from "../../middlewares/app-error.js";
import { sendPaginatedSuccess, sendSuccess } from "../../utils/api-response.js";
import { createTask, getProjectTasks, updateTask, deleteTask } from "./task.service.js";
import { validateCreateTask, validateUpdateTask } from "./task.validation.js";
export const createNewTask = async (req, res) => {
    const { projectId } = req.params;
    if (!projectId || Array.isArray(projectId)) {
        throw new AppError("Invalid project ID", 400);
    }
    if (!req.authUser) {
        throw new AppError("Authentication required", 401);
    }
    const { title, description, assignedTo, status, priority } = req.body;
    validateCreateTask(title, description, status, priority);
    if (assignedTo !== undefined &&
        typeof assignedTo !== "string") {
        throw new AppError("assignedTo must be a user ID string", 400);
    }
    const input = {
        title: title.trim(),
        description: description.trim(),
        ...(assignedTo !== undefined
            ? { assignedTo: assignedTo.trim() }
            : {}),
        ...(status !== undefined
            ? { status: status }
            : {}),
        ...(priority !== undefined
            ? { priority: priority }
            : {})
    };
    const task = await createTask(projectId, req.authUser.userId, req.authUser.role, input);
    sendSuccess(res, task, 201);
};
export const listProjectTasks = async (req, res) => {
    const { projectId } = req.params;
    if (!projectId || Array.isArray(projectId)) {
        throw new AppError("Invalid project ID", 400);
    }
    if (!req.authUser) {
        throw new AppError("Authentication required", 401);
    }
    const parseNumber = (value, defaultValue) => {
        if (value === undefined)
            return defaultValue;
        if (typeof value !== "string" ||
            !/^\d+$/.test(value)) {
            return undefined;
        }
        return Number(value);
    };
    const page = parseNumber(req.query.page, 1);
    const limit = parseNumber(req.query.limit, 10);
    if (page === undefined || page < 1) {
        throw new AppError("Page must be a positive integer", 400);
    }
    if (limit === undefined ||
        limit < 1 ||
        limit > 100) {
        throw new AppError("Limit must be between 1 and 100", 400);
    }
    const search = typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;
    if (search !== undefined && search.length > 100) {
        throw new AppError("Search cannot exceed 100 characters", 400);
    }
    const status = req.query.status;
    if (status !== undefined &&
        status !== "TODO" &&
        status !== "IN_PROGRESS" &&
        status !== "DONE") {
        throw new AppError("Status must be TODO, IN_PROGRESS or DONE", 400);
    }
    const priority = req.query.priority;
    if (priority !== undefined &&
        priority !== "LOW" &&
        priority !== "MEDIUM" &&
        priority !== "HIGH") {
        throw new AppError("Priority must be LOW, MEDIUM or HIGH", 400);
    }
    const assignedTo = req.query.assignedTo;
    if (assignedTo !== undefined &&
        typeof assignedTo !== "string") {
        throw new AppError("assignedTo must be a single user ID", 400);
    }
    const sortBy = req.query.sortBy ?? "createdAt";
    if (sortBy !== "createdAt" &&
        sortBy !== "updatedAt" &&
        sortBy !== "title") {
        throw new AppError("sortBy must be createdAt, updatedAt or title", 400);
    }
    const sortOrder = req.query.sortOrder ?? "desc";
    if (sortOrder !== "asc" &&
        sortOrder !== "desc") {
        throw new AppError("sortOrder must be asc or desc", 400);
    }
    const result = await getProjectTasks(projectId, req.authUser.userId, req.authUser.role, {
        page,
        limit,
        sortBy,
        sortOrder,
        ...(search !== undefined ? { search } : {}),
        ...(status !== undefined
            ? { status: status }
            : {}),
        ...(priority !== undefined
            ? { priority: priority }
            : {}),
        ...(assignedTo !== undefined
            ? { assignedTo }
            : {})
    });
    sendPaginatedSuccess(res, result.tasks, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
    });
};
export const updateExistingTask = async (req, res) => {
    const { projectId, taskId } = req.params;
    if (!projectId ||
        Array.isArray(projectId) ||
        !taskId ||
        Array.isArray(taskId)) {
        throw new AppError("Invalid project ID or task ID", 400);
    }
    if (!req.authUser) {
        throw new AppError("Authentication required", 401);
    }
    if (!req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)) {
        throw new AppError("Request body must be an object", 400);
    }
    validateUpdateTask(req.body);
    const data = req.body;
    const task = await updateTask(projectId, taskId, req.authUser.userId, req.authUser.role, data);
    sendSuccess(res, task);
};
export const deleteExistingTask = async (req, res) => {
    const { projectId, taskId } = req.params;
    if (!projectId ||
        Array.isArray(projectId) ||
        !taskId ||
        Array.isArray(taskId)) {
        throw new AppError("Invalid project ID or task ID", 400);
    }
    if (!req.authUser) {
        throw new AppError("Authentication required", 401);
    }
    await deleteTask(projectId, taskId, req.authUser.userId, req.authUser.role);
    sendSuccess(res, {
        message: "Task deleted successfully"
    });
};
//# sourceMappingURL=task.controller.js.map