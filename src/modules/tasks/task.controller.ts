
import type { Request, Response } from "express";

import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";

import {
  createTask,
  getProjectTasks,
  updateTask
} from "./task.service.js";

import {
  validateCreateTask,
  validateUpdateTask
} from "./task.validation.js";

import type {
  CreateTaskInput,
  UpdateTaskInput
} from "./task.types.js";

import type {
  TaskPriority,
  TaskStatus
} from "./task.model.js";

export const createNewTask = async (
  req: Request,
  res: Response
) => {
  const { projectId } = req.params;

  if (!projectId || Array.isArray(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  const {
    title,
    description,
    assignedTo,
    status,
    priority
  } = req.body;

  validateCreateTask(
    title,
    description,
    status,
    priority
  );

  if (
    assignedTo !== undefined &&
    typeof assignedTo !== "string"
  ) {
    throw new AppError(
      "assignedTo must be a user ID string",
      400
    );
  }

  const input: CreateTaskInput = {
    title: title.trim(),
    description: description.trim(),
    ...(assignedTo !== undefined
      ? { assignedTo: assignedTo.trim() }
      : {}),
    ...(status !== undefined
      ? { status: status as TaskStatus }
      : {}),
    ...(priority !== undefined
      ? { priority: priority as TaskPriority }
      : {})
  };

  const task = await createTask(
    projectId,
    req.authUser.userId,
    req.authUser.role,
    input
  );

  sendSuccess(res, task, 201);
};

export const listProjectTasks = async (
  req: Request,
  res: Response
) => {
  const { projectId } = req.params;

  if (!projectId || Array.isArray(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  const tasks = await getProjectTasks(
    projectId,
    req.authUser.userId,
    req.authUser.role
  );

  sendSuccess(res, tasks);
};



export const updateExistingTask = async (
  req: Request,
  res: Response
) => {
  const { projectId, taskId } = req.params;

  if (
    !projectId ||
    Array.isArray(projectId) ||
    !taskId ||
    Array.isArray(taskId)
  ) {
    throw new AppError(
      "Invalid project ID or task ID",
      400
    );
  }

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    throw new AppError("Request body must be an object", 400);
  }

  validateUpdateTask(req.body);

  const data = req.body as UpdateTaskInput;

  const task = await updateTask(
    projectId,
    taskId,
    req.authUser.userId,
    req.authUser.role,
    data
  );

  sendSuccess(res, task);
};
