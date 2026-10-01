import express from "express";
import projectRoutes from "./modules/projects/project.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
const app = express();
app.use(express.json());
app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "WorkHub API is running"
    });
});
app.use("/api/projects", projectRoutes);
// 404 handler
app.use(notFoundMiddleware);
// Global error handler
app.use(errorMiddleware);
export default app;
//# sourceMappingURL=app.js.map