import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { createTask, getProjectTasks } from "./task.service.js";
import { validateCreateTask } from "./task.validation.js";
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
    const tasks = await getProjectTasks(projectId, req.authUser.userId, req.authUser.role);
    sendSuccess(res, tasks);
};
//# sourceMappingURL=task.controller.js.map