import { useCallback, useEffect, useRef, useState } from "react";

import type { ClientAction, RoomSnapshot, SocketServerMessage } from "../shared/types";
import { ApiError, applyAction as postAction, getSnapshot, roomSocketUrl } from "./api";
import type { AppSession } from "./session";

export type ConnectionStatus = "connecting" | "online" | "offline";

export function useRoom(session: AppSession) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getSnapshot(session.code, session.token);
      if (aliveRef.current) {
        setSnapshot(next);
        setError(null);
      }
      return next;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "部屋の状態を取得できませんでした。";
      if (aliveRef.current) setError(message);
      throw caught;
    }
  }, [session.code, session.token]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh().catch(() => undefined);

    const connect = () => {
      if (!aliveRef.current) return;
      setConnectionStatus("connecting");
      const socket = new WebSocket(roomSocketUrl(session.code, session.token));
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectAttemptRef.current = 0;
        setConnectionStatus("online");
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as SocketServerMessage;
          if (message.type === "SNAPSHOT") {
            setSnapshot(message.snapshot);
            setError(null);
          } else if (message.type === "ROOM_UPDATED") {
            setSnapshot((current) => {
              if (!current || message.roomVersion <= current.room.version) return current;
              void refresh().catch(() => undefined);
              return current;
            });
          } else if (message.type === "PRESENCE") {
            setSnapshot((current) =>
              current
                ? {
                    ...current,
                    room: {
                      ...current.room,
                      participants: current.room.participants.map((participant) =>
                        participant.id === message.participantId
                          ? { ...participant, connectionState: message.connectionState }
                          : participant,
                      ),
                    },
                  }
                : current,
            );
          } else if (message.type === "ERROR") {
            setError(message.message);
          }
        } catch {
          setError("リアルタイム更新を読み取れませんでした。");
        }
      });
      socket.addEventListener("close", () => {
        if (!aliveRef.current) return;
        setConnectionStatus("offline");
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(10_000, 750 * 2 ** Math.min(attempt, 4));
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      });
      socket.addEventListener("error", () => setConnectionStatus("offline"));
    };

    connect();
    const pingTimer = window.setInterval(() => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "PING", lastEventId: snapshot?.room.latestEvents.at(-1)?.id ?? 0 }));
      }
    }, 20_000);

    return () => {
      aliveRef.current = false;
      window.clearInterval(pingTimer);
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close(1000, "page changed");
    };
  }, [refresh, session.code, session.token]);

  const act = useCallback(
    async (action: ClientAction) => {
      if (!snapshot) return;
      setBusy(true);
      setError(null);
      try {
        await postAction(session.code, session.token, { roomVersion: snapshot.room.version, action });
        await refresh();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) await refresh().catch(() => undefined);
        setError(caught instanceof Error ? caught.message : "操作に失敗しました。");
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [refresh, session.code, session.token, snapshot],
  );

  return { snapshot, connectionStatus, error, busy, refresh, act, dismissError: () => setError(null) };
}
