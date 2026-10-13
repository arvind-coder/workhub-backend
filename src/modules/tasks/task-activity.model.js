import { Schema, model, Types } from "mongoose";
const taskActivitySchema = new Schema({
    projectId: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true,
    },
    taskId: {
        type: Schema.Types.ObjectId,
        ref: "Task",
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    action: {
        type: String,
        enum: [
            "TASK_CREATED",
            "TASK_UPDATED",
            "STATUS_CHANGED",
            "ASSIGNEE_CHANGED",
            "TASK_DELETED",
        ],
        required: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    metadata: {
        type: Schema.Types.Mixed,
        required: false,
    },
}, { timestamps: true });
taskActivitySchema.index({ projectId: 1, taskId: 1, createdAt: -1 });
taskActivitySchema.index({ userId: 1, createdAt: -1 });
export const TaskActivityModel = model("TaskActivity", taskActivitySchema);
//# sourceMappingURL=task-activity.model.js.map