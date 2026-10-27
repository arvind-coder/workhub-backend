
import mongoose, {
  Types,
  type QueryFilter,
} from "mongoose";

import { AppError } from "../../middlewares/app-error.js";
import { escapeRegex } from "../../utils/validation.js";
import { ProjectModel } from "../projects/project.model.js";
import { ProjectMembershipModel } from "../projects/project-membership.model.js";
import { UserModel } from "../users/user.model.js";
import { TaskModel } from "./task.model.js";
import { createTaskActivity } from "./task-activity.service.js";

import type { Task } from "./task.types.js";
import type { TaskDocument } from "./task.model.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  GetProjectTasksOptions,
  GetProjectTasksResult
} from "./task.types.js";

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
  dueDate?: Date;
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
  ...(task.dueDate ? { dueDate: task.dueDate } : {}),
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

// Validate project access for the logged-in user.
export const getAccessibleProject = async (
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
    priority: input.priority ?? "MEDIUM",
    ...(input.dueDate
      ? { dueDate: new Date(input.dueDate) }
      : {}),
  });


  await createTaskActivity({
    projectId: task.projectId,
    taskId: task._id,
    userId: requesterId,
    action: "TASK_CREATED",
    message: `Task "${task.title}" was created`,
    metadata: {
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo
        ? String(task.assignedTo)
        : null,
    },
  });


  return toTask(task);
};

// Get all tasks belonging to a project.

export const getProjectTasks = async (
  projectId: string,
  requesterId: string,
  requesterRole: string,
  options: GetProjectTasksOptions
): Promise<GetProjectTasksResult> => {
  const project = await getAccessibleProject(
    projectId,
    requesterId,
    requesterRole
  );

  const {
    page,
    limit,
    search,
    status,
    priority,
    assignedTo,
    overdue,
    sortBy = "createdAt",
    sortOrder = "desc"
  } = options;

  if (
    assignedTo !== undefined &&
    !mongoose.isValidObjectId(assignedTo)
  ) {
    throw new AppError("Invalid assigned user ID", 400);
  }

  const filter: QueryFilter<TaskDocument> = {
  projectId: project._id,
  ...(status ? { status } : {}),
  ...(priority ? { priority } : {}),
  ...(assignedTo
    ? { assignedTo: new Types.ObjectId(assignedTo) }
    : {}),
  ...(overdue
    ? {
        $and: [
          { dueDate: { $lt: new Date() } },
          { status: { $ne: "DONE" } },
        ],
      }
    : {}),
  ...(search
    ? {
        $or: [
          { title: { $regex: escapeRegex(search), $options: "i" } },
          {
            description: {
              $regex: escapeRegex(search),
              $options: "i"
            }
          }
        ]
      }
    : {}),
};

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const [tasks, total] = await Promise.all([
    TaskModel.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit),

    TaskModel.countDocuments(filter)
  ]);

  return {
    tasks: tasks.map(toTask),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};



export const updateTask = async (
  projectId: string,
  taskId: string,
  requesterId: string,
  requesterRole: string,
  data: UpdateTaskInput
): Promise<Task> => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400);
  }

  const project = await getAccessibleProject(
    projectId,
    requesterId,
    requesterRole
  );

  const task = await TaskModel.findOne({
    _id: taskId,
    projectId: project._id
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }


  const previousStatus = task.status;
  const previousAssignedTo = task.assignedTo
    ? String(task.assignedTo)
    : null;

  const previousTitle = task.title;
  const previousDescription = task.description;
  const previousPriority = task.priority;


  const membership = await ProjectMembershipModel.findOne({
    projectId: project._id,
    userId: requesterId
  });

  const canManage =
    requesterRole === "ADMIN" ||
    String(project.ownerId) === requesterId ||
    membership?.role === "PROJECT_MANAGER";

  // Assigned members may change only their task's status.
  if (!canManage) {
    const isAssignedMember =
      task.assignedTo !== undefined &&
      String(task.assignedTo) === requesterId;

    const fields = Object.keys(data);
    const onlyStatus =
      fields.length === 1 && fields[0] === "status";

    if (!isAssignedMember || !onlyStatus) {
      throw new AppError(
        "You do not have permission to update this task",
        403
      );
    }
  }

  if (data.assignedTo !== undefined && data.assignedTo !== null) {
    if (!mongoose.isValidObjectId(data.assignedTo)) {
      throw new AppError("Invalid assigned user ID", 400);
    }

    const assigneeId = new Types.ObjectId(data.assignedTo);

    const assignee = await UserModel.findById(assigneeId)
      .select("_id");

    if (!assignee) {
      throw new AppError("Assigned user not found", 404);
    }

    const isProjectOwner =
      String(project.ownerId) === String(assigneeId);

    if (!isProjectOwner) {
      const assigneeMembership =
        await ProjectMembershipModel.findOne({
          projectId: project._id,
          userId: assigneeId
        });

      if (!assigneeMembership) {
        throw new AppError(
          "Assignee must be a member of this project",
          400
        );
      }
    }

    task.assignedTo = assigneeId;
  } else if (data.assignedTo === null) {
    task.set("assignedTo", undefined);
  }

  if (data.title !== undefined) {
    task.title = data.title.trim();
  }

  if (data.description !== undefined) {
    task.description = data.description.trim();
  }

  if (data.status !== undefined) {
    task.status = data.status;
  }

  if (data.priority !== undefined) {
    task.priority = data.priority;
  }
  if (data.dueDate !== undefined) {
    if (data.dueDate === null) {
      task.set("dueDate", undefined);
    } else {
      task.dueDate = new Date(data.dueDate);
    }
  }

  await task.save();

  // Log status changes.
  if (previousStatus !== task.status) {
    await createTaskActivity({
      projectId: task.projectId,
      taskId: task._id,
      userId: requesterId,
      action: "STATUS_CHANGED",
      message: `Task status changed from ${previousStatus} to ${task.status}`,
      metadata: {
        oldStatus: previousStatus,
        newStatus: task.status,
      },
    });
  }

  // Log assignee changes.
  const currentAssignedTo = task.assignedTo
    ? String(task.assignedTo)
    : null;

  if (previousAssignedTo !== currentAssignedTo) {
    await createTaskActivity({
      projectId: task.projectId,
      taskId: task._id,
      userId: requesterId,
      action: "ASSIGNEE_CHANGED",
      message: "Task assignee was changed",
      metadata: {
        oldAssignedTo: previousAssignedTo,
        newAssignedTo: currentAssignedTo,
      },
    });
  }

  // Log changes to task details.
  const changes: Record<string, unknown> = {};

  if (previousTitle !== task.title) {
    changes.title = {
      old: previousTitle,
      new: task.title,
    };
  }

  if (previousDescription !== task.description) {
    changes.description = {
      old: previousDescription,
      new: task.description,
    };
  }

  if (previousPriority !== task.priority) {
    changes.priority = {
      old: previousPriority,
      new: task.priority,
    };
  }

  if (Object.keys(changes).length > 0) {
    await createTaskActivity({
      projectId: task.projectId,
      taskId: task._id,
      userId: requesterId,
      action: "TASK_UPDATED",
      message: "Task details were updated",
      metadata: { changes },
    });
  }

  return toTask(task);

};



export const deleteTask = async (
  projectId: string,
  taskId: string,
  requesterId: string,
  requesterRole: string
): Promise<void> => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400);
  }

  const project = await getAccessibleProject(
    projectId,
    requesterId,
    requesterRole
  );

  const task = await TaskModel.findOne({
    _id: taskId,
    projectId: project._id
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  const membership = await ProjectMembershipModel.findOne({
    projectId: project._id,
    userId: requesterId
  });

  const canDelete =
    requesterRole === "ADMIN" ||
    String(project.ownerId) === requesterId ||
    membership?.role === "PROJECT_MANAGER";

  if (!canDelete) {
    throw new AppError(
      "You do not have permission to delete this task",
      403
    );
  }


  await task.deleteOne();

  await createTaskActivity({
    projectId: project._id,
    taskId: task._id,
    userId: requesterId,
    action: "TASK_DELETED",
    message: `Task "${task.title}" was deleted`,
    metadata: {
      title: task.title,
    },
  });

};


export const getTaskById = async (
  projectId: string,
  taskId: string,
  requesterId: string,
  requesterRole: string
): Promise<Task> => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400);
  }

  const project = await getAccessibleProject(
    projectId,
    requesterId,
    requesterRole
  );

  const task = await TaskModel.findOne({
    _id: taskId,
    projectId: project._id
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return toTask(task);
};
