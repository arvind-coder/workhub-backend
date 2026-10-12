
import { Router } from "express";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../middlewares/async-handler.js";

import {
  createNewTask,
  listProjectTasks,
  updateExistingTask
} from "./task.controller.js";


const router = Router();

router.post(
  "/:projectId/tasks",
  authMiddleware,
  asyncHandler(createNewTask)
);

router.get(
  "/:projectId/tasks",
  authMiddleware,
  asyncHandler(listProjectTasks)
);

router.patch(
  "/:projectId/tasks/:taskId",
  authMiddleware,
  asyncHandler(updateExistingTask)
);

export default router;
