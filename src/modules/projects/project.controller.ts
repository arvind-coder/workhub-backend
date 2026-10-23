import type { Request, Response } from "express";

import {
  createProject,
  deleteOwnedProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateOwnedProject,
  updateProject
} from "./project.service.js";

import { AppError } from "../../middlewares/app-error.js";
import { validateCreateProject, validateUpdateProject } from "./project.validation.js";
import { parsePositiveInt } from "../../utils/validation.js";
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
  if (!req.authUser) {
  throw new AppError("Authentication required", 401);
}
  const page = parsePositiveInt(req.query.page, 1, "Page");
  const limit = parsePositiveInt(req.query.limit, 10, "Limit");

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

  if (limit > 100) {
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
  requesterId: req.authUser.userId,
  requesterRole: req.authUser.role,
  ...(search !== undefined ? { search } : {}),
  ...(status !== undefined
    ? { status: status as ProjectStatus }
    : {}),
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
  if (!req.authUser) {
  throw new AppError("Authentication required", 401);
}
  const project = await getProjectById(
  id,
  req.authUser.userId,
  req.authUser.role
);

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  sendSuccess(res, project);
};

export const createNewProject = async (
  req: Request,
  res: Response
) => {
  const { name, description } = req.body;

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  validateCreateProject(
    name,
    description,
    req.authUser.userId
  );

  const project = await createProject(
    name.trim(),
    description.trim(),
    req.authUser.userId
  );

  sendSuccess(res, project, 201);
};

export const updateExistingProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  const { name, description, status } = req.body;

  validateUpdateProject(name, description, status);

  // Build update object using only supported fields
  const updateData: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
  } = {};

  if (name !== undefined) {
    updateData.name = name.trim();
  }

  if (description !== undefined) {
    updateData.description = description.trim();
  }

  if (status !== undefined) {
    updateData.status = status;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(
      "At least one field is required to update",
      400
    );
  }

  const project = await updateOwnedProject(
    id,
    req.authUser.userId,
    updateData
  );

  if (!project) {
    throw new AppError(
      "Project not found or access denied",
      404
    );
  }

  sendSuccess(res, project);
};

export const deleteExistingProject = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  const deleted = await deleteOwnedProject(
    id,
    req.authUser.userId
  );

  if (!deleted) {
    throw new AppError(
      "Project not found or access denied",
      404
    );
  }

  sendSuccess(res, {
    message: "Project deleted successfully"
  });
};