import { ProjectModel } from "./project.model.js";

import type { Project, ProjectStatus } from "./project.types.js";

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
    sortOrder = "desc"
  } = options;

  const skip = (page - 1) * limit;

  const filter: {
    status?: ProjectStatus;
    $or?: Array<{
      name: { $regex: string; $options: string };
    } | {
      description: { $regex: string; $options: string };
    }>;
  } = {};

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      {
        name: {
          $regex: search,
          $options: "i"
        }
      },
      {
        description: {
          $regex: search,
          $options: "i"
        }
      }
    ];
  }

const sortDirection = sortOrder === "asc" ? 1 : -1;

 const [projects, total] = await Promise.all([
  ProjectModel.find(filter)
    .sort({
      [sortBy]: sortDirection
    })
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
  id: string
): Promise<Project | undefined> => {
  const project = await ProjectModel.findById(id);

  if (!project) {
    return undefined;
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