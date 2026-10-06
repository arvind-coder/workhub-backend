import express from "express";

import projectRoutes from "./modules/projects/project.routes.js";

import { errorMiddleware } from "./middlewares/error.middleware.js";

import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/request-logger.middleware.js";
import { mongooseErrorMiddleware } from "./middlewares/mongoose-error.middleware.js";

const app = express();

app.use(express.json());
app.use(requestLoggerMiddleware);

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