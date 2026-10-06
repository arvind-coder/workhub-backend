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

const router = Router();

router.get("/", asyncHandler(listProjects));

router.get("/test-error", asyncHandler(testError));

router.get("/test-unknown-error", asyncHandler(testUnknownError));

router.get("/:id", asyncHandler(getProject));

router.post("/", asyncHandler(createNewProject));

router.patch("/:id", asyncHandler(updateExistingProject));

router.delete("/:id", asyncHandler(deleteExistingProject));

export default router;