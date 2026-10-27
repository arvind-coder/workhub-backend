import mongoose from "mongoose";
import {
  ProjectModel,
  type ProjectDocument
} from "./project.model.js";

import type { Project, ProjectStatus } from "./project.types.js";

import { ProjectMembershipModel } from "./project-membership.model.js";

import { AppError } from "../../middlewares/app-error.js";
import { escapeRegex } from "../../utils/validation.js";

const toProject = (project: {
  _id: unknown;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}): Project => {
  return {
    id: String(project._id),
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
};

export interface GetProjectsOptions {
  page: number;
  limit: number;
  search?: string;
  status?: ProjectStatus;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  requesterId: string;
  requesterRole: string;
}

export interface GetProjectsResult {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getProjects = async (
  options: GetProjectsOptions
): Promise<GetProjectsResult> => {
  const {
    page,
    limit,
    search,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
    requesterId,
    requesterRole
  } = options;

  const skip = (page - 1) * limit;

const conditions: Record<string, unknown>[] = [];

if (status) {
  conditions.push({ status });
}

if (search) {
  conditions.push({
    $or: [
      { name: { $regex: escapeRegex(search), $options: "i" } },
      { description: { $regex: escapeRegex(search), $options: "i" } }
    ]
  });
}

if (requesterRole !== "ADMIN") {
  const memberships = await ProjectMembershipModel.find({
    userId: requesterId
  })
    .select("projectId")
    .lean();

  const memberProjectIds = memberships.map(
    (membership) => membership.projectId
  );

  conditions.push({
    $or: [
      { ownerId: requesterId },
      { _id: { $in: memberProjectIds } }
    ]
  });
}

const filter =
  conditions.length > 0
    ? { $and: conditions }
    : {};

const sortDirection = sortOrder === "asc" ? 1 : -1;

const [projects, total] = await Promise.all([
  ProjectModel.find(filter)
    .sort({ [sortBy]: sortDirection })
    .skip(skip)
    .limit(limit),

  ProjectModel.countDocuments(filter)
]);

const totalPages = Math.ceil(total / limit);

return {
  projects: projects.map(toProject),
  total,
  page,
  limit,
  totalPages
};
};


export const getProjectById = async (
  id: string,
  requesterId: string,
  requesterRole: string
): Promise<Project | undefined> => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid project ID", 400);
  }

  const project = await ProjectModel.findById(id);

  if (!project) {
    return undefined;
  }

  if (requesterRole === "ADMIN") {
    return toProject(project);
  }

  if (String(project.ownerId) === requesterId) {
    return toProject(project);
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

  return toProject(project);
};


export const createProject = async (
  name: string,
  description: string,
  ownerId: string
): Promise<Project> => {
  const project = await ProjectModel.create({
    name,
    description,
    ownerId
  });

  return toProject(project);
};

export const updateProject = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
  }
): Promise<Project | undefined> => {
  const project = await ProjectModel.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true
    }
  );

  if (!project) {
    return undefined;
  }

  return toProject(project);
};

export const deleteProject = async (
  id: string
): Promise<boolean> => {
  const project = await ProjectModel.findByIdAndDelete(id);

  return project !== null;
};

export const updateOwnedProject = async (
  id: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
  }
): Promise<Project | undefined> => {
  const project = await ProjectModel.findOneAndUpdate(
    {
      _id: id,
      ownerId: userId
    },
    data,
    {
      new: true,
      runValidators: true
    }
  );

  if (!project) {
    return undefined;
  }

  return toProject(project);
};

export const deleteOwnedProject = async (
  id: string,
  userId: string
): Promise<boolean> => {
  const project = await ProjectModel.findOneAndDelete({
    _id: id,
    ownerId: userId
  });

  return project !== null;
};