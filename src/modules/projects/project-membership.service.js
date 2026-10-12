import mongoose, { Types } from "mongoose";
import { AppError } from "../../middlewares/app-error.js";
import { UserModel } from "../users/user.model.js";
import { ProjectModel } from "./project.model.js";
import { ProjectMembershipModel } from "./project-membership.model.js";
export const addProjectMember = async (projectId, userId, role, requesterId, requesterRole) => {
    if (!mongoose.isValidObjectId(projectId) ||
        !mongoose.isValidObjectId(userId)) {
        throw new AppError("Invalid project or user ID", 400);
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    let canManage = requesterRole === "ADMIN";
    if (String(project.ownerId) === requesterId) {
        canManage = true;
    }
    if (!canManage) {
        const membership = await ProjectMembershipModel.findOne({
            projectId: project._id,
            userId: requesterId,
            role: "PROJECT_MANAGER"
        });
        canManage = Boolean(membership);
    }
    if (!canManage) {
        throw new AppError("You cannot manage members of this project", 403);
    }
    const targetUser = await UserModel.findById(userId);
    if (!targetUser) {
        throw new AppError("User not found", 404);
    }
    const existingMembership = await ProjectMembershipModel.findOne({
        projectId: project._id,
        userId: targetUser._id
    });
    if (existingMembership) {
        throw new AppError("User is already a member of this project", 409);
    }
    try {
        return await ProjectMembershipModel.create({
            projectId: project._id,
            userId: targetUser._id,
            role
        });
    }
    catch (error) {
        // The unique index also prevents concurrent duplicate inserts.
        if (error instanceof mongoose.mongo.MongoServerError &&
            error.code === 11000) {
            throw new AppError("User is already a member of this project", 409);
        }
        throw error;
    }
};
export const getProjectMembers = async (projectId, requesterId, requesterRole) => {
    if (!mongoose.isValidObjectId(projectId)) {
        throw new AppError("Invalid project ID", 400);
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    // Admin, project owner, or project member can view members.
    let canView = requesterRole === "ADMIN";
    if (String(project.ownerId) === requesterId) {
        canView = true;
    }
    if (!canView) {
        const membership = await ProjectMembershipModel.findOne({
            projectId: project._id,
            userId: requesterId
        });
        canView = Boolean(membership);
    }
    if (!canView) {
        throw new AppError("You do not have access to this project", 403);
    }
    const members = await ProjectMembershipModel.find({
        projectId: project._id
    })
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .lean();
    return members.map((membership) => {
        const user = membership.userId;
        if (!user) {
            throw new AppError("Invalid project member data", 500);
        }
        return {
            id: String(membership._id),
            projectId: String(membership.projectId),
            user: {
                id: String(user._id),
                name: user.name,
                email: user.email
            },
            role: membership.role,
            createdAt: membership.createdAt
        };
    });
};
export const removeProjectMember = async (projectId, userId, requesterId, requesterRole) => {
    if (!mongoose.isValidObjectId(projectId) ||
        !mongoose.isValidObjectId(userId)) {
        throw new AppError("Invalid project or user ID", 400);
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    // The project owner cannot be removed through this API.
    if (String(project.ownerId) === userId) {
        throw new AppError("Project owner cannot be removed", 403);
    }
    // Check whether the requester can manage project members.
    let canManage = requesterRole === "ADMIN";
    if (String(project.ownerId) === requesterId) {
        canManage = true;
    }
    if (!canManage) {
        const managerMembership = await ProjectMembershipModel.findOne({
            projectId: project._id,
            userId: requesterId,
            role: "PROJECT_MANAGER"
        });
        canManage = Boolean(managerMembership);
    }
    if (!canManage) {
        throw new AppError("You cannot manage members of this project", 403);
    }
    const membership = await ProjectMembershipModel.findOne({
        projectId: project._id,
        userId
    });
    if (!membership) {
        throw new AppError("Project member not found", 404);
    }
    await ProjectMembershipModel.deleteOne({
        _id: membership._id
    });
    return {
        projectId,
        userId,
        message: "Project member removed successfully"
    };
};
export const updateProjectMemberRole = async (projectId, userId, role, requesterId, requesterRole) => {
    if (!mongoose.isValidObjectId(projectId) ||
        !mongoose.isValidObjectId(userId)) {
        throw new AppError("Invalid project or user ID", 400);
    }
    if (role !== "MEMBER" &&
        role !== "PROJECT_MANAGER") {
        throw new AppError("Role must be MEMBER or PROJECT_MANAGER", 400);
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    const isAdmin = requesterRole === "ADMIN";
    const isOwner = String(project.ownerId) === requesterId;
    if (!isAdmin && !isOwner) {
        throw new AppError("Only admin or project owner can update member roles", 403);
    }
    if (String(project.ownerId) === userId) {
        throw new AppError("Project owner's role cannot be changed here", 403);
    }
    const membership = await ProjectMembershipModel.findOne({
        projectId: project._id,
        userId
    });
    if (!membership) {
        throw new AppError("Project member not found", 404);
    }
    membership.role = role;
    await membership.save();
    return {
        id: String(membership._id),
        projectId: String(membership.projectId),
        userId: String(membership.userId),
        role: membership.role,
        updatedAt: membership.updatedAt
    };
};
export const getAccessibleProject = async (projectId, requesterId, requesterRole) => {
    if (!mongoose.isValidObjectId(projectId)) {
        throw new AppError("Invalid project ID", 400);
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
        throw new AppError("Project not found", 404);
    }
    // Admin can access every project.
    if (requesterRole === "ADMIN") {
        return project;
    }
    // Project owner can access their own project.
    if (String(project.ownerId) === requesterId) {
        return project;
    }
    // Other users must have project membership.
    const membership = await ProjectMembershipModel.findOne({
        projectId: project._id,
        userId: requesterId
    });
    if (!membership) {
        throw new AppError("You do not have access to this project", 403);
    }
    return project;
};
//# sourceMappingURL=project-membership.service.js.map