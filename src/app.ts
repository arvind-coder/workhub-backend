import cors from "cors";
import express from "express";
import helmet from "helmet";

import projectRoutes from "./modules/projects/project.routes.js";

import { errorMiddleware } from "./middlewares/error.middleware.js";

import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/request-logger.middleware.js";
import { mongooseErrorMiddleware } from "./middlewares/mongoose-error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import taskRoutes from "./modules/tasks/task.routes.js";
import { loadEnv } from "./config/env.js";
import {
  createApiRateLimiter,
  createAuthRateLimiter
} from "./middlewares/rate-limit.middleware.js";
import { AppError } from "./middlewares/app-error.js";
import { isDatabaseConnected } from "./config/database.js";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./docs/openapi.js";

const env = loadEnv();

const app = express();

app.disable("x-powered-by");

// Needed so rate limiting sees the real client IP behind a proxy.
if (env.trustProxy > 0) {
  app.set("trust proxy", env.trustProxy);
}

app.use(helmet());

// Explicit allow-list. Allowed: requests with no Origin header (curl,
// server-to-server), origins listed in CORS_ORIGINS, and same-origin
// requests (the Origin's host equals the Host header), which is what the
// Swagger UI served by this app sends. Everything else is rejected.
const isSameOrigin = (origin: string, host: string | undefined): boolean => {
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const allowed =
      !origin ||
      env.corsOrigins.includes(origin) ||
      isSameOrigin(origin, req.headers.host);

    if (!allowed) {
      callback(new AppError("Origin not allowed by CORS", 403));
      return;
    }

    callback(null, {
      origin: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600
    });
  })
);

app.use(express.json({ limit: "100kb" }));

// express.json leaves req.body undefined when no body is sent, which made
// controllers throw on destructuring (HTTP 500). Normalise to an empty
// object so the normal validation returns a 400 instead.
app.use((req, _res, next) => {
  if (req.body === undefined) {
    req.body = {};
  }

  next();
});
app.use(requestLoggerMiddleware);
app.use("/api", createApiRateLimiter(env.apiRateLimitMax));
// Interactive API docs. Off by default in production (see ENABLE_API_DOCS);
// nothing here exposes configuration, only the public route descriptions.
if (env.apiDocsEnabled) {
  app.get("/api/docs/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  // Static UI assets first, then the page itself (GET only).
  app.use("/api/docs", swaggerUi.serve);
  app.get(
    "/api/docs",
    swaggerUi.setup(openApiSpec, { customSiteTitle: "WorkHub API docs" })
  );
}

app.use("/api/auth", createAuthRateLimiter(env.authRateLimitMax), authRoutes);
app.use("/api/projects", taskRoutes);

app.get("/health", (_req, res) => {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      success: false,
      message: "Database is not connected"
    });

    return;
  }

  res.status(200).json({
    success: true,
    message: "WorkHub API is running"
  });
});

app.use("/api/projects", projectRoutes);


// 404 handler
app.use(notFoundMiddleware);

app.use(mongooseErrorMiddleware);

// Global error handler
app.use(errorMiddleware);


export default app;