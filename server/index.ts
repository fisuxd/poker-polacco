import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config";
import { RoomManager } from "./rooms/RoomManager";
import { registerSocketHandlers } from "./socket/registerSocketHandlers";

const app = express();
app.disable("x-powered-by");
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: config.production ? undefined : { origin: true, credentials: true },
  maxHttpBufferSize: 20_000,
});

const manager = new RoomManager(io, {
  turnMs: config.turnMs,
  revealMs: config.revealMs,
  resultMs: config.resultMs,
  roundStartMs: config.roundStartMs,
  reconnectMs: config.reconnectMs,
});

registerSocketHandlers(io, manager);

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "poker-polacco", uptimeSeconds: Math.round(process.uptime()) });
});

if (config.debug) {
  app.get("/debug/rooms", (_request, response) => response.json(manager.getDebugState()));
}

if (config.production) {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const clientDirectory = path.resolve(currentDirectory, "../dist/client");
  app.use(express.static(clientDirectory, { maxAge: "1h", index: false }));
  app.get("*", (_request, response) => response.sendFile(path.join(clientDirectory, "index.html")));
}

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Poker Polacco server listening on http://0.0.0.0:${config.port}`);
  console.log(`Turn timer: ${config.turnMs / 1_000}s; reconnect grace: ${config.reconnectMs / 1_000}s`);
});

const shutdown = (): void => {
  console.log("Shutting down Poker Polacco server...");
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
