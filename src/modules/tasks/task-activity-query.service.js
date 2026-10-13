import mongoose from "mongoose";
import { AppError } from "../../middlewares/app-error.js";
import { ProjectModel } from "../projects/project.model.js";
import { ProjectMembershipModel } from "../projects/project-membership.model.js";
import { TaskModel } from "./task.model.js";
import { TaskActivityModel } from "./task-activity.model.js";
export const getTaskActivities = async (projectId, taskId, requesterId, requesterRole, page, limit) => {
    if (!mongoose.isValidObjectId(projectId) ||
        !mongoose.isValidObjectId(taskId) ||
        !mongoose.isValidObjectId(requesterId)) {
        throw new AppError("Invalid project, task or user ID", 400);
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    const isAdmin = requesterRole === "ADMIN";
    const isOwner = String(project.ownerId) === requesterId;
    if (!isAdmin && !isOwner) {
        const membership = await ProjectMembershipModel.findOne({
            projectId: project._id,
            userId: requesterId,
        });
        if (!membership) {
            throw new AppError("You do not have access to this project", 403);
        }
    }
    const task = await TaskModel.findOne({
        _id: taskId,
        projectId: project._id,
    }).select("_id");
    if (!task) {
        throw new AppError("Task not found in this project", 404);
    }
    const filter = {
        projectId: project._id,
        taskId: task._id,
    };
    const skip = (page - 1) * limit;
    const [activities, total] = await Promise.all([
        TaskActivityModel.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit),
        TaskActivityModel.countDocuments(filter),
    ]);
    return {
        activities: activities.map((activity) => ({
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
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
//# sourceMappingURL=task-activity-query.service.js.map