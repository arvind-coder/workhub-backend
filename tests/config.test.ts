import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { loadEnv } from "../src/config/env.js";

const secret = () => randomBytes(32).toString("hex");

const validEnv = (): Record<string, string> => ({
  MONGODB_URI: "mongodb://127.0.0.1:27017/workhub_test_config",
  JWT_ACCESS_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  CORS_ORIGINS: "http://localhost:3000",
  TRUST_PROXY: "0",
  NODE_ENV: "development"
});

describe("loadEnv (unit)", () => {
  const saved = { ...process.env };

  const resetEnv = () => {
    for (const key of [
      "MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGINS",
      "TRUST_PROXY", "AUTH_RATE_LIMIT_MAX", "API_RATE_LIMIT_MAX",
      "ENABLE_API_DOCS", "NODE_ENV"
    ]) {
      delete process.env[key];
    }
  };

  beforeEach(resetEnv);

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  });

  const withEnv = (values: Record<string, string>) => {
    Object.assign(process.env, values);
  };

  it("accepts a complete configuration and applies defaults", () => {
    withEnv(validEnv());
    const env = loadEnv();

    assert.deepEqual(env.corsOrigins, ["http://localhost:3000"]);
    assert.equal(env.trustProxy, 0);
    assert.equal(env.authRateLimitMax, 10);
    assert.equal(env.apiRateLimitMax, 300);
    assert.equal(env.isProduction, false);
    assert.equal(env.apiDocsEnabled, true);
  });

  for (const key of ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    it(`fails when ${key} is missing or blank`, () => {
      withEnv({ ...validEnv(), [key]: "   " });

      assert.throws(() => loadEnv(), new RegExp(`${key} is not defined`));
    });
  }

  it("rejects JWT secrets shorter than 32 characters", () => {
    withEnv({ ...validEnv(), JWT_ACCESS_SECRET: "short-secret" });

    assert.throws(() => loadEnv(), /at least 32 characters/);
  });

  it("rejects identical access and refresh secrets", () => {
    const same = secret();
    withEnv({ ...validEnv(), JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same });

    assert.throws(() => loadEnv(), /must differ/);
  });

  it("never puts secret values in error messages", () => {
    const short = "short-secret-value";
    withEnv({ ...validEnv(), JWT_ACCESS_SECRET: short });

    try {
      loadEnv();
      assert.fail("expected loadEnv to throw");
    } catch (error) {
      assert.equal((error as Error).message.includes(short), false);
    }
  });

  it("parses multiple CORS origins and ignores blanks", () => {
    withEnv({
      ...validEnv(),
      CORS_ORIGINS: " https://app.example.com , http://localhost:3000 ,, "
    });

    assert.deepEqual(loadEnv().corsOrigins, [
      "https://app.example.com",
      "http://localhost:3000"
    ]);
  });

  for (const bad of [
    "*",
    "https://*.example.com",
    "https://app.example.com/",
    "https://app.example.com/path",
    "app.example.com",
    "ftp://app.example.com"
  ]) {
    it(`rejects CORS origin "${bad}"`, () => {
      withEnv({ ...validEnv(), CORS_ORIGINS: bad });

      assert.throws(() => loadEnv(), /CORS_ORIGINS/);
    });
  }

  it("allows an empty CORS list (no browser origin is accepted)", () => {
    withEnv({ ...validEnv(), CORS_ORIGINS: "" });

    assert.deepEqual(loadEnv().corsOrigins, []);
  });

  it("validates numeric settings", () => {
    withEnv({ ...validEnv(), TRUST_PROXY: "2", AUTH_RATE_LIMIT_MAX: "5" });
    const env = loadEnv();

    assert.equal(env.trustProxy, 2);
    assert.equal(env.authRateLimitMax, 5);

    for (const [key, value] of [
      ["TRUST_PROXY", "-1"],
      ["TRUST_PROXY", "x"],
      ["AUTH_RATE_LIMIT_MAX", "0"],
      ["API_RATE_LIMIT_MAX", "1.5"]
    ] as const) {
      resetEnv();
      withEnv({ ...validEnv(), [key]: value });
      assert.throws(() => loadEnv(), new RegExp(key), `${key}=${value}`);
    }
  });

  it("disables API docs by default only in production", () => {
    withEnv({ ...validEnv(), NODE_ENV: "production" });
    assert.equal(loadEnv().apiDocsEnabled, false);

    resetEnv();
    withEnv({ ...validEnv(), NODE_ENV: "production", ENABLE_API_DOCS: "true" });
    assert.equal(loadEnv().apiDocsEnabled, true);

    resetEnv();
    withEnv({ ...validEnv(), NODE_ENV: "development", ENABLE_API_DOCS: "false" });
    assert.equal(loadEnv().apiDocsEnabled, false);

    resetEnv();
    withEnv({ ...validEnv(), ENABLE_API_DOCS: "maybe" });
    assert.throws(() => loadEnv(), /ENABLE_API_DOCS/);
  });
});

// Boots the real server entry point with a hostile environment. Each case
// must exit non-zero with one concise message and no stack trace. The real
// .env file is ignored (DOTENV_CONFIG_PATH) so results are reproducible.
describe("server startup failures (child process)", () => {
  const boot = (overrides: Record<string, string>) =>
    new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "src/server.ts"],
        {
          env: {
            PATH: process.env.PATH ?? "",
            HOME: process.env.HOME ?? "",
            DOTENV_CONFIG_PATH: "/nonexistent/.env",
            DOTENV_CONFIG_QUIET: "true",
            PORT: "0",
            ...validEnv(),
            ...overrides
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      let output = "";
      child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("server neither exited nor failed within 40s"));
      }, 40_000);

      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ code, output });
      });
    });

  const assertConcise = (output: string, secrets: string[] = []) => {
    assert.match(output, /Failed to start server: /);
    assert.equal(/\n\s+at /.test(output), false, "no stack trace");
    assert.equal(output.includes("node_modules"), false);

    for (const value of secrets) {
      assert.equal(output.includes(value), false, "secret leaked");
    }
  };

  it("exits 1 with a clear message for a short JWT secret", async () => {
    const short = "short-secret-value";
    const { code, output } = await boot({ JWT_ACCESS_SECRET: short });

    assert.equal(code, 1);
    assert.match(output, /at least 32 characters/);
    assertConcise(output, [short]);
  });

  it("exits 1 when the two JWT secrets are identical", async () => {
    const same = secret();
    const { code, output } = await boot({
      JWT_ACCESS_SECRET: same,
      JWT_REFRESH_SECRET: same
    });

    assert.equal(code, 1);
    assert.match(output, /must differ/);
    assertConcise(output, [same]);
  });

  it("exits 1 when MONGODB_URI is missing", async () => {
    const { code, output } = await boot({ MONGODB_URI: "" });

    assert.equal(code, 1);
    assert.match(output, /MONGODB_URI is not defined/);
    assertConcise(output);
  });

  it("exits 1 for an invalid CORS_ORIGINS entry", async () => {
    const { code, output } = await boot({ CORS_ORIGINS: "*" });

    assert.equal(code, 1);
    assert.match(output, /CORS_ORIGINS/);
    assertConcise(output);
  });

  it("exits 1 without leaking credentials when MongoDB is unreachable", async () => {
    const password = "p4ssw0rd-should-not-appear";
    const { code, output } = await boot({
      MONGODB_URI: `mongodb://user:${password}@127.0.0.1:1/workhub_test_x`
    });

    assert.equal(code, 1);
    assert.match(output, /Failed to start server: /);
    assertConcise(output, [password]);
  });
});
