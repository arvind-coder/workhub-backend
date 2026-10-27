import "dotenv/config";

import mongoose from "mongoose";

import { loadEnv } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Validate configuration before the app module is evaluated so a
    // bad environment produces one concise message instead of a stack.
    const env = loadEnv();

    if (env.isProduction && env.corsOrigins.length === 0) {
      console.warn(
        "CORS_ORIGINS is empty: browser cross-origin requests will be rejected"
      );
    }

    const { default: app } = await import("./app.js");

    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`WorkHub API running on port ${PORT}`);
    });

    server.on("error", (error: Error) => {
      console.error("Server error:", error.message);
      process.exit(1);
    });

    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down`);

      server.close(() => {
        void mongoose.disconnect().finally(() => process.exit(0));
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    // Message only: no stack trace, and env values are never included.
    console.error(
      "Failed to start server:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled promise rejection:",
    reason instanceof Error ? reason.message : "Unknown reason"
  );
  process.exit(1);
});

startServer();
