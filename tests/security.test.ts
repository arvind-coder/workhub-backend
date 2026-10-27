import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

import {
  createUser,
  skipReason,
  startTestEnv,
  type TestEnv
} from "./helpers/test-env.js";

describe("http security and error responses", { skip: skipReason }, () => {
  let env: TestEnv;

  before(async () => {
    env = await startTestEnv();
  });

  after(async () => {
    await env.stop();
  });

  const assertErrorShape = (json: unknown) => {
    assert.ok(json && typeof json === "object");
    const body = json as Record<string, unknown>;

    assert.equal(body.success, false);
    assert.equal(typeof body.message, "string");
    assert.deepEqual(Object.keys(body).sort(), ["message", "success"]);
  };

  describe("headers", () => {
    it("sets Helmet headers and hides X-Powered-By", async () => {
      const res = await env.request("GET", "/health");

      assert.equal(res.headers.get("x-powered-by"), null);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.ok(res.headers.get("strict-transport-security"));
      assert.ok(res.headers.get("content-security-policy"));
    });
  });

  describe("CORS", () => {
    it("echoes an allow-listed origin", async () => {
      const res = await env.request("GET", "/health", {
        headers: { Origin: "http://localhost:3000" }
      });

      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get("access-control-allow-origin"),
        "http://localhost:3000"
      );
    });

    it("rejects an origin that is not on the allow-list", async () => {
      const res = await env.request("GET", "/health", {
        headers: { Origin: "http://evil.example" }
      });

      assert.equal(res.status, 403);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
      assertErrorShape(res.json);
    });

    it("allows same-origin requests (e.g. the Swagger UI served by this app)", async () => {
      const res = await env.request("POST", "/api/auth/login", {
        headers: { Origin: env.baseUrl },
        body: { email: "nobody@example.com", password: "wrong-password" }
      });

      // Reaches the login handler (401), instead of being stopped by CORS (403).
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("access-control-allow-origin"), env.baseUrl);
    });

    it("does not treat a look-alike origin as allowed", async () => {
      for (const origin of [
        "http://localhost:3000.evil.example",
        "https://localhost:3000",
        "http://localhost:3001",
        // Same host name as the server but a different port is another origin.
        "http://127.0.0.1:1",
        `${env.baseUrl}.evil.example`
      ]) {
        const res = await env.request("GET", "/health", {
          headers: { Origin: origin }
        });

        assert.equal(res.status, 403, origin);
      }
    });

    it("allows requests with no Origin header (curl, server-to-server)", async () => {
      assert.equal((await env.request("GET", "/health")).status, 200);
    });

    it("answers a preflight for an allowed origin only", async () => {
      const allowed = await env.request("OPTIONS", "/api/projects", {
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type"
        }
      });

      assert.equal(allowed.status, 204);
      assert.match(allowed.headers.get("access-control-allow-methods") ?? "", /POST/);

      const denied = await env.request("OPTIONS", "/api/projects", {
        headers: {
          Origin: "http://evil.example",
          "Access-Control-Request-Method": "POST"
        }
      });

      assert.equal(denied.status, 403);
    });
  });

  describe("request bodies", () => {
    it("returns 400 for malformed JSON", async () => {
      const res = await env.request("POST", "/api/auth/login", { rawBody: "{bad" });

      assert.equal(res.status, 400);
      assertErrorShape(res.json);
      assert.equal(res.text.includes("SyntaxError"), false);
    });

    it("returns 413 for a body over the 100kb limit", async () => {
      const res = await env.request("POST", "/api/auth/login", {
        rawBody: JSON.stringify({ email: "a@example.com", password: "x".repeat(200_000) })
      });

      assert.equal(res.status, 413);
      assertErrorShape(res.json);
    });

    it("treats a missing body as an empty object (400, not 500)", async () => {
      // PROJECT_MANAGER so POST /api/projects reaches body validation.
      const user = await createUser(env, "PROJECT_MANAGER");

      for (const [method, url] of [
        ["POST", "/api/auth/login"],
        ["POST", "/api/auth/refresh"],
        ["POST", "/api/projects"]
      ] as const) {
        const res = await env.request(method, url, { token: user.token });

        assert.equal(res.status, 400, `${method} ${url}`);
        assertErrorShape(res.json);
      }
    });

    it("rejects a JSON array or scalar body with 400", async () => {
      assert.equal(
        (await env.request("POST", "/api/auth/login", { rawBody: "[]" })).status,
        400
      );
      assert.equal(
        (await env.request("POST", "/api/auth/login", { rawBody: "\"text\"" })).status,
        400
      );
    });
  });

  describe("error response shape", () => {
    it("uses { success:false, message } for 401, 403, 404 and 400", async () => {
      const user = await createUser(env);
      const other = await createUser(env);

      const created = await env.request("POST", "/api/projects", {
        token: (await createUser(env, "PROJECT_MANAGER")).token,
        body: { name: "Private", description: "d" }
      });
      const projectId = created.json.data.id as string;

      const cases = [
        [await env.request("GET", "/api/auth/me"), 401],
        [await env.request("GET", `/api/projects/${projectId}`, { token: other.token }), 403],
        [await env.request("GET", "/api/no-such-route", { token: user.token }), 404],
        [await env.request("GET", "/api/projects/not-an-id", { token: user.token }), 400]
      ] as const;

      for (const [res, status] of cases) {
        assert.equal(res.status, status);
        assertErrorShape(res.json);
      }
    });

    it("never leaks stack traces or file paths", async () => {
      const res = await env.request("POST", "/api/auth/login", { rawBody: "{bad" });

      assert.equal(/\bat .*\(.*:\d+:\d+\)/.test(res.text), false);
      assert.equal(res.text.includes("node_modules"), false);
    });
  });

  describe("health", () => {
    it("reports 200 while the database is connected", async () => {
      const res = await env.request("GET", "/health");

      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
    });

    it("reports 503 while the database is disconnected", async () => {
      // readyState is a prototype getter: shadow it on the instance, then
      // delete the shadow to restore the real behaviour.
      Object.defineProperty(mongoose.connection, "readyState", {
        configurable: true,
        get: () => 0
      });

      try {
        const res = await env.request("GET", "/health");

        assert.equal(res.status, 503);
        assertErrorShape(res.json);
      } finally {
        delete (mongoose.connection as { readyState?: number }).readyState;
      }

      assert.equal((await env.request("GET", "/health")).status, 200);
    });
  });
});
