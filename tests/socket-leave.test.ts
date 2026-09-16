import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as connectSocket, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResponse, JoinResponse } from "../shared/game/types";
import type { GameRoom } from "../server/game/GameRoom";
import { RoomManager } from "../server/rooms/RoomManager";
import { registerSocketHandlers } from "../server/socket/registerSocketHandlers";

let httpServer: HttpServer;
let io: Server;
let manager: RoomManager;
let address: string;
let clients: Socket[];
let rooms: GameRoom[];

function emit<T extends ActionResponse>(client: Socket, event: string, payload: object): Promise<T> {
  return new Promise((resolve, reject) => {
    client.timeout(3_000).emit(event, payload, (error: Error | null, response: T) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

async function newClient(): Promise<Socket> {
  const client = connectSocket(address, { transports: ["websocket"], reconnection: false });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  return client;
}

async function createRoom(client: Socket, nickname: string): Promise<JoinResponse> {
  const response = await emit<JoinResponse>(client, "room:create", { nickname });
  expect(response.ok).toBe(true);
  rooms.push(manager.getRoom(response.roomCode!)!);
  return response;
}

beforeEach(async () => {
  clients = [];
  rooms = [];
  httpServer = createServer();
  io = new Server(httpServer);
  manager = new RoomManager(io, { turnMs: 60_000, reconnectMs: 60_000, roundStartMs: 10, revealMs: 20, resultMs: 20 });
  registerSocketHandlers(io, manager);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  address = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.forEach((client) => client.disconnect());
  await new Promise<void>((resolve) => io.close(() => resolve()));
  rooms.forEach((room) => room.destroy());
});

describe("room:leave over real Socket.IO connections", () => {
  it("hands off the host, unsubscribes the leaver, and allows a new room on the same connection", async () => {
    const alice = await newClient();
    const bob = await newClient();
    const created = await createRoom(alice, "Alice");
    const joined = await emit<JoinResponse>(bob, "room:join", { nickname: "Bob", roomCode: created.roomCode });
    expect(joined.ok).toBe(true);
    expect(await emit(alice, "room:leave", { roomCode: created.roomCode })).toEqual({ ok: true });
    const room = manager.getRoom(created.roomCode!)!;
    expect(room.hostId).toBe(joined.playerId);
    expect(room.players).toHaveLength(1);
    expect(io.sockets.sockets.get(alice.id!)?.rooms.has(created.roomCode!)).toBe(false);
    const second = await createRoom(alice, "Alice Again");
    expect(second.roomCode).not.toBe(created.roomCode);
    expect(manager.getRoom(created.roomCode!)).toBe(room);
  });

  it("supports in-match leave, rejects the departed token, and deletes the last-member room", async () => {
    const alice = await newClient();
    const bob = await newClient();
    const created = await createRoom(alice, "Alice");
    const joined = await emit<JoinResponse>(bob, "room:join", { nickname: "Bob", roomCode: created.roomCode });
    const roomCode = created.roomCode!;
    const room = manager.getRoom(roomCode)!;
    expect(await emit(alice, "game:start", { roomCode })).toEqual({ ok: true });
    await vi.waitFor(() => expect(room.phase).toBe("BIDDING"));
    expect(await emit(alice, "room:leave", { roomCode })).toEqual({ ok: true });
    expect(room.hostId).toBe(joined.playerId);
    expect(room.phase).toBe("MATCH_OVER");
    expect(room.winnerId).toBe(joined.playerId);
    expect(await emit(alice, "room:reconnect", { roomCode, token: created.reconnectToken })).toMatchObject({ ok: false });
    expect(await emit(bob, "room:leave", { roomCode })).toEqual({ ok: true });
    expect(manager.getRoom(roomCode)).toBeUndefined();
  });

  it("does not let a connection leave a room it never joined", async () => {
    const alice = await newClient();
    const outsider = await newClient();
    const created = await createRoom(alice, "Alice");
    expect(await emit(outsider, "room:leave", { roomCode: created.roomCode })).toMatchObject({ ok: false });
    expect(manager.getRoom(created.roomCode!)?.hostId).toBe(created.playerId);
  });
});
