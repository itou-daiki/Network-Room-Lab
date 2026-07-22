import { timingSafeEqual } from "node:crypto";

import { DurableObject } from "cloudflare:workers";

import { faultDetails, simulateDiagnostic, validateInterfaceConfig } from "../shared/network";
import {
  DEFAULT_LINKS,
  DEVICES,
  PHASE_INDEX,
  PROTOCOL_STEPS,
  ROLE_DEFINITIONS,
  phaseDefinition,
  roleDefinition,
} from "../shared/scenario";
import type {
  ActionEnvelope,
  ActiveFault,
  ClientAction,
  DiagnosticResult,
  FaultType,
  JsonValue,
  LearningMode,
  ParticipantPublic,
  ReflectionResponse,
  RoleId,
  RoomEvent,
  RoomExportData,
  RoomPhase,
  RoomPublicState,
  RoomSnapshot,
  SharedExplanation,
  SocketClientMessage,
  SocketServerMessage,
  TopologyLink,
  ViewerContext,
} from "../shared/types";

interface StoredRoom {
  code: string;
  title: string;
  learningMode: LearningMode;
  phase: RoomPhase;
  scenario: "STANDARD_WEB_ACCESS";
  status: "waiting" | "active" | "completed";
  version: number;
  capacity: number;
  createdAt: string;
  expiresAt: string;
  teacherTokenHash: string;
  teacherMessage: string;
  links: TopologyLink[];
  interfaceConfig: {
    address: string;
    prefix: number;
    gateway: string;
    dns: string;
  };
  protocolIndex: number;
  activeFaults: ActiveFault[];
  diagnostics: DiagnosticResult[];
}

interface ParticipantRow {
  [key: string]: SqlStorageValue;
  id: string;
  display_name: string;
  role: RoleId;
  token_hash: string;
  connection_state: "online" | "offline";
  joined_at: string;
  last_seen_at: string;
}

interface EventRow {
  [key: string]: SqlStorageValue;
  id: number;
  room_version: number;
  type: string;
  actor: string;
  summary: string;
  payload_json: string;
  created_at: string;
}

interface ReflectionRow {
  [key: string]: SqlStorageValue;
  participant_id: string;
  prompt_id: string;
  response: string;
  submitted_at: string;
}

interface ExplanationRow {
  [key: string]: SqlStorageValue;
  participant_id: string;
  display_name: string;
  phase: RoomPhase;
  text: string;
  submitted_at: string;
}

interface SocketAttachment {
  viewer: ViewerContext;
  connectedAt: string;
}

interface JoinResult {
  code: string;
  participantId: string;
  participantToken: string;
  role: RoleId;
}

interface InitInput {
  code: string;
  title: string;
  capacity: number;
  scenario: "STANDARD_WEB_ACCESS";
  learningMode: LearningMode;
  displayName?: string;
  teacherToken: string;
  expiresAt: string;
}

interface ActionResult {
  event: RoomEvent;
  roomVersion: number;
}

const ROLE_ORDER: RoleId[] = [
  "CLIENT_PC",
  "ACCESS_POINT",
  "L2_SWITCH",
  "ROUTER",
  "DNS_SERVER",
  "WEB_SERVER",
];

const SOLO_FAULT_TYPES: FaultType[] = ["BAD_GATEWAY", "DNS_DOWN", "ROUTE_MISSING", "CERT_ERROR", "WEB_DOWN"];

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexBytes(value: string): Uint8Array {
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    result[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return result;
}

function safeEqualHash(left: string, right: string): boolean {
  if (left.length !== 64 || right.length !== 64) return false;
  return timingSafeEqual(hexBytes(left), hexBytes(right));
}

function parsePayload(value: string): Record<string, JsonValue> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, JsonValue>)
      : {};
  } catch {
    return {};
  }
}

function participantFromRow(row: ParticipantRow): ParticipantPublic {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    connectionState: row.connection_state,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
  };
}

function eventFromRow(row: EventRow): RoomEvent {
  return {
    id: row.id,
    roomVersion: row.room_version,
    type: row.type,
    actor: row.actor,
    summary: row.summary,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  };
}

export class RoomDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.migrate();
    });
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS room_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        connection_state TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_version INTEGER NOT NULL,
        type TEXT NOT NULL,
        actor TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_room_version ON events(room_version);
      CREATE TABLE IF NOT EXISTS reflections (
        participant_id TEXT NOT NULL,
        prompt_id TEXT NOT NULL,
        response TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        PRIMARY KEY (participant_id, prompt_id)
      );
      CREATE TABLE IF NOT EXISTS explanations (
        participant_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        text TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        PRIMARY KEY (participant_id, phase)
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        room_version INTEGER PRIMARY KEY,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);
  }

  async initialize(input: InitInput): Promise<{
    created: boolean;
    participantId?: string;
    participantToken?: string;
  }> {
    if (this.loadRoomOrNull()) return { created: false };

    const createdAt = nowIso();
    const teacherTokenHash = await sha256Hex(input.teacherToken);
    const soloParticipantId = input.learningMode === "SOLO" ? `p_${crypto.randomUUID()}` : undefined;
    const soloParticipantToken = input.learningMode === "SOLO" ? randomToken() : undefined;
    const soloParticipantTokenHash = soloParticipantToken ? await sha256Hex(soloParticipantToken) : undefined;
    const soloDisplayName = input.displayName?.trim().replace(/\s+/g, " ").slice(0, 32);
    const room: StoredRoom = {
      code: input.code,
      title: input.title.trim().slice(0, 80),
      learningMode: input.learningMode,
      phase: input.learningMode === "SOLO" ? "ROLES" : "LOBBY",
      scenario: input.scenario,
      status: input.learningMode === "SOLO" ? "active" : "waiting",
      version: 1,
      capacity: input.learningMode === "SOLO" ? 1 : Math.min(8, Math.max(2, input.capacity)),
      createdAt,
      expiresAt: input.expiresAt,
      teacherTokenHash,
      teacherMessage:
        input.learningMode === "SOLO"
          ? "6つの役割を順番に体験します。説明を読んだら「次のステップへ」を押しましょう。"
          : "まずは自分の担当機器が見られる情報を確認しましょう。",
      links: structuredClone(DEFAULT_LINKS),
      interfaceConfig: {
        address: "192.168.10.23",
        prefix: 24,
        gateway: "192.168.10.1",
        dns: "198.51.100.53",
      },
      protocolIndex: 0,
      activeFaults: [],
      diagnostics: [],
    };

    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        "INSERT INTO room_config (id, state_json) VALUES (1, ?)",
        JSON.stringify(room),
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO events (room_version, type, actor, summary, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        room.version,
        "ROOM_CREATED",
        "teacher",
        input.learningMode === "SOLO" ? "ひとり学習を開始しました" : "実験ルームを作成しました",
        JSON.stringify({ title: room.title, capacity: room.capacity, learningMode: room.learningMode }),
        createdAt,
      );
      if (soloParticipantId && soloParticipantTokenHash && soloDisplayName) {
        this.ctx.storage.sql.exec(
          `INSERT INTO participants
           (id, display_name, role, token_hash, connection_state, joined_at, last_seen_at)
           VALUES (?, ?, 'CLIENT_PC', ?, 'offline', ?, ?)`,
          soloParticipantId,
          soloDisplayName,
          soloParticipantTokenHash,
          createdAt,
          createdAt,
        );
      }
      this.ctx.storage.sql.exec(
        "INSERT INTO snapshots (room_version, state_json, created_at) VALUES (?, ?, ?)",
        room.version,
        JSON.stringify(room),
        createdAt,
      );
    });

    return {
      created: true,
      participantId: soloParticipantId,
      participantToken: soloParticipantToken,
    };
  }

  async join(displayNameInput: string): Promise<JoinResult> {
    const room = this.loadRoom();
    if (Date.parse(room.expiresAt) <= Date.now()) throw new Error("GONE: この部屋の有効期限は終了しました。");

    const displayName = displayNameInput.trim().replace(/\s+/g, " ").slice(0, 32);
    if (displayName.length < 1) throw new Error("BAD_REQUEST: 表示名を入力してください。");
    if (this.loadParticipants().length >= room.capacity) throw new Error("CONFLICT: この部屋は定員に達しています。");

    const participantId = `p_${crypto.randomUUID()}`;
    const participantToken = randomToken();
    const tokenHash = await sha256Hex(participantToken);
    const joinedAt = nowIso();
    const usedRoles = new Set(this.loadParticipants().map((participant) => participant.role));
    const role = ROLE_ORDER.find((candidate) => !usedRoles.has(candidate)) ?? "OBSERVER";
    const nextRoom = { ...room, version: room.version + 1 };

    const event = this.commitEvent(
      nextRoom,
      "JOIN_ROOM",
      participantId,
      `${displayName}さんが${roleDefinition(role).shortLabel}担当として参加しました`,
      { participantId, displayName, role },
      () => {
        this.ctx.storage.sql.exec(
          `INSERT INTO participants
           (id, display_name, role, token_hash, connection_state, joined_at, last_seen_at)
           VALUES (?, ?, ?, ?, 'offline', ?, ?)`,
          participantId,
          displayName,
          role,
          tokenHash,
          joinedAt,
          joinedAt,
        );
      },
    );
    this.broadcastUpdate(event);

    return { code: room.code, participantId, participantToken, role };
  }

  async getSnapshot(token: string): Promise<RoomSnapshot> {
    const viewer = await this.authorizeToken(token);
    return this.snapshotFor(viewer);
  }

  async getEvents(token: string, afterEventId: number): Promise<RoomEvent[]> {
    await this.authorizeToken(token);
    return this.ctx.storage.sql
      .exec<EventRow>(
        `SELECT id, room_version, type, actor, summary, payload_json, created_at
         FROM events WHERE id > ? ORDER BY id ASC LIMIT 250`,
        Math.max(0, afterEventId),
      )
      .toArray()
      .map(eventFromRow);
  }

  async exportRoom(token: string): Promise<RoomExportData> {
    const viewer = await this.authorizeToken(token);
    if (viewer.kind !== "teacher") throw new Error("FORBIDDEN: 履歴の出力は教員のみ実行できます。");
    const room = this.loadRoom();
    const participants = this.loadParticipants().map(participantFromRow);
    const events = this.loadAllEvents();
    const reflections = this.loadReflections();
    const explanations = this.loadExplanations();
    const { latestEvents: _latestEvents, ...roomWithoutEvents } = this.publicRoom(room, participants, [], true);
    return { room: roomWithoutEvents, events, reflections, explanations };
  }

  async applyAction(token: string, envelope: ActionEnvelope): Promise<ActionResult> {
    const viewer = await this.authorizeToken(token);
    const result = this.applyActionAsViewer(viewer, envelope);
    this.broadcastUpdate(result.event);
    return result;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ error: "WebSocket upgrade required" }, { status: 426 });
    }

    const token = new URL(request.url).searchParams.get("token") ?? "";
    let viewer: ViewerContext;
    try {
      viewer = await this.authorizeToken(token);
    } catch {
      return Response.json({ error: "認証に失敗しました。" }, { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: SocketAttachment = { viewer, connectedAt: nowIso() };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, [viewer.kind, viewer.participantId ?? "teacher"]);

    if (viewer.participantId) this.updatePresence(viewer.participantId, "online");
    server.send(JSON.stringify({ type: "SNAPSHOT", snapshot: this.snapshotFor(viewer) } satisfies SocketServerMessage));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) {
      socket.send(JSON.stringify({ type: "ERROR", message: "接続情報を復元できませんでした。" } satisfies SocketServerMessage));
      socket.close(1011, "missing attachment");
      return;
    }

    try {
      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !("type" in parsed)) throw new Error("メッセージ形式が正しくありません。");
      const input = parsed as SocketClientMessage;

      if (input.type === "PING") {
        const room = this.loadRoom();
        socket.send(JSON.stringify({ type: "PONG", roomVersion: room.version } satisfies SocketServerMessage));
        return;
      }

      if (input.type !== "ACTION") throw new Error("未対応のメッセージです。");
      const result = this.applyActionAsViewer(attachment.viewer, {
        roomVersion: input.roomVersion,
        action: input.action,
      });
      socket.send(
        JSON.stringify({
          type: "ACK",
          requestId: input.requestId,
          roomVersion: result.roomVersion,
        } satisfies SocketServerMessage),
      );
      this.broadcastUpdate(result.event);
    } catch (error) {
      const room = this.loadRoomOrNull();
      socket.send(
        JSON.stringify({
          type: "ERROR",
          message: error instanceof Error ? error.message.replace(/^[A-Z_]+:\s*/, "") : "操作に失敗しました。",
          roomVersion: room?.version,
        } satisfies SocketServerMessage),
      );
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (attachment?.viewer.participantId) this.updatePresence(attachment.viewer.participantId, "offline");
    socket.close(code, reason);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (attachment?.viewer.participantId) this.updatePresence(attachment.viewer.participantId, "offline");
  }

  private applyActionAsViewer(viewerInput: ViewerContext, envelope: ActionEnvelope): ActionResult {
    const room = this.loadRoom();
    if (envelope.roomVersion !== room.version) {
      throw new Error(`CONFLICT: 状態が更新されています。最新版（version ${room.version}）を取得してください。`);
    }

    const viewer = viewerInput.participantId ? this.refreshParticipantViewer(viewerInput.participantId) : viewerInput;
    const action = envelope.action;
    this.assertActionAllowed(viewer, room, action);

    const nextRoom: StoredRoom = structuredClone(room);
    nextRoom.version += 1;
    const actor = viewer.participantId ?? "teacher";
    let eventType: string = action.type;
    let summary: string = action.type;
    let payload: Record<string, JsonValue> = {};
    let extraWrite: (() => void) | undefined;

    switch (action.type) {
      case "CHANGE_PHASE": {
        nextRoom.phase = action.phase;
        nextRoom.status = action.phase === "LOBBY" ? "waiting" : action.phase === "REFLECTION" ? "completed" : "active";
        if (nextRoom.learningMode === "SOLO" && action.phase === "DIAGNOSIS" && nextRoom.activeFaults.length === 0) {
          const faultType = SOLO_FAULT_TYPES[nextRoom.code.charCodeAt(0) % SOLO_FAULT_TYPES.length]!;
          const definition = faultDetails(faultType);
          nextRoom.activeFaults = [{
            type: faultType,
            target: definition.target,
            symptom: definition.symptom,
            injectedAt: nowIso(),
          }];
        }
        eventType = "CHANGE_PHASE";
        summary = `フェーズを「${action.phase}」へ変更しました`;
        payload = { phase: action.phase };
        break;
      }
      case "ASSIGN_ROLE": {
        const participant = this.loadParticipant(action.participantId);
        if (!participant) throw new Error("NOT_FOUND: 参加者が見つかりません。");
        if (!ROLE_DEFINITIONS.some((definition) => definition.id === action.role)) throw new Error("BAD_REQUEST: 未知の役割です。");
        eventType = "ASSIGN_ROLE";
        summary = `${participant.display_name}さんを${roleDefinition(action.role).shortLabel}担当に変更しました`;
        payload = { participantId: participant.id, role: action.role };
        extraWrite = () => {
          this.ctx.storage.sql.exec("UPDATE participants SET role = ? WHERE id = ?", action.role, participant.id);
        };
        break;
      }
      case "TOGGLE_LINK": {
        const link = nextRoom.links.find((candidate) => candidate.id === action.linkId);
        if (!link) throw new Error("NOT_FOUND: 接続が見つかりません。");
        link.up = !link.up;
        eventType = "CONNECT_PORT";
        summary = `${link.from}–${link.to}を${link.up ? "接続" : "切断"}しました`;
        payload = { linkId: link.id, fromPort: link.from, toPort: link.to, medium: link.medium, up: link.up };
        break;
      }
      case "CONFIGURE_INTERFACE": {
        const errors = validateInterfaceConfig(action);
        if (errors.length > 0) throw new Error(`BAD_REQUEST: ${errors.join(" ")}`);
        nextRoom.interfaceConfig = {
          address: action.address,
          prefix: action.prefix,
          gateway: action.gateway,
          dns: action.dns,
        };
        eventType = "CONFIGURE_INTERFACE";
        summary = `PCを ${action.address}/${action.prefix} に設定しました`;
        payload = { deviceId: "pc", address: action.address, prefix: action.prefix, gateway: action.gateway, dns: action.dns };
        break;
      }
      case "ADVANCE_PROTOCOL": {
        const current = PROTOCOL_STEPS[nextRoom.protocolIndex];
        if (!current) throw new Error("CONFLICT: 通信シーケンスは完了しています。");
        nextRoom.protocolIndex += 1;
        eventType = current.eventType;
        summary = `${current.protocol}: ${current.title}`;
        payload = { protocol: current.protocol, stepId: current.id, nodeId: current.nodeId, actorRole: current.actorRole, decision: action.decision, ttl: current.ttl };
        break;
      }
      case "RESET_PROTOCOL": {
        nextRoom.protocolIndex = 0;
        eventType = "CREATE_PACKET";
        summary = "通信シーケンスを最初から再実行します";
        payload = { protocol: "ARP", reset: true };
        break;
      }
      case "INJECT_FAULT": {
        const definition = faultDetails(action.faultType);
        nextRoom.activeFaults = nextRoom.activeFaults.filter((fault) => fault.type !== action.faultType);
        nextRoom.activeFaults.push({
          type: action.faultType,
          target: definition.target,
          symptom: definition.symptom,
          injectedAt: nowIso(),
        });
        eventType = "INJECT_FAULT";
        summary = `障害「${definition.label}」を注入しました`;
        payload = { faultType: action.faultType, target: definition.target, visibility: "teacher" };
        break;
      }
      case "CLEAR_FAULT": {
        const cleared = action.faultType ?? "ALL";
        nextRoom.activeFaults = action.faultType
          ? nextRoom.activeFaults.filter((fault) => fault.type !== action.faultType)
          : [];
        eventType = "CLEAR_FAULT";
        summary = action.faultType ? `${faultDetails(action.faultType).label}を修復しました` : "すべての障害を修復しました";
        payload = { faultType: cleared };
        break;
      }
      case "RUN_DIAGNOSTIC": {
        const result = simulateDiagnostic(
          action.tool,
          action.target.slice(0, 120),
          nextRoom.activeFaults,
          actor,
          nowIso(),
          `diag_${crypto.randomUUID()}`,
          { links: nextRoom.links, interfaceConfig: nextRoom.interfaceConfig },
        );
        nextRoom.diagnostics = [...nextRoom.diagnostics.slice(-11), result];
        eventType = "RUN_DIAGNOSTIC";
        summary = `${action.tool} を実行: ${result.success ? "成功" : "失敗"}`;
        payload = { tool: action.tool, target: action.target, success: result.success, diagnosticId: result.id };
        break;
      }
      case "SUBMIT_EXPLANATION": {
        if (!viewer.participantId) throw new Error("FORBIDDEN: 教員は受講者の説明を代理提出できません。");
        const text = action.text.trim().slice(0, 1000);
        if (text.length < 10) throw new Error("BAD_REQUEST: 説明は10文字以上で入力してください。");
        const submittedAt = nowIso();
        eventType = "SUBMIT_EXPLANATION";
        summary = `${viewer.displayName}さんが「${phaseDefinition(action.phase).label}」の説明を共有しました`;
        payload = { participantId: viewer.participantId, phase: action.phase };
        extraWrite = () => {
          this.ctx.storage.sql.exec(
            `INSERT INTO explanations (participant_id, phase, text, submitted_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(participant_id, phase)
             DO UPDATE SET text = excluded.text, submitted_at = excluded.submitted_at`,
            viewer.participantId!,
            action.phase,
            text,
            submittedAt,
          );
        };
        break;
      }
      case "SUBMIT_REFLECTION": {
        if (!viewer.participantId) throw new Error("FORBIDDEN: 教員は受講者の振り返りを代理提出できません。");
        const text = action.text.trim().slice(0, 3000);
        if (text.length < 10) throw new Error("BAD_REQUEST: 振り返りは10文字以上で入力してください。");
        const submittedAt = nowIso();
        eventType = "SUBMIT_EXPLANATION";
        summary = `${viewer.displayName}さんが振り返りを保存しました`;
        payload = { participantId: viewer.participantId, promptId: action.promptId };
        extraWrite = () => {
          this.ctx.storage.sql.exec(
            `INSERT INTO reflections (participant_id, prompt_id, response, submitted_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(participant_id, prompt_id)
             DO UPDATE SET response = excluded.response, submitted_at = excluded.submitted_at`,
            viewer.participantId!,
            action.promptId.slice(0, 80),
            text,
            submittedAt,
          );
        };
        break;
      }
      case "TEACHER_MESSAGE": {
        nextRoom.teacherMessage = action.text.trim().slice(0, 240);
        eventType = "TEACHER_MESSAGE";
        summary = "教員からチームへ指示が届きました";
        payload = { text: nextRoom.teacherMessage };
        break;
      }
    }

    const event = this.commitEvent(nextRoom, eventType, actor, summary, payload, extraWrite);
    return { event, roomVersion: nextRoom.version };
  }

  private assertActionAllowed(viewer: ViewerContext, room: StoredRoom, action: ClientAction): void {
    if (viewer.kind === "teacher") return;

    const role = viewer.role;
    if (!role) throw new Error("FORBIDDEN: 役割が設定されていません。");
    if (room.learningMode === "SOLO") {
      switch (action.type) {
        case "CHANGE_PHASE":
          if (action.phase !== "LOBBY") return;
          break;
        case "TOGGLE_LINK":
          if (room.phase === "TOPOLOGY") return;
          break;
        case "CONFIGURE_INTERFACE":
          if (room.phase === "ADDRESSING") return;
          break;
        case "ADVANCE_PROTOCOL":
        case "RESET_PROTOCOL":
          if (room.phase === "PROTOCOL") return;
          break;
        case "RUN_DIAGNOSTIC":
          if (["TOPOLOGY", "ADDRESSING", "PROTOCOL", "DIAGNOSIS"].includes(room.phase)) return;
          break;
        case "SUBMIT_EXPLANATION":
          if (action.phase === room.phase && ["TOPOLOGY", "ADDRESSING", "PROTOCOL", "DIAGNOSIS"].includes(room.phase)) return;
          break;
        case "SUBMIT_REFLECTION":
          if (room.phase === "REFLECTION") return;
          break;
        default:
          break;
      }
      throw new Error("FORBIDDEN: ひとり学習では、現在のステップで案内されている操作を行ってください。");
    }
    switch (action.type) {
      case "TOGGLE_LINK":
        if (room.phase === "TOPOLOGY" && ["ACCESS_POINT", "L2_SWITCH", "ROUTER"].includes(role)) return;
        break;
      case "CONFIGURE_INTERFACE":
        if (room.phase === "ADDRESSING" && role === "CLIENT_PC") return;
        break;
      case "ADVANCE_PROTOCOL": {
        const current = PROTOCOL_STEPS[room.protocolIndex];
        if (room.phase === "PROTOCOL" && current?.actorRole === role) return;
        break;
      }
      case "RUN_DIAGNOSTIC":
        if (["TOPOLOGY", "ADDRESSING", "PROTOCOL", "DIAGNOSIS"].includes(room.phase)) return;
        break;
      case "SUBMIT_EXPLANATION":
        if (action.phase === room.phase && ["TOPOLOGY", "ADDRESSING", "PROTOCOL", "DIAGNOSIS"].includes(room.phase)) return;
        break;
      case "SUBMIT_REFLECTION":
        if (room.phase === "REFLECTION") return;
        break;
      default:
        break;
    }
    throw new Error("FORBIDDEN: 現在のフェーズまたは担当役割では、この操作を実行できません。");
  }

  private commitEvent(
    room: StoredRoom,
    type: string,
    actor: string,
    summary: string,
    payload: Record<string, JsonValue>,
    extraWrite?: () => void,
  ): RoomEvent {
    const createdAt = nowIso();
    let eventId = 0;
    this.ctx.storage.transactionSync(() => {
      extraWrite?.();
      this.ctx.storage.sql.exec("UPDATE room_config SET state_json = ? WHERE id = 1", JSON.stringify(room));
      eventId = this.ctx.storage.sql
        .exec<{ id: number }>(
          `INSERT INTO events (room_version, type, actor, summary, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
          room.version,
          type,
          actor,
          summary,
          JSON.stringify(payload),
          createdAt,
        )
        .one().id;
      if (room.version % 10 === 0 || type === "CHANGE_PHASE") {
        this.ctx.storage.sql.exec(
          "INSERT OR REPLACE INTO snapshots (room_version, state_json, created_at) VALUES (?, ?, ?)",
          room.version,
          JSON.stringify(room),
          createdAt,
        );
      }
    });
    return { id: eventId, roomVersion: room.version, type, actor, summary, payload, createdAt };
  }

  private loadRoomOrNull(): StoredRoom | null {
    const row = this.ctx.storage.sql
      .exec<{ state_json: string }>("SELECT state_json FROM room_config WHERE id = 1")
      .toArray()[0];
    if (!row) return null;
    const parsed = JSON.parse(row.state_json) as StoredRoom;
    return { ...parsed, learningMode: parsed.learningMode ?? "CLASSROOM" };
  }

  private loadRoom(): StoredRoom {
    const room = this.loadRoomOrNull();
    if (!room) throw new Error("NOT_FOUND: 部屋が見つかりません。");
    return room;
  }

  private loadParticipants(): ParticipantRow[] {
    return this.ctx.storage.sql
      .exec<ParticipantRow>(
        `SELECT id, display_name, role, token_hash, connection_state, joined_at, last_seen_at
         FROM participants ORDER BY joined_at ASC`,
      )
      .toArray();
  }

  private loadParticipant(participantId: string): ParticipantRow | null {
    return (
      this.ctx.storage.sql
        .exec<ParticipantRow>(
          `SELECT id, display_name, role, token_hash, connection_state, joined_at, last_seen_at
           FROM participants WHERE id = ?`,
          participantId,
        )
        .toArray()[0] ?? null
    );
  }

  private loadLatestEvents(): RoomEvent[] {
    return this.ctx.storage.sql
      .exec<EventRow>(
        `SELECT id, room_version, type, actor, summary, payload_json, created_at
         FROM events ORDER BY id DESC LIMIT 60`,
      )
      .toArray()
      .reverse()
      .map(eventFromRow);
  }

  private loadAllEvents(): RoomEvent[] {
    return this.ctx.storage.sql
      .exec<EventRow>(
        `SELECT id, room_version, type, actor, summary, payload_json, created_at
         FROM events ORDER BY id ASC`,
      )
      .toArray()
      .map(eventFromRow);
  }

  private loadReflections(): ReflectionResponse[] {
    return this.ctx.storage.sql
      .exec<ReflectionRow>(
        "SELECT participant_id, prompt_id, response, submitted_at FROM reflections ORDER BY submitted_at ASC",
      )
      .toArray()
      .map((row) => ({
        participantId: row.participant_id,
        promptId: row.prompt_id,
        response: row.response,
        submittedAt: row.submitted_at,
      }));
  }

  private loadExplanations(): SharedExplanation[] {
    return this.ctx.storage.sql
      .exec<ExplanationRow>(
        `SELECT e.participant_id, p.display_name, e.phase, e.text, e.submitted_at
         FROM explanations e JOIN participants p ON p.id = e.participant_id
         ORDER BY e.submitted_at ASC`,
      )
      .toArray()
      .map((row) => ({
        participantId: row.participant_id,
        displayName: row.display_name,
        phase: row.phase,
        text: row.text,
        submittedAt: row.submitted_at,
      }));
  }

  private publicRoom(
    room: StoredRoom,
    participants: ParticipantPublic[],
    latestEvents: RoomEvent[],
    includeFaultDetails: boolean,
  ): RoomPublicState {
    return {
      code: room.code,
      title: room.title,
      learningMode: room.learningMode,
      phase: room.phase,
      scenario: room.scenario,
      status: room.status,
      version: room.version,
      capacity: room.capacity,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      teacherMessage: room.teacherMessage,
      participants,
      devices: structuredClone(DEVICES),
      links: structuredClone(room.links),
      interfaceConfig: structuredClone(room.interfaceConfig),
      protocolIndex: room.protocolIndex,
      activeFaults: includeFaultDetails ? structuredClone(room.activeFaults) : [],
      observedSymptoms: room.activeFaults.map((fault) => fault.symptom),
      diagnostics: structuredClone(room.diagnostics),
      latestEvents,
    };
  }

  private snapshotFor(viewer: ViewerContext): RoomSnapshot {
    const room = this.loadRoom();
    const participants = this.loadParticipants().map(participantFromRow);
    const allReflections = this.loadReflections();
    return {
      room: this.publicRoom(room, participants, this.loadLatestEvents(), viewer.kind === "teacher"),
      viewer,
      explanations: this.loadExplanations(),
      reflections:
        viewer.kind === "teacher"
          ? allReflections
          : allReflections.filter((reflection) => reflection.participantId === viewer.participantId),
    };
  }

  private async authorizeToken(token: string): Promise<ViewerContext> {
    if (token.length < 32 || token.length > 256) throw new Error("UNAUTHORIZED: 認証に失敗しました。");
    const room = this.loadRoom();
    const providedHash = await sha256Hex(token);
    if (safeEqualHash(providedHash, room.teacherTokenHash)) {
      return { kind: "teacher", displayName: "担当教員" };
    }

    const participant = this.loadParticipants().find((row) => safeEqualHash(providedHash, row.token_hash));
    if (!participant) throw new Error("UNAUTHORIZED: 認証に失敗しました。");
    return {
      kind: "participant",
      participantId: participant.id,
      displayName: participant.display_name,
      role: participant.role,
    };
  }

  private refreshParticipantViewer(participantId: string): ViewerContext {
    const participant = this.loadParticipant(participantId);
    if (!participant) throw new Error("UNAUTHORIZED: 参加者が見つかりません。");
    return {
      kind: "participant",
      participantId: participant.id,
      displayName: participant.display_name,
      role: participant.role,
    };
  }

  private updatePresence(participantId: string, state: "online" | "offline"): void {
    this.ctx.storage.sql.exec(
      "UPDATE participants SET connection_state = ?, last_seen_at = ? WHERE id = ?",
      state,
      nowIso(),
      participantId,
    );
    const message: SocketServerMessage = {
      type: "PRESENCE",
      participantId,
      connectionState: state,
    };
    this.broadcast(message);
  }

  private broadcastUpdate(event: RoomEvent): void {
    this.broadcast({ type: "ROOM_UPDATED", event, roomVersion: event.roomVersion });
  }

  private broadcast(message: SocketServerMessage): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(encoded);
      } catch (error) {
        console.error(
          JSON.stringify({ message: "websocket send failed", error: error instanceof Error ? error.message : String(error) }),
        );
      }
    }
  }
}
