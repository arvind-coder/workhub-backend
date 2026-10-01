import { Router } from "express";

import {
  createNewProject,
  deleteExistingProject,
  getProject,
  listProjects,
  updateExistingProject
} from "./project.controller.js";

const router = Router();

router.get("/", listProjects);

router.get("/:id", getProject);

router.post("/", createNewProject);

router.patch("/:id", updateExistingProject);

router.delete("/:id", deleteExistingProject);

export default router;