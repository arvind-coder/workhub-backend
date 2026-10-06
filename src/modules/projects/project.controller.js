import { createProject, deleteProject, getProjectById, getProjects, updateProject } from "./project.service.js";
import { AppError } from "../../middlewares/app-error.js";
import { validateCreateProject, validateUpdateProject } from "./project.validation.js";
export const testError = async (_req, _res) => {
    throw new AppError("This is a test error", 400);
};
export const testUnknownError = (_req, _res) => {
    throw new Error("Database connection failed");
};
export const listProjects = async (_req, res) => {
    const projects = getProjects();
    res.status(200).json({
        success: true,
        data: projects
    });
};
export const getProject = async (req, res) => {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
        throw new AppError("Invalid project id", 400);
    }
    const project = await getProjectById(id);
    if (!project) {
        res.status(404).json({
            success: false,
            message: "Project not found"
        });
        return;
    }
    res.status(200).json({
        success: true,
        data: project
    });
};
export const createNewProject = async (req, res) => {
    const { name, description, ownerId } = req.body;
    validateCreateProject(name, description, ownerId);
    const project = await createProject(name, description, ownerId);
    res.status(201).json({
        success: true,
        data: project
    });
};
export const updateExistingProject = async (req, res) => {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
        throw new AppError("Invalid project id", 400);
    }
    const { name, description, status } = req.body;
    validateUpdateProject(name, description, status);
    const project = await updateProject(id, {
        name,
        description,
        status
    });
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    res.status(200).json({
        success: true,
        data: project
    });
};
export const deleteExistingProject = async (req, res) => {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
        throw new AppError("Invalid project id", 400);
    }
    const deleted = await deleteProject(id);
    if (!deleted) {
        res.status(404).json({
            success: false,
            message: "Project not found"
        });
        return;
    }
    res.status(200).json({
        success: true,
        message: "Project deleted successfully"
    });
};
//# sourceMappingURL=project.controller.js.map