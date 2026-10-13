
import { Schema, model, Types } from "mongoose";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE";

export type TaskPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface TaskDocument {
  title: string;
  description: string;
  dueDate?: Date;
  projectId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    dueDate: {
      type: Date,
      required: false,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "DONE"],
      default: "TODO",
      required: true
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common task queries.
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1 });

export const TaskModel = model<TaskDocument>(
  "Task",
  taskSchema
);
