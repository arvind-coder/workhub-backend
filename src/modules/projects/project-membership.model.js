import { Schema, model, Types } from "mongoose";
const projectMembershipSchema = new Schema({
    projectId: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    role: {
        type: String,
        enum: ["PROJECT_MANAGER", "MEMBER"],
        default: "MEMBER",
        required: true
    }
}, {
    timestamps: true
});
projectMembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMembershipSchema.index({ userId: 1 });
export const ProjectMembershipModel = model("ProjectMembership", projectMembershipSchema);
//# sourceMappingURL=project-membership.model.js.map