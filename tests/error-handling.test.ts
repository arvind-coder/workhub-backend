import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import { AppError } from "../src/middlewares/app-error.js";
import { errorMiddleware } from "../src/middlewares/error.middleware.js";
import { mongooseErrorMiddleware } from "../src/middlewares/mongoose-error.middleware.js";

// These are pure unit tests of the error pipeline: no database needed.

interface Captured {
  status?: number;
  body?: unknown;
}

const run = (error: Error): Captured => {
  const captured: Captured = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    }
  } as unknown as Response;

  // Same order as app.ts: mongoose mapper first, then the global handler.
  const afterMongoose = (forwarded?: unknown) => {
    errorMiddleware(
      (forwarded ?? error) as Error,
      {} as Request,
      res,
      (() => undefined) as NextFunction
    );
  };

  mongooseErrorMiddleware(error, {} as Request, res, afterMongoose as NextFunction);

  return captured;
};

describe("centralised error handling", () => {
  beforeEach(() => {
    mock.method(console, "error", () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("passes AppError through with its status and message", () => {
    const out = run(new AppError("Nope", 418));

    assert.equal(out.status, 418);
    assert.deepEqual(out.body, { success: false, message: "Nope" });
  });

  it("maps a Mongoose CastError (invalid ObjectId) to 400", () => {
    const error = new mongoose.Error.CastError("ObjectId", "abc", "_id");
    const out = run(error);

    assert.equal(out.status, 400);
    assert.deepEqual(out.body, { success: false, message: "Invalid MongoDB ID" });
  });

  it("maps a Mongoose ValidationError to 400 with the field messages", () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      "title",
      new mongoose.Error.ValidatorError({ message: "Title is too short", path: "title" })
    );
    const out = run(error);

    assert.equal(out.status, 400);
    assert.deepEqual(out.body, { success: false, message: "Title is too short" });
  });

  it("maps a MongoDB duplicate-key error (E11000) to 409", () => {
    const error = Object.assign(
      new Error("E11000 duplicate key error collection: db.users index: email_1 dup key: { email: \"a@b.c\" }"),
      { code: 11000 }
    );
    const out = run(error);

    assert.equal(out.status, 409);
    assert.deepEqual(out.body, { success: false, message: "Resource already exists" });
    // The raw driver message (collection, index, key value) is not leaked.
    assert.equal(JSON.stringify(out.body).includes("email_1"), false);
  });

  it("maps body-parser errors to 400, 413 and 415", () => {
    const parse = Object.assign(new Error("Unexpected token"), {
      type: "entity.parse.failed",
      status: 400
    });
    const large = Object.assign(new Error("too large"), {
      type: "entity.too.large",
      status: 413
    });
    const charset = Object.assign(new Error("bad charset"), {
      type: "charset.unsupported",
      status: 415
    });

    assert.equal(run(parse).status, 400);
    assert.equal(run(large).status, 413);
    assert.equal(run(charset).status, 415);
    assert.equal(JSON.stringify(run(parse).body).includes("Unexpected token"), false);
  });

  it("returns a generic 500 for unexpected errors and hides internals", () => {
    const error = new Error("connect ECONNREFUSED mongodb://user:secret@host/db");
    error.stack = "Error: boom\n    at /srv/app/secret-path.ts:1:1";
    const out = run(error);

    assert.equal(out.status, 500);
    assert.deepEqual(out.body, { success: false, message: "Internal server error" });
  });

  it("logs unexpected errors server-side", () => {
    run(new Error("boom"));

    assert.equal((console.error as unknown as { mock: { callCount(): number } }).mock.callCount(), 1);
  });
});
