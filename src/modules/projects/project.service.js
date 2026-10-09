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
export const getProjects = async (options) => {
    const { page, limit, search, status, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) {
        filter.status = status;
    }
    if (search) {
        filter.$or = [
            {
                name: {
                    $regex: search,
                    $options: "i"
                }
            },
            {
                description: {
                    $regex: search,
                    $options: "i"
                }
            }
        ];
    }
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const [projects, total] = await Promise.all([
        ProjectModel.find(filter)
            .sort({
            [sortBy]: sortDirection
        })
            .skip(skip)
            .limit(limit),
        ProjectModel.countDocuments(filter)
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
        projects: projects.map(toProject),
        total,
        page,
        limit,
        totalPages
    };
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