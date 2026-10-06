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

  if (page < 1) {
    throw new AppError("Page must be greater than 0", 400);
  }

  if (limit < 1 || limit > 100) {
    throw new AppError(
      "Limit must be between 1 and 100",
      400
    );
  }

  const result = await getProjects({
    page,
    limit
  });

  res.status(200).json({
    success: true,
    data: result.projects,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages
    }
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

  res.status(200).json({
    success: true,
    data: project
  });
};

export const createNewProject = async (req: Request, res: Response) => {
  const { name, description, ownerId } = req.body;
  
  validateCreateProject(name, description, ownerId);
  const project = await createProject(name, description, ownerId);

  res.status(201).json({
    success: true,
    data: project
  });
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

  res.status(200).json({
    success: true,
    data: project
  });
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

  res.status(200).json({
    success: true,
    message: "Project deleted successfully"
  });
};