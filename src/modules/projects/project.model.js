import { Schema, model } from "mongoose";
const projectSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    ownerId: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["active", "archived"],
        default: "active"
    }
}, {
    timestamps: true
});
projectSchema.index({ ownerId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });
export const ProjectModel = model("Project", projectSchema);
//# sourceMappingURL=project.model.js.map