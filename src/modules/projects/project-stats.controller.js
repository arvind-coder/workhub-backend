import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getProjectStats } from "./project-stats.service.js";
export const getProjectDashboardStats = async (req, res) => {
    const { projectId } = req.params;
    if (!projectId || Array.isArray(projectId)) {
        throw new AppError("Invalid project ID", 400);
    }
    if (!req.authUser) {
        throw new AppError("Authentication required", 401);
    }
    const stats = await getProjectStats(projectId, req.authUser.userId, req.authUser.role);
    return sendSuccess(res, stats);
};
//# sourceMappingURL=project-stats.controller.js.map