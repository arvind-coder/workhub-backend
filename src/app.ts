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

const env = loadEnv();

const app = express();

app.disable("x-powered-by");

// Needed so rate limiting sees the real client IP behind a proxy.
if (env.trustProxy > 0) {
  app.set("trust proxy", env.trustProxy);
}

app.use(helmet());

// Explicit allow-list. Requests without an Origin header (curl,
// server-to-server) are allowed; unknown browser origins are rejected.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError("Origin not allowed by CORS", 403));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(requestLoggerMiddleware);
app.use("/api", createApiRateLimiter(env.apiRateLimitMax));
app.use("/api/auth", createAuthRateLimiter(env.authRateLimitMax), authRoutes);
app.use("/api/projects", taskRoutes);

app.get("/health", (_req, res) => {
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