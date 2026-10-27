import { AppError } from "../../middlewares/app-error.js";

const MAX_PROJECT_NAME_LENGTH = 150;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;

export const validateCreateProject = (
  name: unknown,
  description: unknown,
  ownerId: unknown
) => {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new AppError("Project name is required", 400);
  }

  if (name.trim().length > MAX_PROJECT_NAME_LENGTH) {
    throw new AppError(
      `Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`,
      400
    );
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    throw new AppError("Project description is required", 400);
  }

  if (description.trim().length > MAX_PROJECT_DESCRIPTION_LENGTH) {
    throw new AppError(
      `Project description cannot exceed ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`,
      400
    );
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    throw new AppError("Project ownerId is required", 400);
  }
};

export const validateUpdateProject = (
  name: unknown,
  description: unknown,
  status: unknown
) => {
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new AppError("Project name must be a valid string", 400);
    }

    if (name.trim().length > MAX_PROJECT_NAME_LENGTH) {
      throw new AppError(
        `Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`,
        400
      );
    }
  }

  if (description !== undefined) {
    if (
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      throw new AppError(
        "Project description must be a valid string",
        400
      );
    }

    if (description.trim().length > MAX_PROJECT_DESCRIPTION_LENGTH) {
      throw new AppError(
        `Project description cannot exceed ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`,
        400
      );
    }
  }

  if (status !== undefined) {
    if (status !== "active" && status !== "archived") {
      throw new AppError(
        "Project status must be active or archived",
        400
      );
    }
  }
};