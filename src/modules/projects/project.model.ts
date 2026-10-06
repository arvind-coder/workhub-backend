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

export const ProjectModel = model<ProjectDocument>(
  "Project",
  projectSchema
);