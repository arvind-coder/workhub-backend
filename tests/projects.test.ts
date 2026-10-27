import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

import {
  addMember,
  createProject,
  createUser,
  skipReason,
  startTestEnv,
  type TestEnv,
  type TestUser
} from "./helpers/test-env.js";

const MISSING_ID = "64b000000000000000000000";

describe("projects and membership", { skip: skipReason }, () => {
  let env: TestEnv;
  let admin: TestUser;
  let owner: TestUser; // PROJECT_MANAGER
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;

  before(async () => {
    env = await startTestEnv();
    admin = await createUser(env, "ADMIN");
    owner = await createUser(env, "PROJECT_MANAGER", "owner");
    member = await createUser(env, "MEMBER", "member");
    outsider = await createUser(env, "MEMBER", "outsider");

    projectId = await createProject(env, owner, "Alpha project");
    await addMember(env, owner, projectId, member);
  });

  after(async () => {
    await env.stop();
  });

  describe("creation", () => {
    it("creates a project owned by the caller", async () => {
      const res = await env.request("POST", "/api/projects", {
        token: owner.token,
        body: { name: "  Spaced  ", description: " Desc " }
      });

      assert.equal(res.status, 201);
      assert.equal(res.json.data.name, "Spaced");
      assert.equal(res.json.data.description, "Desc");
      assert.equal(res.json.data.ownerId, owner.id);
      assert.equal(res.json.data.status, "active");
    });

    it("forbids plain MEMBER users from creating projects", async () => {
      const res = await env.request("POST", "/api/projects", {
        token: member.token,
        body: { name: "Nope", description: "d" }
      });

      assert.equal(res.status, 403);
    });

    it("requires authentication", async () => {
      const res = await env.request("POST", "/api/projects", {
        body: { name: "Nope", description: "d" }
      });

      assert.equal(res.status, 401);
    });

    it("ignores a client-supplied ownerId", async () => {
      const res = await env.request("POST", "/api/projects", {
        token: owner.token,
        body: { name: "Mine", description: "d", ownerId: outsider.id }
      });

      assert.equal(res.status, 201);
      assert.equal(res.json.data.ownerId, owner.id);
    });

    const invalid: Array<[string, unknown]> = [
      ["missing name", { description: "d" }],
      ["blank description", { name: "n", description: "  " }],
      ["name over 150 chars", { name: "n".repeat(151), description: "d" }],
      ["description over 2000 chars", { name: "n", description: "d".repeat(2001) }],
      ["non-string name", { name: 5, description: "d" }]
    ];

    for (const [label, body] of invalid) {
      it(`rejects ${label} with 400`, async () => {
        const res = await env.request("POST", "/api/projects", {
          token: owner.token,
          body
        });

        assert.equal(res.status, 400);
      });
    }
  });

  describe("ownerId representation", () => {
    it("is stored as a string and returned as the same string", async () => {
      const stored = await mongoose.connection
        .collection("projects")
        .findOne({ _id: new mongoose.Types.ObjectId(projectId) });

      assert.equal(typeof stored?.ownerId, "string");
      assert.equal(stored?.ownerId, owner.id);

      const res = await env.request("GET", `/api/projects/${projectId}`, {
        token: owner.token
      });

      assert.equal(res.json.data.ownerId, owner.id);
      assert.equal(typeof res.json.data.ownerId, "string");
    });

    it("API responses compare equal to the user id from login", async () => {
      const list = await env.request("GET", "/api/projects?limit=100", {
        token: owner.token
      });

      assert.ok(list.json.data.length > 0);
      for (const project of list.json.data) {
        assert.equal(project.ownerId, owner.id);
      }
    });
  });

  describe("read access", () => {
    it("allows the owner, an admin and a member", async () => {
      for (const user of [owner, admin, member]) {
        const res = await env.request("GET", `/api/projects/${projectId}`, {
          token: user.token
        });

        assert.equal(res.status, 200);
        assert.equal(res.json.data.id, projectId);
      }
    });

    it("denies an unrelated user with 403", async () => {
      const res = await env.request("GET", `/api/projects/${projectId}`, {
        token: outsider.token
      });

      assert.equal(res.status, 403);
    });

    it("returns 404 for a well-formed id that does not exist", async () => {
      const res = await env.request("GET", `/api/projects/${MISSING_ID}`, {
        token: admin.token
      });

      assert.equal(res.status, 404);
      assert.deepEqual(res.json, { success: false, message: "Project not found" });
    });

    it("returns 400 for an invalid project id", async () => {
      for (const id of ["not-an-id", "123", "zzzzzzzzzzzzzzzzzzzzzzzz"]) {
        const res = await env.request("GET", `/api/projects/${id}`, {
          token: admin.token
        });

        assert.equal(res.status, 400, id);
      }
    });
  });

  describe("listing", () => {
    let listOwner: TestUser;

    before(async () => {
      listOwner = await createUser(env, "PROJECT_MANAGER", "lister");
      for (const name of ["Banana plan", "Apple plan", "Cherry plan", "a.b literal"]) {
        await createProject(env, listOwner, name);
      }
    });

    it("shows a user only projects they own or belong to", async () => {
      const res = await env.request("GET", "/api/projects?limit=100", {
        token: member.token
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.json.data.map((p: any) => p.id), [projectId]);

      const none = await env.request("GET", "/api/projects", { token: outsider.token });
      assert.equal(none.json.pagination.total, 0);
    });

    it("lets an admin see every project", async () => {
      const res = await env.request("GET", "/api/projects?limit=100", {
        token: admin.token
      });

      assert.ok(res.json.pagination.total >= 5);
    });

    it("paginates and reports totals", async () => {
      const res = await env.request("GET", "/api/projects?limit=2&page=2&sortBy=name&sortOrder=asc", {
        token: listOwner.token
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.data.length, 2);
      assert.deepEqual(res.json.pagination, { page: 2, limit: 2, total: 4, totalPages: 2 });
    });

    it("sorts by an allow-listed field", async () => {
      const res = await env.request("GET", "/api/projects?sortBy=name&sortOrder=asc", {
        token: listOwner.token
      });

      // MongoDB's default collation is binary (uppercase sorts before lowercase).
      const names = res.json.data.map((p: any) => p.name);
      assert.deepEqual(names, [...names].sort());
    });

    for (const query of [
      "page=0", "page=-1", "page=1.5", "page=abc", "page=1e3",
      "limit=0", "limit=101", "limit=2.5", "limit=abc",
      "sortBy=password", "sortBy=ownerId", "sortOrder=up",
      "status=deleted", `search=${"x".repeat(101)}`, "search=a&search=b"
    ]) {
      it(`rejects ?${query.slice(0, 30)} with 400`, async () => {
        const res = await env.request("GET", `/api/projects?${query}`, {
          token: listOwner.token
        });

        assert.equal(res.status, 400);
      });
    }

    it("searches name and description case-insensitively", async () => {
      const res = await env.request("GET", "/api/projects?search=APPLE", {
        token: listOwner.token
      });

      assert.deepEqual(res.json.data.map((p: any) => p.name), ["Apple plan"]);
    });

    it("treats regex metacharacters literally", async () => {
      const dot = await env.request("GET", `/api/projects?search=${encodeURIComponent("a.b")}`, {
        token: listOwner.token
      });
      assert.deepEqual(dot.json.data.map((p: any) => p.name), ["a.b literal"]);

      // "a.b" as a regex would also match "a-b"/"aXb"; ".*" would match all.
      const wild = await env.request("GET", `/api/projects?search=${encodeURIComponent(".*")}`, {
        token: listOwner.token
      });
      assert.equal(wild.json.pagination.total, 0);

      const broken = await env.request("GET", `/api/projects?search=${encodeURIComponent("(")}`, {
        token: listOwner.token
      });
      assert.equal(broken.status, 200);
    });
  });

  describe("update and delete", () => {
    it("lets the owner update, and rejects empty or unknown-only bodies", async () => {
      const id = await createProject(env, owner, "Editable");

      const ok = await env.request("PATCH", `/api/projects/${id}`, {
        token: owner.token,
        body: { name: "Renamed", status: "archived" }
      });
      assert.equal(ok.status, 200);
      assert.equal(ok.json.data.name, "Renamed");
      assert.equal(ok.json.data.status, "archived");

      const empty = await env.request("PATCH", `/api/projects/${id}`, {
        token: owner.token,
        body: {}
      });
      assert.equal(empty.status, 400);

      const badStatus = await env.request("PATCH", `/api/projects/${id}`, {
        token: owner.token,
        body: { status: "gone" }
      });
      assert.equal(badStatus.status, 400);
    });

    it("does not let another project manager modify or delete it (owner only)", async () => {
      const id = await createProject(env, owner, "Protected");
      const rival = await createUser(env, "PROJECT_MANAGER", "rival");

      const patch = await env.request("PATCH", `/api/projects/${id}`, {
        token: rival.token,
        body: { name: "Hijack" }
      });
      const del = await env.request("DELETE", `/api/projects/${id}`, { token: rival.token });

      assert.equal(patch.status, 404);
      assert.equal(del.status, 404);

      const still = await env.request("GET", `/api/projects/${id}`, { token: owner.token });
      assert.equal(still.json.data.name, "Protected");
    });

    it("forbids a MEMBER-role user from update and delete", async () => {
      const patch = await env.request("PATCH", `/api/projects/${projectId}`, {
        token: member.token,
        body: { name: "Nope" }
      });
      const del = await env.request("DELETE", `/api/projects/${projectId}`, {
        token: member.token
      });

      assert.equal(patch.status, 403);
      assert.equal(del.status, 403);
    });

    it("lets the owner delete a project", async () => {
      const id = await createProject(env, owner, "Disposable");

      const del = await env.request("DELETE", `/api/projects/${id}`, { token: owner.token });
      assert.equal(del.status, 200);

      const gone = await env.request("GET", `/api/projects/${id}`, { token: admin.token });
      assert.equal(gone.status, 404);
    });

    it("rejects an invalid id on update and delete with 400", async () => {
      const patch = await env.request("PATCH", "/api/projects/not-an-id", {
        token: owner.token,
        body: { name: "x" }
      });
      const del = await env.request("DELETE", "/api/projects/not-an-id", { token: owner.token });

      assert.equal(patch.status, 400);
      assert.equal(del.status, 400);
    });
  });

  describe("membership", () => {
    let id: string;
    let candidate: TestUser;

    before(async () => {
      id = await createProject(env, owner, "Team project");
      candidate = await createUser(env, "MEMBER", "candidate");
    });

    it("lets the owner add a member and lists them", async () => {
      const add = await env.request("POST", `/api/projects/${id}/members`, {
        token: owner.token,
        body: { userId: candidate.id }
      });
      assert.equal(add.status, 201);

      const list = await env.request("GET", `/api/projects/${id}/members`, {
        token: candidate.token
      });
      assert.equal(list.status, 200);
      assert.ok(JSON.stringify(list.json.data).includes(candidate.id));
    });

    it("rejects adding the same member twice with 409", async () => {
      const again = await env.request("POST", `/api/projects/${id}/members`, {
        token: owner.token,
        body: { userId: candidate.id }
      });

      assert.equal(again.status, 409);
    });

    it("rejects invalid role, invalid user id and unknown user", async () => {
      const badRole = await env.request("POST", `/api/projects/${id}/members`, {
        token: owner.token,
        body: { userId: outsider.id, role: "ADMIN" }
      });
      const badId = await env.request("POST", `/api/projects/${id}/members`, {
        token: owner.token,
        body: { userId: "not-an-id" }
      });
      const unknown = await env.request("POST", `/api/projects/${id}/members`, {
        token: owner.token,
        body: { userId: MISSING_ID }
      });

      assert.equal(badRole.status, 400);
      assert.equal(badId.status, 400);
      assert.equal(unknown.status, 404);
    });

    it("stops a plain member and an outsider from managing members", async () => {
      const byMember = await env.request("POST", `/api/projects/${id}/members`, {
        token: candidate.token,
        body: { userId: outsider.id }
      });
      const byOutsider = await env.request("GET", `/api/projects/${id}/members`, {
        token: outsider.token
      });
      const roleChange = await env.request(
        "PATCH",
        `/api/projects/${id}/members/${candidate.id}/role`,
        { token: candidate.token, body: { role: "PROJECT_MANAGER" } }
      );

      assert.equal(byMember.status, 403);
      assert.equal(byOutsider.status, 403);
      assert.equal(roleChange.status, 403);
    });

    it("lets the owner change a role and remove the member", async () => {
      const role = await env.request(
        "PATCH",
        `/api/projects/${id}/members/${candidate.id}/role`,
        { token: owner.token, body: { role: "PROJECT_MANAGER" } }
      );
      assert.equal(role.status, 200);

      const badRole = await env.request(
        "PATCH",
        `/api/projects/${id}/members/${candidate.id}/role`,
        { token: owner.token, body: { role: "OWNER" } }
      );
      assert.equal(badRole.status, 400);

      const removed = await env.request(
        "DELETE",
        `/api/projects/${id}/members/${candidate.id}`,
        { token: owner.token }
      );
      assert.equal(removed.status, 200);

      const after = await env.request("GET", `/api/projects/${id}`, { token: candidate.token });
      assert.equal(after.status, 403);
    });

    it("returns 400 for invalid ids in membership paths", async () => {
      const res = await env.request("DELETE", `/api/projects/${id}/members/not-an-id`, {
        token: owner.token
      });

      assert.equal(res.status, 400);
    });
  });
});
