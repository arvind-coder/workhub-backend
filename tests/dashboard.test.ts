import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  addMember,
  createProject,
  createTask,
  createUser,
  skipReason,
  startTestEnv,
  type Json,
  type TestEnv,
  type TestUser
} from "./helpers/test-env.js";

const MISSING_ID = "64b000000000000000000000";
const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

describe("project dashboard statistics", { skip: skipReason }, () => {
  let env: TestEnv;
  let admin: TestUser;
  let owner: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let outsider: TestUser;
  let projectId: string;
  let overdueTask: Json;

  const stats = (id = projectId, user: TestUser = owner) =>
    env.request("GET", `/api/projects/${id}/stats`, { token: user.token });

  before(async () => {
    env = await startTestEnv();
    admin = await createUser(env, "ADMIN");
    owner = await createUser(env, "PROJECT_MANAGER", "owner");
    alice = await createUser(env, "MEMBER", "alice");
    bob = await createUser(env, "MEMBER", "bob");
    outsider = await createUser(env, "MEMBER", "outsider");

    projectId = await createProject(env, owner, "Stats project");
    await addMember(env, owner, projectId, alice);
    await addMember(env, owner, projectId, bob);

    overdueTask = await createTask(env, owner, projectId, {
      title: "Alice overdue", status: "TODO", priority: "HIGH", assignedTo: alice.id, dueDate: PAST
    });
    await createTask(env, owner, projectId, {
      title: "Alice done", status: "DONE", priority: "LOW", assignedTo: alice.id, dueDate: PAST
    });
    await createTask(env, owner, projectId, {
      title: "Bob working", status: "IN_PROGRESS", priority: "HIGH", assignedTo: bob.id
    });
    await createTask(env, owner, projectId, { title: "Unassigned todo", status: "TODO", priority: "MEDIUM" });
    await createTask(env, owner, projectId, {
      title: "Unassigned late", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: PAST
    });
    await createTask(env, owner, projectId, {
      title: "Unassigned future", status: "TODO", priority: "LOW", dueDate: FUTURE
    });
  });

  after(async () => {
    await env.stop();
  });

  it("counts totals, statuses, high priority and overdue correctly", async () => {
    const res = await stats();

    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.data.projectId, projectId);
    assert.deepEqual(res.json.data.summary, {
      total: 6,
      completed: 1,
      inProgress: 2,
      todo: 3,
      highPriority: 2,
      overdue: 2
    });
  });

  it("groups tasks by assignee with names, sorted by workload", async () => {
    const { tasksByAssignee } = (await stats()).json.data;

    assert.deepEqual(tasksByAssignee, [
      { assigneeId: alice.id, assigneeName: "Test alice", total: 2, completed: 1, inProgress: 0, todo: 1 },
      { assigneeId: bob.id, assigneeName: "Test bob", total: 1, completed: 0, inProgress: 1, todo: 0 }
    ]);
  });

  it("reports unassigned tasks separately", async () => {
    assert.deepEqual((await stats()).json.data.unassigned, {
      total: 3,
      completed: 0,
      inProgress: 1,
      todo: 2
    });
  });

  it("counts every task exactly once", async () => {
    const { summary, tasksByAssignee, unassigned } = (await stats()).json.data;
    const assigned = tasksByAssignee.reduce((sum: number, row: Json) => sum + row.total, 0);

    assert.equal(summary.total, assigned + unassigned.total);
    assert.equal(summary.completed + summary.inProgress + summary.todo, summary.total);
  });

  it("does not treat tasks without a due date, DONE tasks or future tasks as overdue", async () => {
    const onlyUndated = await createProject(env, owner, "No overdue");
    await createTask(env, owner, onlyUndated, { title: "No due date" });
    await createTask(env, owner, onlyUndated, { title: "Done and late", status: "DONE", dueDate: PAST });
    await createTask(env, owner, onlyUndated, { title: "Future task", dueDate: FUTURE });

    assert.equal((await stats(onlyUndated)).json.data.summary.overdue, 0);
  });

  it("reflects changes immediately", async () => {
    const before = (await stats()).json.data.summary;

    await env.request("PATCH", `/api/projects/${projectId}/tasks/${overdueTask.id}`, {
      token: owner.token,
      body: { status: "DONE" }
    });

    const after = (await stats()).json.data.summary;

    assert.equal(after.overdue, before.overdue - 1);
    assert.equal(after.completed, before.completed + 1);
    assert.equal(after.todo, before.todo - 1);
    assert.equal(after.total, before.total);
  });

  it("isolates statistics per project", async () => {
    const second = await createProject(env, owner, "Second stats project");
    await createTask(env, owner, second, { title: "Only task", priority: "HIGH" });

    const res = await stats(second);

    assert.equal(res.json.data.summary.total, 1);
    assert.equal(res.json.data.summary.highPriority, 1);
    assert.deepEqual(res.json.data.tasksByAssignee, []);
    assert.equal(res.json.data.unassigned.total, 1);
    // The first project is unaffected.
    assert.equal((await stats()).json.data.summary.total, 6);
  });

  it("returns zeros for an empty project", async () => {
    const empty = await createProject(env, owner, "Empty project");
    const res = await stats(empty);

    assert.equal(res.status, 200);
    assert.deepEqual(res.json.data.summary, {
      total: 0, completed: 0, inProgress: 0, todo: 0, highPriority: 0, overdue: 0
    });
    assert.deepEqual(res.json.data.tasksByAssignee, []);
    assert.deepEqual(res.json.data.unassigned, { total: 0, completed: 0, inProgress: 0, todo: 0 });
  });

  it("does not expose assignee emails or credentials", async () => {
    const res = await stats();

    assert.equal(res.text.includes(alice.email), false);
    assert.equal(/password|refreshTokenHash/i.test(res.text), false);
  });

  it("applies the standard project access rules", async () => {
    assert.equal((await stats(projectId, admin)).status, 200);
    assert.equal((await stats(projectId, alice)).status, 200);
    assert.equal((await stats(projectId, outsider)).status, 403);
    assert.equal((await env.request("GET", `/api/projects/${projectId}/stats`)).status, 401);
    assert.equal((await stats("not-an-id")).status, 400);
    assert.equal((await stats(MISSING_ID)).status, 404);
  });
});
