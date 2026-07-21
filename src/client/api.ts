import type {
  ActionEnvelope,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  RoomSnapshot,
} from "../shared/types";

interface RequestOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(path, { ...options, headers });
  const body: unknown = await response.json().catch(() => ({ error: "サーバから応答を読み取れませんでした。" }));
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "リクエストに失敗しました。";
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function createRoom(input: CreateRoomRequest): Promise<CreateRoomResponse> {
  return apiRequest("/api/rooms", { method: "POST", body: JSON.stringify(input) });
}

export function joinRoom(code: string, input: JoinRoomRequest): Promise<JoinRoomResponse> {
  return apiRequest(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify(input) });
}

export function getSnapshot(code: string, token: string): Promise<RoomSnapshot> {
  return apiRequest(`/api/rooms/${code}/snapshot`, { token });
}

export function applyAction(code: string, token: string, envelope: ActionEnvelope) {
  return apiRequest<{ roomVersion: number }>(`/api/rooms/${code}/actions`, {
    method: "POST",
    token,
    body: JSON.stringify(envelope),
  });
}

export async function downloadRoomExport(code: string, token: string): Promise<void> {
  const response = await fetch(`/api/rooms/${code}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "エクスポートに失敗しました。";
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `network-room-${code}-events.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function roomSocketUrl(code: string, token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/rooms/${code}/socket?token=${encodeURIComponent(token)}`;
}
