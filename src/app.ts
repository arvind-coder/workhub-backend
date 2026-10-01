import express from "express";

import projectRoutes from "./modules/projects/project.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "WorkHub API is running"
  });
});

app.use("/api/projects", projectRoutes);

export default app;