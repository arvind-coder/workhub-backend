import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { skipReason, startTestEnv, type TestEnv } from "./helpers/test-env.js";

describe("general API rate limiting", { skip: skipReason }, () => {
  let env: TestEnv;

  before(async () => {
    env = await startTestEnv({ env: { API_RATE_LIMIT_MAX: "3" } });
  });

  after(async () => {
    await env.stop();
  });

  it("returns 429 for /api routes once the general limit is reached", async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 4; i++) {
      statuses.push((await env.request("GET", "/api/auth/me")).status);
    }

    assert.deepEqual(statuses, [401, 401, 401, 429]);
  });

  it("does not rate-limit /health", async () => {
    for (let i = 0; i < 6; i++) {
      assert.equal((await env.request("GET", "/health")).status, 200);
    }
  });
});
