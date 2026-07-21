export interface AppSession {
  code: string;
  token: string;
  mode: "teacher" | "participant";
}

const STORAGE_KEY = "network-room-lab.session.v1";

export function readSession(): AppSession | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room")?.toUpperCase();
  const token = params.get("token");
  const mode = params.get("mode");
  if (code && token && (mode === "teacher" || mode === "participant")) {
    const session = { code, token, mode } satisfies AppSession;
    saveSession(session, false);
    return session;
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "code" in parsed &&
      "token" in parsed &&
      "mode" in parsed &&
      typeof parsed.code === "string" &&
      typeof parsed.token === "string" &&
      (parsed.mode === "teacher" || parsed.mode === "participant")
    ) {
      return { code: parsed.code, token: parsed.token, mode: parsed.mode };
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function saveSession(session: AppSession, updateUrl = true): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", session.code);
    url.searchParams.set("mode", session.mode);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url);
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState(null, "", url);
}
