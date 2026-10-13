
import mongoose, { Types } from "mongoose";

import { AppError } from "../../middlewares/app-error.js";
import { ProjectModel } from "../projects/project.model.js";
import { ProjectMembershipModel } from "../projects/project-membership.model.js";
import { TaskModel } from "./task.model.js";
import { TaskCommentModel } from "./task-comment.model.js";

export const createTaskComment = async (
  projectId: string,
  taskId: string,
  requesterId: string,
  requesterRole: string,
  message: string
) => {
  if (
    !mongoose.isValidObjectId(projectId) ||
    !mongoose.isValidObjectId(taskId) ||
    !mongoose.isValidObjectId(requesterId)
  ) {
    throw new AppError(
      "Invalid project, task or user ID",
      400
    );
  }

  const normalizedMessage = message.trim();

  if (
    normalizedMessage.length < 1 ||
    normalizedMessage.length > 2000
  ) {
    throw new AppError(
      "Comment must be between 1 and 2000 characters",
      400
    );
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
      userId: requesterId
    });

    if (!membership) {
      throw new AppError(
        "You do not have access to this project",
        403
      );
    }
  }

  const task = await TaskModel.findOne({
    _id: new Types.ObjectId(taskId),
    projectId: project._id
  });

  if (!task) {
    throw new AppError("Task not found in this project", 404);
  }

  const comment = await TaskCommentModel.create({
    projectId: project._id,
    taskId: task._id,
    userId: new Types.ObjectId(requesterId),
    message: normalizedMessage
  });

  return {
    id: String(comment._id),
    projectId: String(comment.projectId),
    taskId: String(comment.taskId),
    userId: String(comment.userId),
    message: comment.message,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
};
