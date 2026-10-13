import { TaskModel } from "../tasks/task.model.js";
import { getAccessibleProject } from "../tasks/task.service.js";
const emptyCounts = {
    total: 0,
    completed: 0,
    inProgress: 0,
    todo: 0
};
// $group accumulator: counts documents matching a condition.
const countIf = (condition) => ({
    $sum: { $cond: [condition, 1, 0] }
});
// Per-status counters shared by every group in the pipeline.
const statusAccumulators = {
    total: { $sum: 1 },
    completed: countIf({ $eq: ["$status", "DONE"] }),
    inProgress: countIf({ $eq: ["$status", "IN_PROGRESS"] }),
    todo: countIf({ $eq: ["$status", "TODO"] })
};
const buildStatsPipeline = (projectId, now) => [
    // 1. Restrict to one project first so the (projectId, status) index
    //    is used and no other project's data reaches later stages.
    { $match: { projectId } },
    // 2. One scan of the project's tasks feeds three sub-pipelines.
    {
        $facet: {
            // Overall totals: a single group with _id: null, so every task
            // is counted exactly once.
            summary: [
                {
                    $group: {
                        _id: null,
                        ...statusAccumulators,
                        highPriority: countIf({ $eq: ["$priority", "HIGH"] }),
                        // Overdue: has a real Date dueDate in the past and is not
                        // DONE. The $type guard matters: in expressions a missing
                        // field sorts before any date, so $lt alone would flag
                        // tasks without a due date.
                        overdue: countIf({
                            $and: [
                                { $eq: [{ $type: "$dueDate" }, "date"] },
                                { $lt: ["$dueDate", now] },
                                { $ne: ["$status", "DONE"] }
                            ]
                        })
                    }
                },
                { $project: { _id: 0 } }
            ],
            // Per-assignee breakdown for assigned tasks only.
            byAssignee: [
                { $match: { assignedTo: { $exists: true, $ne: null } } },
                { $group: { _id: "$assignedTo", ...statusAccumulators } },
                // Join after grouping: one lookup per assignee, not per task.
                // The inner pipeline projects only the name so password and
                // token hashes never leave the users collection.
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        pipeline: [{ $project: { _id: 0, name: 1 } }],
                        as: "assignee"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        assigneeId: "$_id",
                        assigneeName: { $first: "$assignee.name" },
                        total: 1,
                        completed: 1,
                        inProgress: 1,
                        todo: 1
                    }
                },
                { $sort: { total: -1, assigneeName: 1 } }
            ],
            // Tasks with no assignee, reported separately.
            unassigned: [
                {
                    $match: {
                        $or: [
                            { assignedTo: { $exists: false } },
                            { assignedTo: null }
                        ]
                    }
                },
                { $group: { _id: null, ...statusAccumulators } },
                { $project: { _id: 0 } }
            ]
        }
    }
];
export const getProjectStats = async (projectId, requesterId, requesterRole) => {
    const project = await getAccessibleProject(projectId, requesterId, requesterRole);
    // $facet always yields exactly one document.
    const [result] = await TaskModel.aggregate(buildStatsPipeline(project._id, new Date()));
    const summary = result?.summary[0] ?? {
        ...emptyCounts,
        highPriority: 0,
        overdue: 0
    };
    const tasksByAssignee = (result?.byAssignee ?? []).map((row) => ({
        assigneeId: String(row.assigneeId),
        assigneeName: row.assigneeName ?? null,
        total: row.total,
        completed: row.completed,
        inProgress: row.inProgress,
        todo: row.todo
    }));
    return {
        projectId: String(project._id),
        summary,
        tasksByAssignee,
        unassigned: result?.unassigned[0] ?? { ...emptyCounts }
    };
};
//# sourceMappingURL=project-stats.service.js.map