import "dotenv/config";

import { loadEnv } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Validate configuration before the app module is evaluated so a
    // bad environment produces one concise message instead of a stack.
    loadEnv();

    const { default: app } = await import("./app.js");

    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`WorkHub API running on port ${PORT}`);
    });
  } catch (error) {
    // Message only: no stack trace, and env values are never included.
    console.error(
      "Failed to start server:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
};

startServer();
