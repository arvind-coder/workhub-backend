import { ProjectModel } from "./project.model.js";
const toProject = (project) => {
    return {
        id: String(project._id),
        name: project.name,
        description: project.description,
        ownerId: project.ownerId,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
    };
};
export const getProjects = async () => {
    const projects = await ProjectModel.find().sort({
        createdAt: -1
    });
    return projects.map(toProject);
};
export const getProjectById = async (id) => {
    const project = await ProjectModel.findById(id);
    if (!project) {
        return undefined;
    }
    return toProject(project);
};
export const createProject = async (name, description, ownerId) => {
    const project = await ProjectModel.create({
        name,
        description,
        ownerId
    });
    return toProject(project);
};
export const updateProject = async (id, data) => {
    const project = await ProjectModel.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    });
    if (!project) {
        return undefined;
    }
    return toProject(project);
};
export const deleteProject = async (id) => {
    const project = await ProjectModel.findByIdAndDelete(id);
    return project !== null;
};
//# sourceMappingURL=project.service.js.map