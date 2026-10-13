
import type {
  TaskPriority,
  TaskStatus
} from "./task.model.js";

export interface CreateTaskInput {
  title: string;
  description: string;
  assignedTo?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedTo?: string;
  createdBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
}


export interface GetProjectTasksOptions {
  page: number;
  limit: number;
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  overdue?: boolean;
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface GetProjectTasksResult {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
