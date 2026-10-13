import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { createTaskComment, getTaskComments } from "./task-comment.service.js";
export const addTaskComment = async (req, res) => {
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
    const { message } = req.body;
    if (typeof message !== "string") {
        throw new AppError("Comment message is required", 400);
    }
    const comment = await createTaskComment(projectId, taskId, req.authUser.userId, req.authUser.role, message);
    sendSuccess(res, comment, 201);
};
export const listTaskComments = async (req, res) => {
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
    const comments = await getTaskComments(projectId, taskId, req.authUser.userId, req.authUser.role);
    sendSuccess(res, comments);
};
//# sourceMappingURL=task-comment.controller.js.map