import { Schema, model } from "mongoose";

import type { ProjectStatus } from "./project.types.js";

interface ProjectDocument {
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    ownerId: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

projectSchema.index({ ownerId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

export const ProjectModel = model<ProjectDocument>(
  "Project",
  projectSchema
);