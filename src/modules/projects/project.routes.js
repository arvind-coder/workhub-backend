import { Router } from "express";
import { createNewProject, deleteExistingProject, getProject, listProjects, testError, testUnknownError, updateExistingProject } from "./project.controller.js";
const router = Router();
router.get("/", listProjects);
router.get("/test-error", testError);
router.get("/test-unknown-error", testUnknownError);
router.get("/:id", getProject);
router.post("/", createNewProject);
router.patch("/:id", updateExistingProject);
router.delete("/:id", deleteExistingProject);
export default router;
//# sourceMappingURL=project.routes.js.map