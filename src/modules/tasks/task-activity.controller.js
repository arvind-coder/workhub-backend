import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getTaskActivities } from "./task-activity-query.service.js";
export const listTaskActivities = async (req, res) => {
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
    const parseQueryNumber = (value, defaultValue, field) => {
        if (value === undefined)
            return defaultValue;
        if (typeof value !== "string" ||
            !/^\d+$/.test(value)) {
            throw new AppError(`Invalid ${field}`, 400);
        }
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            throw new AppError(`${field} must be at least 1`, 400);
        }
        return parsed;
    };
    const page = parseQueryNumber(req.query.page, 1, "page");
    const limit = parseQueryNumber(req.query.limit, 10, "limit");
    if (limit > 100) {
        throw new AppError("Limit cannot exceed 100", 400);
    }
    const result = await getTaskActivities(projectId, taskId, req.authUser.userId, req.authUser.role, page, limit);
    return sendSuccess(res, result);
};
//# sourceMappingURL=task-activity.controller.js.map