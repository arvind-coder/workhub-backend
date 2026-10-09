import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import {
  createNewProject,
  deleteExistingProject,
  getProject,
  listProjects,
  testError,
  testUnknownError,
  updateExistingProject
} from "./project.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authMiddleware, asyncHandler(listProjects));

router.get("/test-error", asyncHandler(testError));

router.get("/test-unknown-error", asyncHandler(testUnknownError));

router.get("/:id", authMiddleware, asyncHandler(getProject));

router.post("/", authMiddleware, asyncHandler(createNewProject));

router.patch("/:id", authMiddleware, asyncHandler(updateExistingProject));

router.delete("/:id", authMiddleware, asyncHandler(deleteExistingProject));

export default router;