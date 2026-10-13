import mongoose from "mongoose";
import { ProjectModel } from "./project.model.js";
import { ProjectMembershipModel } from "./project-membership.model.js";
import { AppError } from "../../middlewares/app-error.js";
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
    const { page, limit, search, status, sortBy = "createdAt", sortOrder = "desc", requesterId, requesterRole } = options;
    const skip = (page - 1) * limit;
    const conditions = [];
    if (status) {
        conditions.push({ status });
    }
    if (search) {
        conditions.push({
            $or: [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ]
        });
    }
    if (requesterRole !== "ADMIN") {
        const memberships = await ProjectMembershipModel.find({
            userId: requesterId
        })
            .select("projectId")
            .lean();
        const memberProjectIds = memberships.map((membership) => membership.projectId);
        conditions.push({
            $or: [
                { ownerId: requesterId },
                { _id: { $in: memberProjectIds } }
            ]
        });
    }
    const filter = conditions.length > 0
        ? { $and: conditions }
        : {};
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const [projects, total] = await Promise.all([
        ProjectModel.find(filter)
            .sort({ [sortBy]: sortDirection })
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
export const getProjectById = async (id, requesterId, requesterRole) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError("Invalid project ID", 400);
    }
    const project = await ProjectModel.findById(id);
    if (!project) {
        return undefined;
    }
    if (requesterRole === "ADMIN") {
        return toProject(project);
    }
    if (String(project.ownerId) === requesterId) {
        return toProject(project);
    }
    const membership = await ProjectMembershipModel.findOne({
        projectId: project._id,
        userId: requesterId
    });
    if (!membership) {
        throw new AppError("You do not have access to this project", 403);
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
export const updateOwnedProject = async (id, userId, data) => {
    const project = await ProjectModel.findOneAndUpdate({
        _id: id,
        ownerId: userId
    }, data, {
        new: true,
        runValidators: true
    });
    if (!project) {
        return undefined;
    }
    return toProject(project);
};
export const deleteOwnedProject = async (id, userId) => {
    const project = await ProjectModel.findOneAndDelete({
        _id: id,
        ownerId: userId
    });
    return project !== null;
};
//# sourceMappingURL=project.service.js.map