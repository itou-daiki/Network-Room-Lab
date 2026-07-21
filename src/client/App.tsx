import { useState } from "react";

import { HomePage } from "./components/HomePage";
import { RoomPage } from "./components/RoomPage";
import { clearSession, readSession, saveSession, type AppSession } from "./session";

export function App() {
  const [session, setSession] = useState<AppSession | null>(() => readSession());

  const enterRoom = (next: AppSession) => {
    saveSession(next);
    setSession(next);
  };

  const leaveRoom = () => {
    clearSession();
    setSession(null);
  };

  return session ? (
    <RoomPage session={session} onLeave={leaveRoom} />
  ) : (
    <HomePage onEnterRoom={enterRoom} />
  );
}
