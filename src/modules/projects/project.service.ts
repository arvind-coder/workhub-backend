import { randomUUID } from "node:crypto";
import type { Project, ProjectStatus } from "./project.types.js";

const projects: Project[] = [];

export const getProjects = (): Project[] => {
  return projects;
};

export const getProjectById = (id: string): Project | undefined => {
  return projects.find((project) => project.id === id);
};

export const createProject = (
  name: string,
  description: string,
  ownerId: string
): Project => {
  const now = new Date();

  const project: Project = {
    id: randomUUID(),
    name,
    description,
    ownerId,
    status: "active",
    createdAt: now,
    updatedAt: now
  };

  projects.push(project);

  return project;
};

export const updateProject = (
  id: string,
  data: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
  }
): Project | undefined => {
  const project = projects.find((project) => project.id === id);

  if (!project) {
    return undefined;
  }

  if (data.name !== undefined) {
    project.name = data.name;
  }

  if (data.description !== undefined) {
    project.description = data.description;
  }

  if (data.status !== undefined) {
    project.status = data.status;
  }

  project.updatedAt = new Date();

  return project;
};

export const deleteProject = (id: string): boolean => {
  const index = projects.findIndex((project) => project.id === id);

  if (index === -1) {
    return false;
  }

  projects.splice(index, 1);

  return true;
};