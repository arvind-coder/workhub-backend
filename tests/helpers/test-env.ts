import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import mongoose from "mongoose";

// Thrown when no disposable MongoDB can be provided. Test files turn this
// into an explicit "skipped" result instead of a silent pass.
export class TestInfrastructureUnavailable extends Error {}

// Every database touched by the suite must start with this prefix. All
// destructive calls re-check it, so a real database can never be dropped.
export const TEST_DB_PREFIX = "workhub_test_";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface ApiResponse {
  status: number;
  json: Json;
  headers: Headers;
  text: string;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  // Sent as-is (used for malformed JSON / oversized payload tests).
  rawBody?: string;
  headers?: Record<string, string>;
}

// Evaluated synchronously so test files can pass it to describe({ skip }).
// A skipped suite is reported as skipped, never as passed.
export const skipReason: string | false = process.env.TEST_MONGODB_URI?.trim()
  ? false
  : spawnSync("mongod", ["--version"], { stdio: "ignore" }).status === 0
    ? false
    : "mongod not found in PATH and TEST_MONGODB_URI is not set";

const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();

      probe.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not allocate a port"));
        }
      });
    });
  });

interface MongoHandle {
  baseUri: string;
  stop: () => Promise<void>;
}

// Starts a throwaway mongod in a fresh temp directory on a random port.
const startDisposableMongod = async (): Promise<MongoHandle> => {
  const dbPath = await mkdtemp(path.join(tmpdir(), "workhub-test-mongo-"));
  const port = await getFreePort();

  const child: ChildProcess = spawn(
    "mongod",
    [
      "--dbpath", dbPath,
      "--port", String(port),
      "--bind_ip", "127.0.0.1",
      "--nounixsocket"
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  // Last-resort cleanup if a hook fails before stop() runs.
  process.once("exit", () => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });

  const cleanup = async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }

    await rm(dbPath, { recursive: true, force: true });
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new TestInfrastructureUnavailable("mongod did not become ready in 30s")),
        30_000
      );

      child.once("error", (error) => {
        clearTimeout(timer);
        reject(new TestInfrastructureUnavailable(`mongod could not start: ${error.message}`));
      });

      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new TestInfrastructureUnavailable(`mongod exited early (code ${code})`));
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("Waiting for connections")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  } catch (error) {
    await cleanup();
    throw error;
  }

  return { baseUri: `mongodb://127.0.0.1:${port}`, stop: cleanup };
};

export interface TestEnv {
  baseUrl: string;
  dbName: string;
  request: (
    method: string,
    urlPath: string,
    options?: RequestOptions
  ) => Promise<ApiResponse>;
  stop: () => Promise<void>;
}

export interface StartTestEnvOptions {
  // Extra process.env values applied before the app module is imported.
  env?: Record<string, string>;
}

// Boots the real Express app against an isolated database and returns a
// small HTTP client. Must be called before anything imports src/app.ts,
// because configuration is read when that module is evaluated.
export const startTestEnv = async (
  options: StartTestEnvOptions = {}
): Promise<TestEnv> => {
  // Drop only the per-request access-log lines to keep test output readable.
  const originalLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      /^(GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD) \//.test(args[0])
    ) {
      return;
    }

    originalLog(...args);
  };

  const dbName = `${TEST_DB_PREFIX}${randomBytes(6).toString("hex")}`;

  let mongo: MongoHandle | undefined;
  let baseUri: string;

  const externalUri = process.env.TEST_MONGODB_URI?.trim();

  if (externalUri) {
    baseUri = externalUri.replace(/\/+$/, "");
  } else {
    mongo = await startDisposableMongod();
    baseUri = mongo.baseUri;
  }

  // Secrets are random per run and never printed.
  Object.assign(process.env, {
    NODE_ENV: "test",
    CORS_ORIGINS: "http://localhost:3000",
    TRUST_PROXY: "0",
    AUTH_RATE_LIMIT_MAX: "100000",
    API_RATE_LIMIT_MAX: "100000",
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    MONGODB_URI: `${baseUri}/${dbName}`,
    ...options.env
  });

  await mongoose.connect(`${baseUri}/${dbName}`);

  const { default: app } = await import("../../src/app.js");

  // Build indexes (notably the unique email index) before any request.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );

  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server failed to bind");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request: TestEnv["request"] = async (
    method,
    urlPath,
    { token, body, rawBody, headers } = {}
  ) => {
    const payload =
      rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined);

    const response = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        ...(payload !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      ...(payload !== undefined ? { body: payload } : {})
    });

    const text = await response.text();
    let json: Json;

    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    return { status: response.status, json, headers: response.headers, text };
  };

  const stop = async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });

    // Only ever drop the database this run created.
    if (mongoose.connection.name.startsWith(TEST_DB_PREFIX)) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
    await mongo?.stop();
  };

  return { baseUrl, dbName, request, stop };
};

// ---- fixtures -------------------------------------------------------

let counter = 0;

export const uniqueEmail = (label = "user"): string =>
  `${label}-${Date.now().toString(36)}-${counter++}@example.com`;

export interface TestUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
}

// Registers and logs in a user through the public API. Roles other than
// MEMBER cannot be self-assigned, so they are set directly in the isolated
// test database and the user logs in again to get a token with that role.
export const createUser = async (
  env: TestEnv,
  role: "ADMIN" | "PROJECT_MANAGER" | "MEMBER" = "MEMBER",
  label = role.toLowerCase()
): Promise<TestUser> => {
  const email = uniqueEmail(label);
  const password = "Passw0rd!test";

  const registered = await env.request("POST", "/api/auth/register", {
    body: { name: `Test ${label}`, email, password }
  });

  if (registered.status !== 201) {
    throw new Error(`Fixture registration failed (${registered.status})`);
  }

  if (role !== "MEMBER") {
    if (!mongoose.connection.name.startsWith(TEST_DB_PREFIX)) {
      throw new Error("Refusing to modify a non-test database");
    }

    await mongoose.connection
      .collection("users")
      .updateOne({ email }, { $set: { role } });
  }

  const login = await env.request("POST", "/api/auth/login", {
    body: { email, password }
  });

  return {
    id: registered.json.data.id as string,
    email,
    token: login.json.data.accessToken as string,
    refreshToken: login.json.data.refreshToken as string
  };
};

export const createProject = async (
  env: TestEnv,
  owner: TestUser,
  name = "Test project"
): Promise<string> => {
  const response = await env.request("POST", "/api/projects", {
    token: owner.token,
    body: { name, description: "Project used by automated tests" }
  });

  if (response.status !== 201) {
    throw new Error(`Fixture project failed (${response.status})`);
  }

  return response.json.data.id as string;
};

export const addMember = async (
  env: TestEnv,
  owner: TestUser,
  projectId: string,
  member: TestUser,
  role: "MEMBER" | "PROJECT_MANAGER" = "MEMBER"
): Promise<void> => {
  const response = await env.request(
    "POST",
    `/api/projects/${projectId}/members`,
    { token: owner.token, body: { userId: member.id, role } }
  );

  if (response.status !== 201) {
    throw new Error(`Fixture membership failed (${response.status})`);
  }
};

export const createTask = async (
  env: TestEnv,
  user: TestUser,
  projectId: string,
  body: Record<string, unknown> = {}
): Promise<Json> => {
  const response = await env.request(
    "POST",
    `/api/projects/${projectId}/tasks`,
    {
      token: user.token,
      body: { title: "Test task", description: "Task description", ...body }
    }
  );

  if (response.status !== 201) {
    throw new Error(`Fixture task failed (${response.status}: ${response.text})`);
  }

  return response.json.data;
};
