import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { skipReason, startTestEnv, type TestEnv } from "./helpers/test-env.js";

// Express 5 exposes routers as { stack: Layer[] }; collect "METHOD path".
const collectRoutes = (router: any, prefix: string): string[] => {
  const found: string[] = [];

  for (const layer of router.stack as any[]) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        found.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    }
  }

  return found;
};

const toOpenApiPath = (path: string) =>
  path.replace(/:([A-Za-z]+)/g, "{$1}").replace(/(.)\/$/, "$1");

describe("API documentation", { skip: skipReason }, () => {
  let env: TestEnv;

  before(async () => {
    // development: docs enabled by default, debug routes present (excluded below)
    env = await startTestEnv({ env: { NODE_ENV: "development" } });
  });

  after(async () => {
    await env.stop();
  });

  it("serves a valid-looking OpenAPI 3 document without authentication", async () => {
    const res = await env.request("GET", "/api/docs/openapi.json");

    assert.equal(res.status, 200);
    assert.match(res.json.openapi, /^3\.0\./);
    assert.ok(res.json.components.securitySchemes.bearerAuth);
    assert.ok(res.json.components.schemas.Error);
  });

  it("serves the Swagger UI page", async () => {
    const res = await env.request("GET", "/api/docs/");

    assert.equal(res.status, 200);
    assert.match(res.text, /swagger-ui/i);
  });

  it("does not describe or expose test-only routes or configuration", async () => {
    const res = await env.request("GET", "/api/docs/openapi.json");

    assert.equal(/test-error|test-unknown|debug/i.test(res.text), false);
    assert.equal(/JWT_|MONGODB_URI|secret/i.test(res.text), false);
  });

  it("documents exactly the routes the application registers", async () => {
    const [{ default: authRoutes }, { default: taskRoutes }, { default: projectRoutes }] =
      await Promise.all([
        import("../src/modules/auth/auth.routes.js"),
        import("../src/modules/tasks/task.routes.js"),
        import("../src/modules/projects/project.routes.js")
      ]);

    const actual = new Set(
      [
        ...collectRoutes(authRoutes, "/api/auth"),
        ...collectRoutes(taskRoutes, "/api/projects"),
        ...collectRoutes(projectRoutes, "/api/projects")
      ]
        .filter((route) => !/\/test-/.test(route))
        .map((route) => toOpenApiPath(route))
    );
    actual.add("GET /health");

    const spec = (await env.request("GET", "/api/docs/openapi.json")).json;
    const documented = new Set<string>();

    for (const [path, item] of Object.entries<any>(spec.paths)) {
      for (const method of ["get", "post", "patch", "put", "delete"]) {
        if (item[method]) documented.add(`${method.toUpperCase()} ${path}`);
      }
    }

    assert.deepEqual([...documented].sort(), [...actual].sort());
  });

  it("only references schemas that exist", async () => {
    const spec = (await env.request("GET", "/api/docs/openapi.json")).json;
    const refs = [...JSON.stringify(spec).matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]);

    assert.ok(refs.length > 20);
    for (const name of refs) {
      assert.ok(spec.components.schemas[name as string], `missing schema ${name}`);
    }
  });

  it("matches real responses for the main shapes", async () => {
    const spec = (await env.request("GET", "/api/docs/openapi.json")).json;
    const { createUser, createProject, createTask } = await import("./helpers/test-env.js");

    const owner = await createUser(env, "PROJECT_MANAGER");
    const projectId = await createProject(env, owner);
    const task = await createTask(env, owner, projectId, { dueDate: "2099-01-01T00:00:00.000Z" });
    const stats = await env.request("GET", `/api/projects/${projectId}/stats`, { token: owner.token });

    const keysOf = (schema: string) => Object.keys(spec.components.schemas[schema].properties).sort();

    assert.deepEqual(Object.keys(task).sort(), keysOf("Task").filter((k) => k !== "assignedTo"));
    assert.deepEqual(Object.keys(stats.json.data).sort(), keysOf("ProjectStats"));
    assert.deepEqual(Object.keys(stats.json.data.summary).sort(), Object.keys(spec.components.schemas.ProjectStats.properties.summary.properties).sort());
  });

  it("does not accept write methods on the docs routes", async () => {
    assert.equal((await env.request("POST", "/api/docs/openapi.json", { body: {} })).status, 404);
  });
});
