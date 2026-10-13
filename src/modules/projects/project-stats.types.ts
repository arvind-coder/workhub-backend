export interface StatusCounts {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
}

export interface ProjectStatsSummary extends StatusCounts {
  highPriority: number;
  overdue: number;
}

export interface AssigneeStats extends StatusCounts {
  assigneeId: string;
  assigneeName: string | null;
}

export interface ProjectStats {
  projectId: string;
  summary: ProjectStatsSummary;
  tasksByAssignee: AssigneeStats[];
  unassigned: StatusCounts;
}
