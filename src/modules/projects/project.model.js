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
export const ProjectModel = model("Project", projectSchema);
//# sourceMappingURL=project.model.js.map