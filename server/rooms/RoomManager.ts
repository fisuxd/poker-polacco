import { randomBytes } from "node:crypto";
import type { Server } from "socket.io";
import type { GameRoom, RoomPlayer, RoomTiming } from "../game/GameRoom";
import { GameRoom as Room } from "../game/GameRoom";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly io: Server;
  private readonly timing: RoomTiming;

  constructor(io: Server, timing: RoomTiming) {
    this.io = io;
    this.timing = timing;
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Unable to allocate a room code.");
  }

  createRoom(nickname: string, socketId: string): { room: GameRoom; player: RoomPlayer } {
    const code = this.generateCode();
    const room = new Room(code, nickname, socketId, this.timing, (changedRoom) => this.sync(changedRoom));
    this.rooms.set(code, room);
    return { room, player: room.players[0] };
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  joinRoom(code: string, nickname: string, socketId: string): { room: GameRoom; player: RoomPlayer } {
    const room = this.rooms.get(code);
    if (!room) throw new Error("Room not found.");
    return { room, player: room.addPlayer(nickname, socketId) };
  }

  reconnect(code: string, token: string, socketId: string): { room: GameRoom; player: RoomPlayer } {
    const room = this.rooms.get(code);
    if (!room) throw new Error("Room no longer exists.");
    const player = room.getPlayerByToken(token);
    if (!player) throw new Error("Reconnect token is invalid.");
    room.reconnect(player, socketId);
    return { room, player };
  }

  sync(room: GameRoom): void {
    this.io.to(room.code).emit("game:public", room.publicState());
    room.players.forEach((player) => {
      if (player.socketId) this.io.to(player.socketId).emit("game:private", room.privateState(player.id));
    });
  }

  handleDisconnect(code: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    // An older socket may disconnect after the same token already reconnected elsewhere.
    if (room.getPlayer(playerId)?.socketId !== socketId) return;
    room.disconnect(playerId, () => {
      if (!room.hasMembers()) {
        room.destroy();
        this.rooms.delete(code);
        console.log(`[room ${code}] deleted`);
      }
    });
  }

  removeEmptyRoom(room: GameRoom): void {
    if (!room.hasMembers()) {
      room.destroy();
      this.rooms.delete(room.code);
    }
  }

  getDebugState(): unknown[] {
    return Array.from(this.rooms.values(), (room) => room.publicState());
  }
}
