
import mongoose, { Types } from "mongoose";

import { AppError } from "../../middlewares/app-error.js";
import { ProjectModel } from "../projects/project.model.js";
import { ProjectMembershipModel } from "../projects/project-membership.model.js";
import { UserModel } from "../users/user.model.js";
import { TaskModel } from "./task.model.js";

import type { Task } from "./task.types.js";
import type { CreateTaskInput } from "./task.types.js";

// Convert MongoDB document to API response object.
const toTask = (task: {
  _id: Types.ObjectId;
  title: string;
  description: string;
  projectId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: Task["status"];
  priority: Task["priority"];
  createdAt: Date;
  updatedAt: Date;
}): Task => ({
  id: String(task._id),
  title: task.title,
  description: task.description,
  projectId: String(task.projectId),
  ...(task.assignedTo
    ? { assignedTo: String(task.assignedTo) }
    : {}),
  createdBy: String(task.createdBy),
  status: task.status,
  priority: task.priority,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

// Validate project access for the logged-in user.
const getAccessibleProject = async (
  projectId: string,
  requesterId: string,
  requesterRole: string
) => {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }

  const project = await ProjectModel.findById(projectId);

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  if (
    requesterRole === "ADMIN" ||
    String(project.ownerId) === requesterId
  ) {
    return project;
  }

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

  return project;
};

// Create a task inside a project.
export const createTask = async (
  projectId: string,
  requesterId: string,
  requesterRole: string,
  input: CreateTaskInput
): Promise<Task> => {
  const project = await getAccessibleProject(
    projectId,
    requesterId,
    requesterRole
  );

  let assignedTo: Types.ObjectId | undefined;

  if (input.assignedTo !== undefined) {
    if (!mongoose.isValidObjectId(input.assignedTo)) {
      throw new AppError("Invalid assigned user ID", 400);
    }

    const assigneeId = new Types.ObjectId(input.assignedTo);

    const assignee = await UserModel.findById(assigneeId)
      .select("_id");

    if (!assignee) {
      throw new AppError("Assigned user not found", 404);
    }

    const isProjectOwner =
      String(project.ownerId) === String(assigneeId);

    if (!isProjectOwner) {
      const membership = await ProjectMembershipModel.findOne({
        projectId: project._id,
        userId: assigneeId
      });

      if (!membership) {
        throw new AppError(
          "Assignee must be a member of this project",
          400
        );
      }
    }

    assignedTo = assigneeId;
  }

  const task = await TaskModel.create({
    title: input.title.trim(),
    description: input.description.trim(),
    projectId: project._id,
    createdBy: new Types.ObjectId(requesterId),
    ...(assignedTo ? { assignedTo } : {}),
    status: input.status ?? "TODO",
    priority: input.priority ?? "MEDIUM"
  });

  return toTask(task);
};

// Get all tasks belonging to a project.
export const getProjectTasks = async (
  projectId: string,
  requesterId: string,
  requesterRole: string
): Promise<Task[]> => {
  const project = await getAccessibleProject(
    projectId,
    requesterId,
    requesterRole
  );

  const tasks = await TaskModel.find({
    projectId: project._id
  }).sort({ createdAt: -1 });

  return tasks.map(toTask);
};
