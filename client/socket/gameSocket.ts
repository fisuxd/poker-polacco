import { io } from "socket.io-client";
import type { Bid } from "../../shared/game/bids";
import type { ActionResponse, JoinResponse, PrivatePlayerState, PublicGameState } from "../../shared/game/types";
import { useGameStore } from "../state/gameStore";

interface SavedSession {
  roomCode: string;
  reconnectToken: string;
}

const SESSION_KEY = "poker-polacco-session";
export const socket = io({ autoConnect: true, transports: ["websocket", "polling"] });

const readSession = (): SavedSession | null => {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as SavedSession : null;
  } catch {
    return null;
  }
};

const saveSession = (response: JoinResponse): void => {
  if (!response.roomCode || !response.reconnectToken) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: response.roomCode, reconnectToken: response.reconnectToken }));
};

const clearSession = (): void => localStorage.removeItem(SESSION_KEY);

socket.on("connect", () => {
  const store = useGameStore.getState();
  store.setConnection("connected");
  const session = readSession();
  // A new transport connection needs a new authenticated server session even
  // if we still have the old room view on screen after a temporary disconnect.
  if (!session) {
    store.setReconnecting(false);
    return;
  }
  store.setReconnecting(true);
  socket.emit("room:reconnect", { roomCode: session.roomCode, token: session.reconnectToken }, (response: JoinResponse) => {
    store.setReconnecting(false);
    if (!response.ok) {
      clearSession();
      store.reset();
      if (response.error !== "Room no longer exists.") store.setError(response.error ?? "Could not reconnect.");
    }
  });
});

socket.on("disconnect", () => useGameStore.getState().setConnection("disconnected"));
socket.on("game:public", (state: PublicGameState) => useGameStore.getState().setPublicState(state));
socket.on("game:private", (state: PrivatePlayerState) => useGameStore.getState().setPrivateState(state));

const emitJoin = (event: "room:create" | "room:join", payload: object): Promise<JoinResponse> =>
  new Promise((resolve) => {
    socket.timeout(8_000).emit(event, payload, (timeoutError: Error | null, response: JoinResponse) => {
      if (timeoutError) return resolve({ ok: false, error: "The server did not respond." });
      if (response.ok) saveSession(response);
      resolve(response);
    });
  });

const emitAction = (event: string, payload: object): Promise<ActionResponse> =>
  new Promise((resolve) => {
    socket.timeout(8_000).emit(event, payload, (timeoutError: Error | null, response: ActionResponse) => {
      if (timeoutError) return resolve({ ok: false, error: "The server did not respond." });
      resolve(response);
    });
  });

export const gameApi = {
  createRoom: (nickname: string) => emitJoin("room:create", { nickname }),
  joinRoom: (nickname: string, roomCode: string) => emitJoin("room:join", { nickname, roomCode: roomCode.toUpperCase() }),
  start: (roomCode: string) => emitAction("game:start", { roomCode }),
  bid: (roomCode: string, bid: Bid) => emitAction("game:bid", { roomCode, bid }),
  bluff: (roomCode: string) => emitAction("game:bluff", { roomCode }),
  rematch: (roomCode: string) => emitAction("game:rematch", { roomCode }),
  returnLobby: (roomCode: string) => emitAction("game:returnLobby", { roomCode }),
  leave: async (roomCode: string) => {
    const response = await emitAction("room:leave", { roomCode });
    if (response.ok) {
      clearSession();
      useGameStore.getState().reset();
    }
    return response;
  },
};
