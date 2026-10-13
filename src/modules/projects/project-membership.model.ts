import { Schema, model, Types } from "mongoose";

export type ProjectMemberRole =
  | "PROJECT_MANAGER"
  | "MEMBER";

export interface ProjectMembershipDocument {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ProjectMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

const projectMembershipSchema =
  new Schema<ProjectMembershipDocument>(
    {
      projectId: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
      },

      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      role: {
        type: String,
        enum: ["PROJECT_MANAGER", "MEMBER"],
        default: "MEMBER",
        required: true
      }
    },
    {
      timestamps: true
    }
  );

projectMembershipSchema.index(
  { projectId: 1, userId: 1 },
  { unique: true }
);

projectMembershipSchema.index({ userId: 1 });

export const ProjectMembershipModel =
  model<ProjectMembershipDocument>(
    "ProjectMembership",
    projectMembershipSchema
  );