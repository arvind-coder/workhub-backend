import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { skipReason, startTestEnv, type TestEnv } from "./helpers/test-env.js";

describe("debug routes in development", { skip: skipReason }, () => {
  let env: TestEnv;

  before(async () => {
    env = await startTestEnv({ env: { NODE_ENV: "development" } });
  });

  after(async () => {
    await env.stop();
  });

  it("registers the debug routes only when NODE_ENV is development", async () => {
    const known = await env.request("GET", "/api/projects/test-error");

    assert.equal(known.status, 400);
    assert.equal(known.json.message, "This is a test error");
  });

  it("returns a generic 500 body and never the thrown message", async () => {
    const res = await env.request("GET", "/api/projects/test-unknown-error");

    assert.equal(res.status, 500);
    assert.deepEqual(res.json, { success: false, message: "Internal server error" });
    assert.equal(res.text.includes("Database connection failed"), false);
  });
});
