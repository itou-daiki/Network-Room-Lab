import { z } from "zod";

import { MAX_CLASSROOM_GROUP_SIZE, MIN_CLASSROOM_GROUP_SIZE } from "../shared/classroom";
import type {
  ActionEnvelope,
  ApiErrorBody,
  CreateRoomResponse,
  JoinRoomResponse,
  RoomExportData,
} from "../shared/types";
export { RoomDurableObject } from "./room";

const createRoomSchema = z
  .object({
    title: z.string().trim().min(1, "授業名を入力してください。").max(80),
    capacity: z.number().int().min(1).max(MAX_CLASSROOM_GROUP_SIZE, `定員は最大${MAX_CLASSROOM_GROUP_SIZE}名です。`),
    scenario: z.literal("STANDARD_WEB_ACCESS"),
    learningMode: z.enum(["CLASSROOM", "SOLO"]).default("CLASSROOM"),
    displayName: z.string().trim().min(1, "表示名を入力してください。").max(32).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.learningMode === "CLASSROOM" && input.capacity < MIN_CLASSROOM_GROUP_SIZE) {
      context.addIssue({ code: "custom", path: ["capacity"], message: `協働学習の定員は${MIN_CLASSROOM_GROUP_SIZE}名以上にしてください。` });
    }
    if (input.learningMode === "SOLO" && !input.displayName) {
      context.addIssue({ code: "custom", path: ["displayName"], message: "ひとり学習では表示名を入力してください。" });
    }
  });

const joinRoomSchema = z
  .object({
    displayName: z.string().trim().min(1, "表示名を入力してください。").max(32),
  })
  .strict();

const phaseSchema = z.enum(["LOBBY", "ROLES", "TOPOLOGY", "ADDRESSING", "PROTOCOL", "DIAGNOSIS", "REFLECTION"]);
const roleSchema = z.enum(["CLIENT_PC", "ACCESS_POINT", "L2_SWITCH", "ROUTER", "DNS_SERVER", "WEB_SERVER", "OBSERVER"]);
const faultSchema = z.enum(["AP_DOWN", "CABLE_CUT", "BAD_GATEWAY", "DNS_DOWN", "ROUTE_MISSING", "CERT_ERROR", "WEB_DOWN"]);
const diagnosticSchema = z.enum(["PING", "NSLOOKUP", "TRACEROUTE", "HTTPS"]);

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CHANGE_PHASE"), phase: phaseSchema }).strict(),
  z.object({ type: z.literal("ASSIGN_ROLE"), participantId: z.string().min(1).max(80), role: roleSchema }).strict(),
  z.object({ type: z.literal("TOGGLE_LINK"), linkId: z.string().min(1).max(80) }).strict(),
  z
    .object({
      type: z.literal("CONFIGURE_INTERFACE"),
      address: z.string().min(7).max(15),
      prefix: z.number().int().min(1).max(30),
      gateway: z.string().min(7).max(15),
      dns: z.string().min(7).max(15),
    })
    .strict(),
  z.object({ type: z.literal("ADVANCE_PROTOCOL"), decision: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal("RESET_PROTOCOL") }).strict(),
  z.object({ type: z.literal("INJECT_FAULT"), faultType: faultSchema }).strict(),
  z.object({ type: z.literal("CLEAR_FAULT"), faultType: faultSchema.optional() }).strict(),
  z
    .object({
      type: z.literal("RUN_DIAGNOSTIC"),
      tool: diagnosticSchema,
      target: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal("SUBMIT_EXPLANATION"),
      phase: phaseSchema,
      text: z.string().trim().min(10).max(1000),
    })
    .strict(),
  z
    .object({
      type: z.literal("SUBMIT_REFLECTION"),
      promptId: z.string().trim().min(1).max(80),
      text: z.string().trim().min(10).max(3000),
    })
    .strict(),
  z.object({ type: z.literal("TEACHER_MESSAGE"), text: z.string().trim().min(1).max(240) }).strict(),
]);

const actionEnvelopeSchema = z
  .object({
    roomVersion: z.number().int().nonnegative(),
    action: actionSchema,
  })
  .strict();

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { ...init, headers });
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    throw new Error("PAYLOAD_TOO_LARGE: リクエストが大きすぎます。");
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("BAD_REQUEST: Content-Type は application/json を指定してください。");
  }
  return request.json<unknown>();
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`BAD_REQUEST: ${result.error.issues.map((issue) => issue.message).join(" ")}`);
  }
  return result.data;
}

function readToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] ?? new URL(request.url).searchParams.get("token") ?? "";
  if (!token) throw new Error("UNAUTHORIZED: 認証トークンがありません。");
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new Error("UNAUTHORIZED: 認証トークンの形式が正しくありません。");
  }
  return token;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomRoomCode(): string {
  const random = new Uint8Array(6);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]!).join("");
}

function errorDetails(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : "予期しないエラーが発生しました。";
  const match = raw.match(/(?:^|\b)(BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|GONE|PAYLOAD_TOO_LARGE):\s*(.+)$/s);
  if (!match) return { status: 500, message: "サーバで予期しないエラーが発生しました。" };
  const statusByCode: Record<string, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    GONE: 410,
    PAYLOAD_TOO_LARGE: 413,
  };
  return { status: statusByCode[match[1]!] ?? 500, message: match[2]! };
}

async function roomCodeHash(code: string | undefined): Promise<string | undefined> {
  if (!code) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest).slice(0, 6), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function csvCell(value: string | number): string {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function exportCsv(data: RoomExportData): string {
  const lines = [
    ["eventId", "roomVersion", "createdAt", "type", "actor", "summary", "payload"],
    ...data.events.map((event) => [
      event.id,
      event.roomVersion,
      event.createdAt,
      event.type,
      event.actor,
      event.summary,
      JSON.stringify(event.payload),
    ]),
    [],
    ["participantId", "promptId", "submittedAt", "response"],
    ...data.reflections.map((reflection) => [
      reflection.participantId,
      reflection.promptId,
      reflection.submittedAt,
      reflection.response,
    ]),
    [],
    ["participantId", "displayName", "phase", "submittedAt", "explanation"],
    ...data.explanations.map((explanation) => [
      explanation.participantId,
      explanation.displayName,
      explanation.phase,
      explanation.submittedAt,
      explanation.text,
    ]),
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = parseWithSchema(createRoomSchema, await readJson(request));
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomRoomCode();
    const teacherToken = randomToken();
    const stub = env.ROOMS.getByName(code);
    const result = await stub.initialize({ ...body, code, teacherToken, expiresAt });
    if (result.created) {
      const response: CreateRoomResponse = {
        code,
        teacherToken,
        expiresAt,
        participantId: result.participantId,
        participantToken: result.participantToken,
      };
      return json(response, { status: 201 });
    }
  }
  throw new Error("CONFLICT: 部屋コードを確保できませんでした。もう一度お試しください。");
}

async function handleRoomRoute(
  request: Request,
  env: Env,
  code: string,
  subroute: string | undefined,
): Promise<Response> {
  const stub = env.ROOMS.getByName(code);
  const method = request.method.toUpperCase();

  if (subroute === "join" && method === "POST") {
    const body = parseWithSchema(joinRoomSchema, await readJson(request));
    const result = await stub.join(body.displayName);
    const response: JoinRoomResponse = result;
    return json(response, { status: 201 });
  }

  if (subroute === "socket" && method === "GET") {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WebSocket upgrade required" }, { status: 426 });
    }
    return stub.fetch(request);
  }

  const token = readToken(request);
  if ((subroute === undefined || subroute === "snapshot") && method === "GET") {
    return json(await stub.getSnapshot(token));
  }

  if (subroute === "events" && method === "GET") {
    const after = Number(new URL(request.url).searchParams.get("after") ?? "0");
    return json(await stub.getEvents(token, Number.isSafeInteger(after) ? after : 0));
  }

  if (subroute === "actions" && method === "POST") {
    const envelope = parseWithSchema<ActionEnvelope>(actionEnvelopeSchema, await readJson(request));
    return json(await stub.applyAction(token, envelope));
  }

  if (subroute === "export" && method === "GET") {
    const data = await stub.exportRoom(token);
    if (new URL(request.url).searchParams.get("format") === "json") return json(data);
    return new Response(exportCsv(data), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="network-room-${code}-events.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  throw new Error("NOT_FOUND: APIエンドポイントが見つかりません。");
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, service: "network-room-lab", time: new Date().toISOString() });
  }
  if (url.pathname === "/api/rooms" && request.method === "POST") return createRoom(request, env);

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/([a-z-]+))?$/);
  if (roomMatch) return handleRoomRoute(request, env, roomMatch[1]!, roomMatch[2]);

  if (url.pathname.startsWith("/api/")) throw new Error("NOT_FOUND: APIエンドポイントが見つかりません。");
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const path = new URL(request.url).pathname;
    const roomCode = path.match(/^\/api\/rooms\/([A-Z2-9]{6})/)?.[1];

    try {
      const response = await route(request, env);
      console.log(
        JSON.stringify({
          message: "request completed",
          requestId,
          method: request.method,
          path,
          roomCodeHash: await roomCodeHash(roomCode),
          status: response.status,
          durationMs: Date.now() - startedAt,
        }),
      );
      return response;
    } catch (error) {
      const details = errorDetails(error);
      console.error(
        JSON.stringify({
          message: "request failed",
          requestId,
          method: request.method,
          path,
          roomCodeHash: await roomCodeHash(roomCode),
          status: details.status,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      const body: ApiErrorBody = { error: details.message, requestId };
      return json(body, { status: details.status });
    }
  },
} satisfies ExportedHandler<Env>;
