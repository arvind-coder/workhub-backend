import type { Request, Response } from "express";
import { AppError } from "../../middlewares/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { addProjectMember, getProjectMembers, removeProjectMember } from "./project-membership.service.js";
import type { ProjectMemberRole } from "./project-membership.model.js";

export const addMember = async (
  req: Request,
  res: Response
) => {
  const { projectId } = req.params;
  const { userId, role = "MEMBER" } = req.body;

  if (!projectId || Array.isArray(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }

  if (
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    throw new AppError("User ID is required", 400);
  }

  if (role !== "MEMBER" && role !== "PROJECT_MANAGER") {
    throw new AppError(
      "Role must be MEMBER or PROJECT_MANAGER",
      400
    );
  }

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  const membership = await addProjectMember(
    projectId,
    userId.trim(),
    role as ProjectMemberRole,
    req.authUser.userId,
    req.authUser.role
  );

  sendSuccess(res, membership, 201);
};


export const getMembers = async (
  req: Request,
  res: Response
) => {
  const { projectId } = req.params;

  if (!projectId || Array.isArray(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }

  if (!req.authUser) {
    throw new AppError("Authentication required", 401);
  }

  const members = await getProjectMembers(
    projectId,
    req.authUser.userId,
    req.authUser.role
  );

  sendSuccess(res, members);
};


export const removeMember = async (
  req: Request,
  res: Response
) => {
  const { projectId, userId } = req.params;

  if (
    !projectId ||
    Array.isArray(projectId) ||
    !userId ||
    Array.isArray(userId)
  ) {
    throw new AppError(
      "Invalid project ID or user ID",
      400
    );
  }

  if (!req.authUser) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  const result = await removeProjectMember(
    projectId,
    userId,
    req.authUser.userId,
    req.authUser.role
  );

  sendSuccess(res, result);
};
