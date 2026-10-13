import { Types } from "mongoose";
import { TaskActivityModel } from "./task-activity.model.js";
export const createTaskActivity = async (input) => {
    const activity = await TaskActivityModel.create({
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.userId,
        action: input.action,
        message: input.message,
        ...(input.metadata !== undefined
            ? { metadata: input.metadata }
            : {}),
    });
    return {
        id: String(activity._id),
        projectId: String(activity.projectId),
        taskId: String(activity.taskId),
        userId: String(activity.userId),
        action: activity.action,
        message: activity.message,
        ...(activity.metadata !== undefined
            ? { metadata: activity.metadata }
            : {}),
        createdAt: activity.createdAt,
    };
};
//# sourceMappingURL=task-activity.service.js.map