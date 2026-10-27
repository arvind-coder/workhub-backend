import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  skipReason,
  startTestEnv,
  uniqueEmail,
  type TestEnv
} from "./helpers/test-env.js";

// The limiter counts every request to /api/auth/*, successful or not
// (express-rate-limit default), so brute-force attempts cannot be hidden
// among successful logins. The limit here is 3 per window.
describe("auth rate limiting", { skip: skipReason }, () => {
  let env: TestEnv;

  before(async () => {
    env = await startTestEnv({ env: { AUTH_RATE_LIMIT_MAX: "3" } });
  });

  after(async () => {
    await env.stop();
  });

  it("returns 429 after the configured number of auth requests", async () => {
    const email = uniqueEmail("rl");
    const password = "Passw0rd!test";

    const first = await env.request("POST", "/api/auth/register", {
      body: { name: "RL", email, password }
    });
    const failed = await env.request("POST", "/api/auth/login", {
      body: { email, password: "wrong-password" }
    });
    const ok = await env.request("POST", "/api/auth/login", {
      body: { email, password }
    });

    assert.deepEqual([first.status, failed.status, ok.status], [201, 401, 200]);

    const limited = await env.request("POST", "/api/auth/login", {
      body: { email, password }
    });

    assert.equal(limited.status, 429);
    assert.deepEqual(limited.json, {
      success: false,
      message: "Too many authentication attempts, please try again later"
    });
    assert.ok(limited.headers.get("ratelimit") ?? limited.headers.get("ratelimit-policy"));
  });

  it("limits refresh and logout too", async () => {
    for (const path of ["/api/auth/refresh", "/api/auth/logout"]) {
      const res = await env.request("POST", path, { body: {} });

      assert.equal(res.status, 429, path);
    }
  });

  it("does not apply the auth limit to non-auth routes", async () => {
    assert.equal((await env.request("GET", "/health")).status, 200);
  });
});
