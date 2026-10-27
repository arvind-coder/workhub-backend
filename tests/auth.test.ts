import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import {
  createUser,
  skipReason,
  startTestEnv,
  uniqueEmail,
  type TestEnv
} from "./helpers/test-env.js";

const PASSWORD = "Passw0rd!test";

describe("authentication", { skip: skipReason }, () => {
  let env: TestEnv;

  before(async () => {
    env = await startTestEnv();
  });

  after(async () => {
    mock.restoreAll();
    await env.stop();
  });

  const register = (body: unknown) =>
    env.request("POST", "/api/auth/register", { body });

  describe("registration", () => {
    it("registers a user and never returns the password", async () => {
      const email = uniqueEmail("reg");
      const res = await register({ name: "Reg", email, password: PASSWORD });

      assert.equal(res.status, 201);
      assert.equal(res.json.success, true);
      assert.equal(res.json.data.email, email);
      assert.equal(res.json.data.role, "MEMBER");
      assert.equal("password" in res.json.data, false);
      assert.equal(res.text.includes(PASSWORD), false);
    });

    it("normalises email case and whitespace", async () => {
      const email = uniqueEmail("case");
      const res = await register({
        name: "Case",
        email: `  ${email.toUpperCase()}  `,
        password: PASSWORD
      });

      assert.equal(res.status, 201);
      assert.equal(res.json.data.email, email);
    });

    const invalidBodies: Array<[string, unknown]> = [
      ["missing name", { email: "a@example.com", password: PASSWORD }],
      ["blank name", { name: "  ", email: "a@example.com", password: PASSWORD }],
      ["name too long", { name: "x".repeat(101), email: "a@example.com", password: PASSWORD }],
      ["missing email", { name: "A", password: PASSWORD }],
      ["malformed email", { name: "A", email: "not-an-email", password: PASSWORD }],
      ["email not a string", { name: "A", email: 5, password: PASSWORD }],
      ["short password", { name: "A", email: "a@example.com", password: "12345" }],
      ["password over 72 chars", { name: "A", email: "a@example.com", password: "p".repeat(73) }],
      ["password not a string", { name: "A", email: "a@example.com", password: 123456 }]
    ];

    for (const [label, body] of invalidBodies) {
      it(`rejects ${label} with 400`, async () => {
        const res = await register(body);

        assert.equal(res.status, 400);
        assert.equal(res.json.success, false);
        assert.equal(typeof res.json.message, "string");
      });
    }

    it("rejects a duplicate email with 409", async () => {
      const email = uniqueEmail("dup");

      assert.equal((await register({ name: "A", email, password: PASSWORD })).status, 201);

      const second = await register({ name: "B", email, password: PASSWORD });

      assert.equal(second.status, 409);
      assert.equal(second.json.message, "Email is already registered");
    });

    it("rejects a request with no body with 400, not 500", async () => {
      const res = await env.request("POST", "/api/auth/register");

      assert.equal(res.status, 400);
    });
  });

  describe("duplicate-registration race", () => {
    it("the database enforces a unique email index", async () => {
      const indexes = await mongoose.connection
        .collection("users")
        .indexes();

      const emailIndex = indexes.find(
        (index) => JSON.stringify(index.key) === JSON.stringify({ email: 1 })
      );

      assert.ok(emailIndex, "email index exists");
      assert.equal(emailIndex.unique, true);
    });

    it("two simultaneous registrations create exactly one account", async () => {
      const email = uniqueEmail("race");

      // Second request differs only by case to prove normalisation applies.
      const [a, b] = await Promise.all([
        register({ name: "Racer A", email, password: PASSWORD }),
        register({ name: "Racer B", email: email.toUpperCase(), password: PASSWORD })
      ]);

      // Whether the loser is stopped by the pre-check or by the unique
      // index depends on timing; both must produce the same 409.
      assert.deepEqual([a.status, b.status].sort(), [201, 409]);

      const loser = a.status === 409 ? a : b;
      assert.equal(loser.json.message, "Email is already registered");

      const count = await mongoose.connection
        .collection("users")
        .countDocuments({ email });

      assert.equal(count, 1);
    });

    it("maps a genuine E11000 (pre-check bypassed) to the same 409", async () => {
      const { UserModel } = await import("../src/modules/users/user.model.js");
      const email = uniqueEmail("e11000");

      assert.equal((await register({ name: "First", email, password: PASSWORD })).status, 201);

      // Simulate the losing side of a race: the pre-check sees no user, so
      // the insert itself must hit the unique index.
      const findOne = mock.method(UserModel, "findOne", () =>
        Promise.resolve(null) as never
      );

      try {
        const res = await register({ name: "Second", email, password: PASSWORD });

        assert.ok(findOne.mock.callCount() >= 1, "pre-check was bypassed");
        assert.equal(res.status, 409);
        assert.equal(res.json.message, "Email is already registered");
      } finally {
        findOne.mock.restore();
      }

      const count = await mongoose.connection
        .collection("users")
        .countDocuments({ email });

      assert.equal(count, 1);
    });
  });

  describe("login", () => {
    it("logs in with valid credentials", async () => {
      const email = uniqueEmail("login");
      await register({ name: "L", email, password: PASSWORD });

      const res = await env.request("POST", "/api/auth/login", {
        body: { email, password: PASSWORD }
      });

      assert.equal(res.status, 200);
      assert.equal(typeof res.json.data.accessToken, "string");
      assert.equal(typeof res.json.data.refreshToken, "string");
      assert.equal(res.json.data.user.email, email);
      assert.equal("password" in res.json.data.user, false);
      assert.equal("refreshTokenHash" in res.json.data.user, false);
    });

    it("returns the same 401 for a wrong password and an unknown email", async () => {
      const email = uniqueEmail("badlogin");
      await register({ name: "L", email, password: PASSWORD });

      const wrongPassword = await env.request("POST", "/api/auth/login", {
        body: { email, password: "wrong-password" }
      });
      const unknownEmail = await env.request("POST", "/api/auth/login", {
        body: { email: uniqueEmail("ghost"), password: PASSWORD }
      });

      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      assert.equal(wrongPassword.json.message, unknownEmail.json.message);
    });

    it("rejects missing credentials with 400", async () => {
      assert.equal((await env.request("POST", "/api/auth/login", { body: {} })).status, 400);
      assert.equal((await env.request("POST", "/api/auth/login")).status, 400);
    });
  });

  describe("access tokens", () => {
    const sign = (
      payload: object,
      options: jwt.SignOptions,
      secret = process.env.JWT_ACCESS_SECRET as string
    ) => jwt.sign(payload, secret, options);

    const goodClaims = {
      algorithm: "HS256",
      issuer: "workhub-api",
      audience: "workhub-client"
    } as const;

    it("accepts a valid token", async () => {
      const user = await createUser(env);
      const res = await env.request("GET", "/api/auth/me", { token: user.token });

      assert.equal(res.status, 200);
      assert.equal(res.json.data.email, user.email);
    });

    it("rejects a missing token with 401", async () => {
      assert.equal((await env.request("GET", "/api/auth/me")).status, 401);
    });

    it("rejects a malformed token with 401", async () => {
      const res = await env.request("GET", "/api/auth/me", { token: "not.a.jwt" });

      assert.equal(res.status, 401);
      assert.equal(res.json.success, false);
    });

    it("rejects a non-Bearer scheme with 401", async () => {
      const res = await env.request("GET", "/api/auth/me", {
        headers: { Authorization: "Basic abc" }
      });

      assert.equal(res.status, 401);
    });

    it("rejects an expired token with 401", async () => {
      const user = await createUser(env);
      const token = sign({ sub: user.id, role: "MEMBER" }, { ...goodClaims, expiresIn: -60 });
      const res = await env.request("GET", "/api/auth/me", { token });

      assert.equal(res.status, 401);
      assert.match(res.json.message, /expired/i);
    });

    it("rejects a token signed with the wrong secret", async () => {
      const user = await createUser(env);
      const token = sign(
        { sub: user.id, role: "MEMBER" },
        { ...goodClaims, expiresIn: 300 },
        "x".repeat(40)
      );

      assert.equal((await env.request("GET", "/api/auth/me", { token })).status, 401);
    });

    it("rejects a legacy token without issuer and audience", async () => {
      const user = await createUser(env);
      const token = sign({ sub: user.id, role: "MEMBER" }, { algorithm: "HS256", expiresIn: 300 });

      assert.equal((await env.request("GET", "/api/auth/me", { token })).status, 401);
    });

    it("rejects the wrong audience", async () => {
      const user = await createUser(env);
      const token = sign(
        { sub: user.id, role: "MEMBER" },
        { ...goodClaims, audience: "someone-else", expiresIn: 300 }
      );

      assert.equal((await env.request("GET", "/api/auth/me", { token })).status, 401);
    });

    it("rejects an unsigned alg:none token", async () => {
      const user = await createUser(env);
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
        sub: user.id,
        role: "ADMIN",
        iss: "workhub-api",
        aud: "workhub-client"
      })}.`;

      assert.equal((await env.request("GET", "/api/auth/me", { token })).status, 401);
    });

    it("rejects a token with an unknown role claim", async () => {
      const user = await createUser(env);
      const token = sign({ sub: user.id, role: "SUPERUSER" }, { ...goodClaims, expiresIn: 300 });

      assert.equal((await env.request("GET", "/api/auth/me", { token })).status, 401);
    });

    it("does not accept a refresh token as an access token", async () => {
      const user = await createUser(env);
      const res = await env.request("GET", "/api/auth/me", { token: user.refreshToken });

      assert.equal(res.status, 401);
    });
  });

  describe("refresh tokens", () => {
    const refresh = (refreshToken: unknown) =>
      env.request("POST", "/api/auth/refresh", { body: { refreshToken } });

    it("rotates the refresh token and revokes the old one", async () => {
      const user = await createUser(env);

      const first = await refresh(user.refreshToken);

      assert.equal(first.status, 200);
      assert.notEqual(first.json.data.refreshToken, user.refreshToken);

      // Reuse of the rotated-out token must fail.
      assert.equal((await refresh(user.refreshToken)).status, 401);

      // The new token works and the new access token is accepted.
      const me = await env.request("GET", "/api/auth/me", {
        token: first.json.data.accessToken
      });
      assert.equal(me.status, 200);
      assert.equal((await refresh(first.json.data.refreshToken)).status, 200);
    });

    it("rejects missing, malformed and access tokens", async () => {
      const user = await createUser(env);

      assert.equal((await refresh(undefined)).status, 400);
      assert.equal((await refresh("garbage")).status, 401);
      assert.equal((await refresh(user.token)).status, 401);
    });

    it("logout revokes the refresh token", async () => {
      const user = await createUser(env);

      const out = await env.request("POST", "/api/auth/logout", {
        body: { refreshToken: user.refreshToken }
      });

      assert.equal(out.status, 200);
      assert.equal((await refresh(user.refreshToken)).status, 401);
    });
  });
});
