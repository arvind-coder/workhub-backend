import type { Request, Response } from "express";

import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject
} from "./project.service.js";

import { AppError } from "../../middlewares/app-error.js";
import { validateCreateProject, validateUpdateProject } from "./project.validation.js";
import type { ProjectStatus } from "./project.types.js";
import {
  sendPaginatedSuccess,
  sendSuccess
} from "../../utils/api-response.js";

export const testError = async (_req: Request, _res: Response) => {
  throw new AppError("This is a test error", 400);
};

export const testUnknownError = (_req: Request, _res: Response) => {
  throw new Error("Database connection failed");
};


export const listProjects = async (
  req: Request,
  res: Response
) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim()
      : undefined;

  const status =
    typeof req.query.status === "string"
      ? req.query.status
      : undefined;

  const sortBy =
    typeof req.query.sortBy === "string"
      ? req.query.sortBy
      : "createdAt";

  const sortOrder =
    typeof req.query.sortOrder === "string"
      ? req.query.sortOrder
      : "desc";

  if (page < 1) {
    throw new AppError(
      "Page must be greater than 0",
      400
    );
  }

  if (limit < 1 || limit > 100) {
    throw new AppError(
      "Limit must be between 1 and 100",
      400
    );
  }

  if (
    sortBy !== "name" &&
    sortBy !== "createdAt" &&
    sortBy !== "updatedAt"
  ) {
    throw new AppError(
      "sortBy must be name, createdAt or updatedAt",
      400
    );
  }

  if (
    sortOrder !== "asc" &&
    sortOrder !== "desc"
  ) {
    throw new AppError(
      "sortOrder must be asc or desc",
      400
    );
  }

  if (
    status !== undefined &&
    status !== "active" &&
    status !== "archived"
  ) {
    throw new AppError(
      "Status must be active or archived",
      400
    );
  }

  const result = await getProjects({
    page,
    limit,
    ...(search !== undefined ? { search } : {}),
    ...(status !== undefined ? { status: status as ProjectStatus } : {}),
    sortBy: sortBy as "name" | "createdAt" | "updatedAt",
    sortOrder: sortOrder as "asc" | "desc"
  });

  sendPaginatedSuccess(res, result.projects, {
  page: result.page,
  limit: result.limit,
  total: result.total,
  totalPages: result.totalPages
});
};

export const getProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  const project = await getProjectById(id);

  if (!project) {
    res.status(404).json({
      success: false,
      message: "Project not found"
    });

    return;
  }

  sendSuccess(res, project);
};

export const createNewProject = async (req: Request, res: Response) => {
  const { name, description, ownerId } = req.body;

  validateCreateProject(name, description, ownerId);
  const project = await createProject(name, description, ownerId);

  sendSuccess(res, project, 201);
};

export const updateExistingProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  const { name, description, status } = req.body;

  validateUpdateProject(name, description, status);

  const project = await updateProject(id, {
    name,
    description,
    status
  });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  sendSuccess(res, project);
};

export const deleteExistingProject = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  const deleted = await deleteProject(id);

  if (!deleted) {
    res.status(404).json({
      success: false,
      message: "Project not found"
    });

    return;
  }

  sendSuccess(res, {
  message: "Project deleted successfully"
});
};