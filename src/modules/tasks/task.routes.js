import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { createNewTask, deleteExistingTask, getTaskDetails, listProjectTasks, updateExistingTask } from "./task.controller.js";
import { addTaskComment } from "./task-comment.controller.js";
const router = Router();
router.post("/:projectId/tasks", authMiddleware, asyncHandler(createNewTask));
router.get("/:projectId/tasks", authMiddleware, asyncHandler(listProjectTasks));
router.patch("/:projectId/tasks/:taskId", authMiddleware, asyncHandler(updateExistingTask));
router.delete("/:projectId/tasks/:taskId", authMiddleware, asyncHandler(deleteExistingTask));
router.get("/:projectId/tasks/:taskId", authMiddleware, asyncHandler(getTaskDetails));
router.post("/:projectId/tasks/:taskId/comments", authMiddleware, asyncHandler(addTaskComment));
export default router;
//# sourceMappingURL=task.routes.js.map