import { randomUUID } from "node:crypto";
const projects = [];
export const getProjects = () => {
    return projects;
};
export const getProjectById = (id) => {
    return projects.find((project) => project.id === id);
};
export const createProject = (name, description, ownerId) => {
    const now = new Date();
    const project = {
        id: randomUUID(),
        name,
        description,
        ownerId,
        status: "active",
        createdAt: now,
        updatedAt: now
    };
    projects.push(project);
    return project;
};
export const updateProject = (id, data) => {
    const project = projects.find((project) => project.id === id);
    if (!project) {
        return undefined;
    }
    if (data.name !== undefined) {
        project.name = data.name;
    }
    if (data.description !== undefined) {
        project.description = data.description;
    }
    if (data.status !== undefined) {
        project.status = data.status;
    }
    project.updatedAt = new Date();
    return project;
};
export const deleteProject = (id) => {
    const index = projects.findIndex((project) => project.id === id);
    if (index === -1) {
        return false;
    }
    projects.splice(index, 1);
    return true;
};
//# sourceMappingURL=project.service.js.map