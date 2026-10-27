import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

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

describe("task comments and activity log", { skip: skipReason }, () => {
  let env: TestEnv;
  let admin: TestUser;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;
  let otherProjectId: string;
  let task: Json;
  let otherTask: Json;

  const commentsUrl = (taskId = task.id, project = projectId) =>
    `/api/projects/${project}/tasks/${taskId}/comments`;
  const activitiesUrl = (taskId = task.id, project = projectId) =>
    `/api/projects/${project}/tasks/${taskId}/activities`;

  before(async () => {
    env = await startTestEnv();
    admin = await createUser(env, "ADMIN");
    owner = await createUser(env, "PROJECT_MANAGER", "owner");
    member = await createUser(env, "MEMBER", "member");
    outsider = await createUser(env, "MEMBER", "outsider");

    projectId = await createProject(env, owner, "Comments project");
    otherProjectId = await createProject(env, owner, "Other project");
    await addMember(env, owner, projectId, member);

    task = await createTask(env, owner, projectId, { title: "Commented task" });
    otherTask = await createTask(env, owner, otherProjectId, { title: "Other task" });
  });

  after(async () => {
    await env.stop();
  });

  describe("comments", () => {
    it("lets members, owners and admins comment", async () => {
      for (const user of [member, owner, admin]) {
        const res = await env.request("POST", commentsUrl(), {
          token: user.token,
          body: { message: `  Hello from ${user.id.slice(-4)}  ` }
        });

        assert.equal(res.status, 201);
        assert.equal(res.json.data.userId, user.id);
        assert.equal(res.json.data.taskId, task.id);
        assert.equal(res.json.data.projectId, projectId);
        assert.equal(res.json.data.message, `Hello from ${user.id.slice(-4)}`);
      }
    });

    for (const [label, body] of [
      ["a blank message", { message: "   " }],
      ["a missing message", {}],
      ["a non-string message", { message: 42 }],
      ["a message over 2000 characters", { message: "m".repeat(2001) }]
    ] as const) {
      it(`rejects ${label} with 400`, async () => {
        const res = await env.request("POST", commentsUrl(), { token: member.token, body });

        assert.equal(res.status, 400);
      });
    }

    it("accepts a message of exactly 2000 characters", async () => {
      const res = await env.request("POST", commentsUrl(), {
        token: member.token,
        body: { message: "m".repeat(2000) }
      });

      assert.equal(res.status, 201);
    });

    it("rejects a missing or array body with 400", async () => {
      assert.equal((await env.request("POST", commentsUrl(), { token: member.token })).status, 400);
      assert.equal(
        (await env.request("POST", commentsUrl(), { token: member.token, rawBody: "[]" })).status,
        400
      );
    });

    it("blocks outsiders and anonymous users", async () => {
      assert.equal(
        (await env.request("POST", commentsUrl(), { token: outsider.token, body: { message: "hi" } })).status,
        403
      );
      assert.equal((await env.request("POST", commentsUrl(), { body: { message: "hi" } })).status, 401);
      assert.equal((await env.request("GET", commentsUrl(), { token: outsider.token })).status, 403);
    });

    it("returns 404 for a task from another project or a missing task", async () => {
      assert.equal(
        (await env.request("POST", commentsUrl(otherTask.id), { token: owner.token, body: { message: "hi" } })).status,
        404
      );
      assert.equal(
        (await env.request("POST", commentsUrl(MISSING_ID), { token: owner.token, body: { message: "hi" } })).status,
        404
      );
      assert.equal((await env.request("GET", commentsUrl(MISSING_ID), { token: owner.token })).status, 404);
    });

    it("returns 400 for invalid ids", async () => {
      assert.equal(
        (await env.request("POST", commentsUrl("bad-id"), { token: owner.token, body: { message: "hi" } })).status,
        400
      );
      assert.equal((await env.request("GET", commentsUrl(task.id, "bad-id"), { token: owner.token })).status, 400);
    });

    it("lists only the comments of the requested task", async () => {
      await env.request("POST", commentsUrl(otherTask.id, otherProjectId), {
        token: owner.token,
        body: { message: "belongs to the other task" }
      });

      const mine = await env.request("GET", commentsUrl(), { token: member.token });
      const theirs = await env.request("GET", commentsUrl(otherTask.id, otherProjectId), { token: owner.token });

      assert.equal(mine.status, 200);
      assert.ok(mine.json.data.length >= 4);
      assert.ok(mine.json.data.every((c: Json) => c.taskId === task.id));
      assert.ok(!JSON.stringify(mine.json.data).includes("belongs to the other task"));
      assert.deepEqual(theirs.json.data.map((c: Json) => c.message), ["belongs to the other task"]);
    });

    it("does not let a task id from project A be read through project B", async () => {
      const res = await env.request("GET", commentsUrl(task.id, otherProjectId), { token: owner.token });

      assert.equal(res.status, 404);
    });
  });

  describe("activity log", () => {
    let logged: Json;

    before(async () => {
      logged = await createTask(env, owner, projectId, { title: "Audited task" });
      const url = `/api/projects/${projectId}/tasks/${logged.id}`;

      await env.request("PATCH", url, { token: owner.token, body: { status: "IN_PROGRESS" } });
      await env.request("PATCH", url, { token: owner.token, body: { assignedTo: member.id } });
      await env.request("PATCH", url, { token: owner.token, body: { title: "Audited task v2", priority: "HIGH" } });
      // No-op update: must not add entries.
      await env.request("PATCH", url, { token: owner.token, body: { status: "IN_PROGRESS" } });
    });

    const actions = (res: Json) => res.json.data.activities.map((a: Json) => a.action);

    it("records create, status, assignee and detail changes (newest first)", async () => {
      const res = await env.request("GET", activitiesUrl(logged.id), { token: owner.token });

      assert.equal(res.status, 200);
      assert.deepEqual(actions(res), [
        "TASK_UPDATED",
        "ASSIGNEE_CHANGED",
        "STATUS_CHANGED",
        "TASK_CREATED"
      ]);
      assert.equal(res.json.data.total, 4);
    });

    it("attributes entries to the acting user and includes useful metadata", async () => {
      const res = await env.request("GET", activitiesUrl(logged.id), { token: member.token });
      const byAction = Object.fromEntries(res.json.data.activities.map((a: Json) => [a.action, a]));

      assert.ok(res.json.data.activities.every((a: Json) => a.userId === owner.id));
      assert.deepEqual(byAction.STATUS_CHANGED.metadata, { oldStatus: "TODO", newStatus: "IN_PROGRESS" });
      assert.equal(byAction.ASSIGNEE_CHANGED.metadata.newAssignedTo, member.id);
      assert.equal(byAction.TASK_UPDATED.metadata.changes.priority.new, "HIGH");
    });

    it("records a status change made by the assigned member under their id", async () => {
      await env.request("PATCH", `/api/projects/${projectId}/tasks/${logged.id}`, {
        token: member.token,
        body: { status: "DONE" }
      });

      const res = await env.request("GET", activitiesUrl(logged.id), { token: owner.token });

      assert.equal(res.json.data.activities[0].action, "STATUS_CHANGED");
      assert.equal(res.json.data.activities[0].userId, member.id);
    });

    it("records deletion", async () => {
      const doomed = await createTask(env, owner, projectId, { title: "Doomed task" });

      await env.request("DELETE", `/api/projects/${projectId}/tasks/${doomed.id}`, { token: owner.token });

      const deleted = await mongoose.connection
        .collection("taskactivities")
        .find({ taskId: new mongoose.Types.ObjectId(doomed.id) })
        .toArray();

      assert.deepEqual(
        deleted.map((a) => a.action).sort(),
        ["TASK_CREATED", "TASK_DELETED"]
      );
    });

    it("paginates and validates pagination", async () => {
      const first = await env.request("GET", `${activitiesUrl(logged.id)}?limit=2&page=1`, { token: owner.token });
      const second = await env.request("GET", `${activitiesUrl(logged.id)}?limit=2&page=2`, { token: owner.token });

      assert.equal(first.json.data.activities.length, 2);
      assert.equal(first.json.data.totalPages, 3);
      assert.notDeepEqual(
        first.json.data.activities.map((a: Json) => a.id),
        second.json.data.activities.map((a: Json) => a.id)
      );

      for (const query of ["page=0", "page=1.5", "page=abc", "limit=0", "limit=101", "limit=x"]) {
        const res = await env.request("GET", `${activitiesUrl(logged.id)}?${query}`, { token: owner.token });

        assert.equal(res.status, 400, query);
      }
    });

    it("keeps activity data private to project participants", async () => {
      assert.equal((await env.request("GET", activitiesUrl(logged.id), { token: outsider.token })).status, 403);
      assert.equal((await env.request("GET", activitiesUrl(logged.id))).status, 401);
      assert.equal((await env.request("GET", activitiesUrl(logged.id), { token: admin.token })).status, 200);
    });

    it("isolates activities by project and task", async () => {
      assert.equal(
        (await env.request("GET", activitiesUrl(logged.id, otherProjectId), { token: owner.token })).status,
        404
      );
      assert.equal((await env.request("GET", activitiesUrl(MISSING_ID), { token: owner.token })).status, 404);
      assert.equal((await env.request("GET", activitiesUrl("bad-id"), { token: owner.token })).status, 400);

      const otherLog = await env.request("GET", activitiesUrl(otherTask.id, otherProjectId), { token: owner.token });
      assert.deepEqual(actions(otherLog), ["TASK_CREATED"]);
    });
  });
});
