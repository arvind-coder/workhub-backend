import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createUser, skipReason, startTestEnv, type TestEnv } from "./helpers/test-env.js";

// Walk the Express router tree (Express 5: app.router.stack).
const collectRoutePaths = (stack: unknown[], found: string[] = []): string[] => {
  for (const layer of stack as Array<Record<string, any>>) {
    if (layer.route?.path) {
      found.push(String(layer.route.path));
    }

    if (Array.isArray(layer.handle?.stack)) {
      collectRoutePaths(layer.handle.stack, found);
    }
  }

  return found;
};

describe("debug routes in production", { skip: skipReason }, () => {
  let env: TestEnv;
  let app: unknown;

  before(async () => {
    env = await startTestEnv({ env: { NODE_ENV: "production" } });
    // Imported after startTestEnv so configuration is read in production mode.
    app = (await import("../src/app.js")).default;
  });

  after(async () => {
    await env.stop();
  });

  it("registers no test or debug routes on any router", () => {
    const paths = collectRoutePaths((app as any).router.stack);

    assert.ok(paths.length > 20, "route tree was actually inspected");
    assert.deepEqual(
      paths.filter((path) => /test|debug/i.test(path)),
      []
    );
  });

  it("keeps the health endpoint and normal APIs available", async () => {
    assert.equal((await env.request("GET", "/health")).status, 200);
    assert.equal((await env.request("GET", "/api/projects")).status, 401);
  });

  it("does not expose the debug paths, even to authenticated users", async () => {
    const user = await createUser(env);

    for (const path of ["/api/projects/test-error", "/api/projects/test-unknown-error"]) {
      const anonymous = await env.request("GET", path);
      const authed = await env.request("GET", path, { token: user.token });

      assert.equal(anonymous.status, 401, path);
      // Falls through to GET /:id, which rejects the non-ObjectId.
      assert.equal(authed.status, 400, path);
      assert.notEqual(authed.json.message, "This is a test error");
    }
  });

  it("does not serve API docs by default in production", async () => {
    assert.equal((await env.request("GET", "/api/docs")).status, 404);
    assert.equal((await env.request("GET", "/api/docs/openapi.json")).status, 404);
  });
});
