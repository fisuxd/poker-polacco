import type { Server, Socket } from "socket.io";
import type { Bid } from "../../shared/game/bids";
import type { ActionResponse, JoinResponse } from "../../shared/game/types";
import {
  createRoomSchema,
  joinRoomSchema,
  reconnectSchema,
  roomActionSchema,
  submitBidSchema,
} from "../../shared/protocol/schemas";
import type { RoomManager } from "../rooms/RoomManager";

type Session = { roomCode: string; playerId: string };
type Ack<T> = (response: T) => void;

const safeMessage = (error: unknown): string => error instanceof Error ? error.message : "The action could not be completed.";

export function registerSocketHandlers(io: Server, manager: RoomManager): void {
  io.on("connection", (socket: Socket) => {
    let session: Session | null = null;
    let recentActions: number[] = [];

    const rateLimited = (): boolean => {
      const now = Date.now();
      recentActions = recentActions.filter((time) => now - time < 10_000);
      if (recentActions.length >= 30) return true;
      recentActions.push(now);
      return false;
    };

    const establishSession = (roomCode: string, playerId: string): void => {
      if (session && (session.roomCode !== roomCode || session.playerId !== playerId)) {
        throw new Error("This connection already belongs to another player.");
      }
      session = { roomCode, playerId };
      socket.join(roomCode);
    };

    const requireSession = (roomCode: string): Session => {
      if (!session || session.roomCode !== roomCode) throw new Error("You are not a member of this room.");
      const player = manager.getRoom(roomCode)?.getPlayer(session.playerId);
      if (!player || player.leftRoom || player.socketId !== socket.id) throw new Error("Your room session is no longer active.");
      return session;
    };

    socket.on("room:create", (payload: unknown, ack: Ack<JoinResponse>) => {
      if (rateLimited()) return ack({ ok: false, error: "Too many requests. Please slow down." });
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "Use a nickname of 1–20 letters, numbers, spaces, dots, dashes, or underscores." });
      try {
        if (session) throw new Error("Leave your current room first.");
        const { room, player } = manager.createRoom(parsed.data.nickname, socket.id);
        establishSession(room.code, player.id);
        manager.sync(room);
        ack({ ok: true, roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
      } catch (error) {
        ack({ ok: false, error: safeMessage(error) });
      }
    });

    socket.on("room:join", (payload: unknown, ack: Ack<JoinResponse>) => {
      if (rateLimited()) return ack({ ok: false, error: "Too many requests. Please slow down." });
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "Check the nickname and six-character room code." });
      try {
        if (session) throw new Error("Leave your current room first.");
        const { room, player } = manager.joinRoom(parsed.data.roomCode, parsed.data.nickname, socket.id);
        establishSession(room.code, player.id);
        manager.sync(room);
        ack({ ok: true, roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
      } catch (error) {
        ack({ ok: false, error: safeMessage(error) });
      }
    });

    socket.on("room:reconnect", (payload: unknown, ack: Ack<JoinResponse>) => {
      const parsed = reconnectSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "Saved reconnect data is invalid." });
      try {
        if (session) throw new Error("This connection already belongs to a player.");
        const { room, player } = manager.reconnect(parsed.data.roomCode, parsed.data.token, socket.id);
        establishSession(room.code, player.id);
        manager.sync(room);
        ack({ ok: true, roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
      } catch (error) {
        ack({ ok: false, error: safeMessage(error) });
      }
    });

    socket.on("room:leave", (payload: unknown, ack: Ack<ActionResponse>) => {
      if (rateLimited()) return ack({ ok: false, error: "Too many requests. Please slow down." });
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "Invalid room." });
      try {
        const current = requireSession(parsed.data.roomCode);
        const room = manager.getRoom(current.roomCode);
        if (!room) throw new Error("Room not found.");
        room.leaveRoom(current.playerId);
        socket.leave(current.roomCode);
        session = null;
        manager.removeEmptyRoom(room);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: safeMessage(error) });
      }
    });

    const simpleRoomAction = (
      event: string,
      action: (roomCode: string, playerId: string) => void,
    ): void => {
      socket.on(event, (payload: unknown, ack: Ack<ActionResponse>) => {
        if (rateLimited()) return ack({ ok: false, error: "Too many requests. Please slow down." });
        const parsed = roomActionSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "Invalid room." });
        try {
          const current = requireSession(parsed.data.roomCode);
          action(current.roomCode, current.playerId);
          ack({ ok: true });
        } catch (error) {
          ack({ ok: false, error: safeMessage(error) });
        }
      });
    };

    simpleRoomAction("game:start", (roomCode, playerId) => {
      const room = manager.getRoom(roomCode);
      if (!room) throw new Error("Room not found.");
      room.startMatch(playerId);
    });
    simpleRoomAction("game:bluff", (roomCode, playerId) => {
      const room = manager.getRoom(roomCode);
      if (!room) throw new Error("Room not found.");
      room.callBluff(playerId);
    });
    simpleRoomAction("game:rematch", (roomCode, playerId) => {
      const room = manager.getRoom(roomCode);
      if (!room) throw new Error("Room not found.");
      room.startMatch(playerId);
    });
    simpleRoomAction("game:returnLobby", (roomCode, playerId) => {
      const room = manager.getRoom(roomCode);
      if (!room) throw new Error("Room not found.");
      room.returnToLobby(playerId);
    });

    socket.on("game:bid", (payload: unknown, ack: Ack<ActionResponse>) => {
      if (rateLimited()) return ack({ ok: false, error: "Too many requests. Please slow down." });
      const parsed = submitBidSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "Invalid declaration." });
      try {
        const current = requireSession(parsed.data.roomCode);
        const room = manager.getRoom(current.roomCode);
        if (!room) throw new Error("Room not found.");
        room.submitBid(current.playerId, parsed.data.bid as Bid);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: safeMessage(error) });
      }
    });

    socket.on("disconnect", () => {
      if (session) manager.handleDisconnect(session.roomCode, session.playerId, socket.id);
    });
  });
}
