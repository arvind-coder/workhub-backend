import mongoose from "mongoose";

let handlersRegistered = false;

// Log connection state changes after startup. Mongoose reconnects on its
// own; /health reports 503 while the connection is down. Only messages are
// logged so connection strings never reach the logs.
const registerConnectionHandlers = () => {
  if (handlersRegistered) return;

  handlersRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected; waiting for automatic reconnect");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });

  mongoose.connection.on("error", (error: Error) => {
    console.error("MongoDB connection error:", error.message);
  });
};

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined");
  }

  registerConnectionHandlers();

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000
  });

  console.log("MongoDB connected successfully");
};

export const isDatabaseConnected = (): boolean =>
  mongoose.connection.readyState === 1;
