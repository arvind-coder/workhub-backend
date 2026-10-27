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

describe("tasks", { skip: skipReason }, () => {
  let env: TestEnv;
  let admin: TestUser;
  let owner: TestUser;
  let manager: TestUser; // PROJECT_MANAGER membership
  let member1: TestUser;
  let member2: TestUser; // member, never assigned
  let outsider: TestUser;
  let projectId: string;
  let otherProjectId: string;

  const tasksUrl = (id = projectId) => `/api/projects/${id}/tasks`;

  before(async () => {
    env = await startTestEnv();
    admin = await createUser(env, "ADMIN");
    owner = await createUser(env, "PROJECT_MANAGER", "owner");
    manager = await createUser(env, "MEMBER", "manager");
    member1 = await createUser(env, "MEMBER", "member1");
    member2 = await createUser(env, "MEMBER", "member2");
    outsider = await createUser(env, "MEMBER", "outsider");

    projectId = await createProject(env, owner, "Tasks project");
    otherProjectId = await createProject(env, owner, "Other project");

    await addMember(env, owner, projectId, manager, "PROJECT_MANAGER");
    await addMember(env, owner, projectId, member1);
    await addMember(env, owner, projectId, member2);
  });

  after(async () => {
    await env.stop();
  });

  describe("create", () => {
    it("creates a task with defaults and trims text", async () => {
      const res = await env.request("POST", tasksUrl(), {
        token: owner.token,
        body: { title: "  Defaults  ", description: "  body  " }
      });

      assert.equal(res.status, 201);
      assert.equal(res.json.data.title, "Defaults");
      assert.equal(res.json.data.description, "body");
      assert.equal(res.json.data.status, "TODO");
      assert.equal(res.json.data.priority, "MEDIUM");
      assert.equal(res.json.data.projectId, projectId);
      assert.equal(res.json.data.createdBy, owner.id);
      assert.equal("assignedTo" in res.json.data, false);
      assert.equal("dueDate" in res.json.data, false);
    });

    it("persists dueDate, status, priority and assignee given at creation", async () => {
      const task = await createTask(env, owner, projectId, {
        title: "Full task",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedTo: member1.id,
        dueDate: FUTURE
      });

      assert.equal(task.status, "IN_PROGRESS");
      assert.equal(task.priority, "HIGH");
      assert.equal(task.assignedTo, member1.id);
      assert.equal(new Date(task.dueDate).toISOString(), FUTURE);

      const fetched = await env.request("GET", `${tasksUrl()}/${task.id}`, {
        token: owner.token
      });
      assert.equal(new Date(fetched.json.data.dueDate).toISOString(), FUTURE);
    });

    it("lets any project member create a task", async () => {
      const res = await env.request("POST", tasksUrl(), {
        token: member2.token,
        body: { title: "By member", description: "d" }
      });

      assert.equal(res.status, 201);
    });

    const invalid: Array<[string, () => Record<string, unknown>]> = [
      ["title too short", () => ({ title: "ab" })],
      ["title too long", () => ({ title: "t".repeat(151) })],
      ["title not a string", () => ({ title: 123 })],
      ["blank description", () => ({ description: "   " })],
      ["description too long", () => ({ description: "d".repeat(2001) })],
      ["invalid status", () => ({ status: "BLOCKED" })],
      ["invalid priority", () => ({ priority: "URGENT" })],
      ["date-only dueDate", () => ({ dueDate: "2030-01-01" })],
      ["non-date dueDate", () => ({ dueDate: "tomorrow" })],
      ["numeric dueDate", () => ({ dueDate: 1700000000 })],
      ["non-string assignedTo", () => ({ assignedTo: 5 })],
      ["invalid assignedTo id", () => ({ assignedTo: "not-an-id" })],
      ["assignee outside the project", () => ({ assignedTo: outsider.id })]
    ];

    for (const [label, makeOverride] of invalid) {
      it(`rejects ${label} with 400`, async () => {
        const res = await env.request("POST", tasksUrl(), {
          token: owner.token,
          body: { title: "Valid title", description: "Valid", ...makeOverride() }
        });

        assert.equal(res.status, 400);
        assert.equal(res.json.success, false);
      });
    }

    it("returns 404 for an unknown assignee", async () => {
      const res = await env.request("POST", tasksUrl(), {
        token: owner.token,
        body: { title: "Valid title", description: "d", assignedTo: MISSING_ID }
      });

      assert.equal(res.status, 404);
    });

    it("rejects a missing body with 400", async () => {
      const res = await env.request("POST", tasksUrl(), { token: owner.token });

      assert.equal(res.status, 400);
    });

    it("enforces project access", async () => {
      const body = { title: "Valid title", description: "d" };

      assert.equal((await env.request("POST", tasksUrl(), { token: outsider.token, body })).status, 403);
      assert.equal((await env.request("POST", tasksUrl(), { body })).status, 401);
      assert.equal((await env.request("POST", tasksUrl(MISSING_ID), { token: admin.token, body })).status, 404);
      assert.equal((await env.request("POST", tasksUrl("bad-id"), { token: admin.token, body })).status, 400);
      assert.equal((await env.request("POST", tasksUrl(), { token: admin.token, body })).status, 201);
    });
  });

  describe("read", () => {
    let task: Json;

    before(async () => {
      task = await createTask(env, owner, projectId, { title: "Readable task" });
    });

    it("returns a task to project members and admins", async () => {
      for (const user of [owner, member1, admin]) {
        const res = await env.request("GET", `${tasksUrl()}/${task.id}`, { token: user.token });

        assert.equal(res.status, 200);
        assert.equal(res.json.data.id, task.id);
      }
    });

    it("hides the task from outsiders and other projects", async () => {
      assert.equal((await env.request("GET", `${tasksUrl()}/${task.id}`, { token: outsider.token })).status, 403);
      assert.equal(
        (await env.request("GET", `${tasksUrl(otherProjectId)}/${task.id}`, { token: owner.token })).status,
        404
      );
    });

    it("returns 404 for a missing task and 400 for invalid ids", async () => {
      assert.equal((await env.request("GET", `${tasksUrl()}/${MISSING_ID}`, { token: owner.token })).status, 404);
      assert.equal((await env.request("GET", `${tasksUrl()}/not-an-id`, { token: owner.token })).status, 400);
    });
  });

  describe("update", () => {
    let task: Json;

    before(async () => {
      task = await createTask(env, owner, projectId, {
        title: "Updatable",
        assignedTo: member1.id,
        dueDate: FUTURE
      });
    });

    it("lets managers update every supported field", async () => {
      for (const user of [owner, manager, admin]) {
        const res = await env.request("PATCH", `${tasksUrl()}/${task.id}`, {
          token: user.token,
          body: { title: `Edited by ${user.id.slice(-4)}`, priority: "HIGH", status: "IN_PROGRESS" }
        });

        assert.equal(res.status, 200);
        assert.equal(res.json.data.priority, "HIGH");
        assert.equal(res.json.data.status, "IN_PROGRESS");
      }
    });

    it("clears assignedTo and dueDate with null", async () => {
      const res = await env.request("PATCH", `${tasksUrl()}/${task.id}`, {
        token: owner.token,
        body: { assignedTo: null, dueDate: null }
      });

      assert.equal(res.status, 200);
      assert.equal("assignedTo" in res.json.data, false);
      assert.equal("dueDate" in res.json.data, false);
    });

    it("reassigns to another project member", async () => {
      const res = await env.request("PATCH", `${tasksUrl()}/${task.id}`, {
        token: owner.token,
        body: { assignedTo: member2.id }
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.data.assignedTo, member2.id);
    });

    it("lets only the assigned member change status, and nothing else", async () => {
      const assigned = await createTask(env, owner, projectId, {
        title: "Assigned to member1",
        assignedTo: member1.id
      });
      const url = `${tasksUrl()}/${assigned.id}`;

      const status = await env.request("PATCH", url, { token: member1.token, body: { status: "DONE" } });
      assert.equal(status.status, 200);
      assert.equal(status.json.data.status, "DONE");

      const title = await env.request("PATCH", url, { token: member1.token, body: { title: "Renamed" } });
      assert.equal(title.status, 403);

      const both = await env.request("PATCH", url, {
        token: member1.token,
        body: { status: "TODO", priority: "LOW" }
      });
      assert.equal(both.status, 403);

      const notAssigned = await env.request("PATCH", url, { token: member2.token, body: { status: "TODO" } });
      assert.equal(notAssigned.status, 403);

      const outsiderRes = await env.request("PATCH", url, { token: outsider.token, body: { status: "TODO" } });
      assert.equal(outsiderRes.status, 403);
    });

    const invalid: Array<[string, () => Record<string, unknown>]> = [
      ["no fields", () => ({})],
      ["an unknown field", () => ({ projectId: "x", title: "Valid title" })],
      ["a protected field", () => ({ createdBy: "x" })],
      ["a short title", () => ({ title: "ab" })],
      ["a bad status", () => ({ status: "NOPE" })],
      ["a bad priority", () => ({ priority: "NOPE" })],
      ["a bad dueDate", () => ({ dueDate: "soon" })],
      ["a bad assignee id", () => ({ assignedTo: "bad" })],
      ["an assignee outside the project", () => ({ assignedTo: outsider.id })]
    ];

    for (const [label, makeBody] of invalid) {
      it(`rejects ${label} with 400`, async () => {
        const res = await env.request("PATCH", `${tasksUrl()}/${task.id}`, {
          token: owner.token,
          body: makeBody()
        });

        assert.equal(res.status, 400);
      });
    }

    it("returns 404 for a task in a different project and 400 for bad ids", async () => {
      assert.equal(
        (await env.request("PATCH", `${tasksUrl(otherProjectId)}/${task.id}`, {
          token: owner.token,
          body: { title: "Valid title" }
        })).status,
        404
      );
      assert.equal(
        (await env.request("PATCH", `${tasksUrl()}/not-an-id`, {
          token: owner.token,
          body: { title: "Valid title" }
        })).status,
        400
      );
    });
  });

  describe("delete", () => {
    it("lets managers delete and then reports 404", async () => {
      for (const user of [owner, manager, admin]) {
        const task = await createTask(env, owner, projectId, { title: "To delete" });

        const del = await env.request("DELETE", `${tasksUrl()}/${task.id}`, { token: user.token });
        assert.equal(del.status, 200);

        const gone = await env.request("GET", `${tasksUrl()}/${task.id}`, { token: owner.token });
        assert.equal(gone.status, 404);
      }
    });

    it("forbids members (even the assignee) and outsiders", async () => {
      const task = await createTask(env, owner, projectId, {
        title: "Protected task",
        assignedTo: member1.id
      });
      const url = `${tasksUrl()}/${task.id}`;

      assert.equal((await env.request("DELETE", url, { token: member1.token })).status, 403);
      assert.equal((await env.request("DELETE", url, { token: member2.token })).status, 403);
      assert.equal((await env.request("DELETE", url, { token: outsider.token })).status, 403);
      assert.equal((await env.request("GET", url, { token: owner.token })).status, 200);
    });

    it("returns 400 for invalid ids and 404 for a missing task", async () => {
      assert.equal((await env.request("DELETE", `${tasksUrl()}/bad`, { token: owner.token })).status, 400);
      assert.equal((await env.request("DELETE", `${tasksUrl()}/${MISSING_ID}`, { token: owner.token })).status, 404);
    });
  });

  describe("listing, filters, search and pagination", () => {
    let listProject: string;
    let otherListProject: string;

    const list = (query: string, user = owner, id = listProject) =>
      env.request("GET", `${tasksUrl(id)}${query ? `?${query}` : ""}`, { token: user.token });

    const titles = (res: Json): string[] => res.json.data.map((t: Json) => t.title).sort();

    before(async () => {
      listProject = await createProject(env, owner, "List project");
      otherListProject = await createProject(env, owner, "Other list project");
      await addMember(env, owner, listProject, member1);

      const seed: Array<Record<string, unknown>> = [
        { title: "Fix login bug", description: "Users cannot log in", status: "TODO", priority: "HIGH" },
        { title: "Write docs", description: "Document the login flow", status: "IN_PROGRESS", priority: "LOW" },
        { title: "Deploy app", description: "Release v2", status: "DONE", priority: "HIGH", assignedTo: member1.id },
        { title: "Overdue thing", description: "late", status: "TODO", priority: "MEDIUM", assignedTo: member1.id, dueDate: PAST },
        { title: "Done but past due", description: "finished", status: "DONE", priority: "LOW", dueDate: PAST },
        { title: "Future thing", description: "later", status: "TODO", priority: "MEDIUM", dueDate: FUTURE },
        { title: "Special [chars] (x)", description: "50% off *now*", status: "TODO", priority: "LOW" }
      ];

      for (const body of seed) {
        await createTask(env, owner, listProject, body);
      }

      await createTask(env, owner, otherListProject, {
        title: "Fix login bug in other project",
        description: "login"
      });
    });

    it("returns every task of the project with the pagination envelope", async () => {
      const res = await list("");

      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.equal(res.json.data.length, 7);
      assert.deepEqual(res.json.pagination, { page: 1, limit: 10, total: 7, totalPages: 1 });
    });

    describe("search", () => {
      it("matches title or description", async () => {
        const res = await list("search=login");

        assert.deepEqual(titles(res), ["Fix login bug", "Write docs"]);
      });

      it("is case-insensitive", async () => {
        assert.deepEqual(titles(await list("search=LOGIN")), ["Fix login bug", "Write docs"]);
      });

      it("returns an empty page when nothing matches", async () => {
        const res = await list("search=zzz-no-match");

        assert.equal(res.status, 200);
        assert.deepEqual(res.json.data, []);
        assert.deepEqual(res.json.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 });
      });

      it("combines with status", async () => {
        assert.deepEqual(titles(await list("search=login&status=TODO")), ["Fix login bug"]);
        assert.deepEqual(titles(await list("search=login&status=IN_PROGRESS")), ["Write docs"]);
        assert.deepEqual(titles(await list("search=login&status=DONE")), []);
      });

      it("combines with priority and assignee", async () => {
        assert.deepEqual(titles(await list("search=login&priority=HIGH")), ["Fix login bug"]);
        assert.deepEqual(titles(await list(`search=thing&assignedTo=${member1.id}`)), ["Overdue thing"]);
      });

      it("combines with overdue", async () => {
        assert.deepEqual(titles(await list("search=thing&overdue=true")), ["Overdue thing"]);
      });

      it("combines with pagination and keeps totals for the search", async () => {
        const first = await list("search=login&limit=1&page=1&sortBy=title&sortOrder=asc");
        const second = await list("search=login&limit=1&page=2&sortBy=title&sortOrder=asc");
        const third = await list("search=login&limit=1&page=3&sortBy=title&sortOrder=asc");

        assert.deepEqual(first.json.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 });
        assert.deepEqual(first.json.data.map((t: Json) => t.title), ["Fix login bug"]);
        assert.deepEqual(second.json.data.map((t: Json) => t.title), ["Write docs"]);
        assert.deepEqual(third.json.data, []);
      });

      it("never returns tasks from another project", async () => {
        const own = await list("search=login");
        const other = await list("search=login", owner, otherListProject);

        assert.ok(!titles(own).some((t) => t.includes("other project")));
        assert.deepEqual(titles(other), ["Fix login bug in other project"]);
      });

      it("treats regex metacharacters literally", async () => {
        assert.deepEqual(titles(await list(`search=${encodeURIComponent("[chars]")}`)), ["Special [chars] (x)"]);
        assert.deepEqual(titles(await list(`search=${encodeURIComponent("*now*")}`)), ["Special [chars] (x)"]);
        assert.deepEqual(titles(await list(`search=${encodeURIComponent("50%")}`)), ["Special [chars] (x)"]);
        assert.deepEqual(await list(`search=${encodeURIComponent(".*")}`).then((r) => r.json.data), []);
      });

      it("does not fail on an invalid regular expression", async () => {
        for (const bad of ["(", "[", "\\", "a{2,1}", "(?<x"]) {
          const res = await list(`search=${encodeURIComponent(bad)}`);

          assert.equal(res.status, 200, bad);
        }
      });

      it("treats a blank search as no search", async () => {
        assert.equal((await list("search=%20%20")).json.pagination.total, 7);
      });

      it("rejects over-long and repeated search parameters with 400", async () => {
        assert.equal((await list(`search=${"x".repeat(101)}`)).status, 400);
        assert.equal((await list("search=a&search=b")).status, 400);
        assert.equal((await list(`search=${"x".repeat(100)}`)).status, 200);
      });
    });

    describe("filters and sorting", () => {
      it("filters by status and priority", async () => {
        assert.equal((await list("status=DONE")).json.pagination.total, 2);
        assert.equal((await list("priority=HIGH")).json.pagination.total, 2);
        assert.deepEqual(titles(await list("status=TODO&priority=MEDIUM")), ["Future thing", "Overdue thing"]);
      });

      it("filters by assignee", async () => {
        assert.deepEqual(titles(await list(`assignedTo=${member1.id}`)), ["Deploy app", "Overdue thing"]);
      });

      it("returns only past-due tasks that are not DONE for overdue=true", async () => {
        assert.deepEqual(titles(await list("overdue=true")), ["Overdue thing"]);
      });

      it("does not filter for overdue=false", async () => {
        assert.equal((await list("overdue=false")).json.pagination.total, 7);
      });

      it("sorts by an allow-listed field in both directions", async () => {
        const asc = (await list("sortBy=title&sortOrder=asc")).json.data.map((t: Json) => t.title);
        const desc = (await list("sortBy=title&sortOrder=desc")).json.data.map((t: Json) => t.title);

        assert.deepEqual(asc, [...asc].sort((a: string, b: string) => a.localeCompare(b, "en")));
        assert.deepEqual(desc, [...asc].reverse());
      });

      it("paginates consistently", async () => {
        const p1 = await list("limit=3&page=1&sortBy=title&sortOrder=asc");
        const p3 = await list("limit=3&page=3&sortBy=title&sortOrder=asc");

        assert.equal(p1.json.data.length, 3);
        assert.equal(p3.json.data.length, 1);
        assert.deepEqual(p1.json.pagination, { page: 1, limit: 3, total: 7, totalPages: 3 });
      });

      for (const query of [
        "page=0", "page=-1", "page=1.5", "page=abc", "page=1e2",
        "limit=0", "limit=101", "limit=1.5", "limit=abc",
        "status=BLOCKED", "priority=URGENT",
        "assignedTo=not-an-id", "assignedTo=a&assignedTo=b",
        "overdue=yes", "sortBy=password", "sortBy=dueDate", "sortOrder=sideways"
      ]) {
        it(`rejects ?${query} with 400`, async () => {
          assert.equal((await list(query)).status, 400);
        });
      }
    });

    describe("access", () => {
      it("lets members and admins list, and blocks outsiders", async () => {
        assert.equal((await list("", member1)).status, 200);
        assert.equal((await list("", admin)).status, 200);
        assert.equal((await list("", outsider)).status, 403);
        assert.equal((await env.request("GET", tasksUrl(listProject))).status, 401);
      });

      it("returns 400 for an invalid project id and 404 for a missing project", async () => {
        assert.equal((await list("", owner, "not-an-id")).status, 400);
        assert.equal((await list("", owner, MISSING_ID)).status, 404);
      });
    });
  });
});
