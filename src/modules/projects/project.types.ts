export type ProjectStatus = "active" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}