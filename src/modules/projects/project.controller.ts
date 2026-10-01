import type { Request, Response } from "express";

import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject
} from "./project.service.js";

import { AppError } from "../../middlewares/app-error.js";

export const testError = (_req: Request, _res: Response) => {
  throw new AppError("This is a test error", 400);
};

export const testUnknownError = (_req: Request, _res: Response) => {
  throw new Error("Database connection failed");
};

export const listProjects = (_req: Request, res: Response) => {
  const projects = getProjects();

  res.status(200).json({
    success: true,
    data: projects
  });
};

export const getProject = (req: Request, res: Response) => {
  const { id } = req.params;
if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  const project = getProjectById(id);

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

export const createNewProject = (req: Request, res: Response) => {
  const { name, description, ownerId } = req.body;

  const project = createProject(name, description, ownerId);

  res.status(201).json({
    success: true,
    data: project
  });
};

export const updateExistingProject = (req: Request, res: Response) => {
  const { id } = req.params;
 if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  const project = updateProject(id, req.body);

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

export const deleteExistingProject = (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || Array.isArray(id)) {
    throw new AppError("Invalid project id", 400);
  }
  const deleted = deleteProject(id);

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