import { Schema, model, Types } from "mongoose";
const taskCommentSchema = new Schema({
    taskId: {
        type: Schema.Types.ObjectId,
        ref: "Task",
        required: true
    },
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
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 2000
    }
}, {
    timestamps: true
});
// Fetch comments for a task in chronological order.
taskCommentSchema.index({
    taskId: 1,
    createdAt: 1
});
// Useful for project-level comment queries.
taskCommentSchema.index({
    projectId: 1,
    createdAt: -1
});
export const TaskCommentModel = model("TaskComment", taskCommentSchema);
//# sourceMappingURL=task-comment.model.js.map