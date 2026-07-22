export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive;

export type LearningMode = "CLASSROOM" | "SOLO";

export type RoomPhase =
  | "LOBBY"
  | "ROLES"
  | "TOPOLOGY"
  | "ADDRESSING"
  | "PROTOCOL"
  | "DIAGNOSIS"
  | "REFLECTION";

export type RoleId =
  | "CLIENT_PC"
  | "ACCESS_POINT"
  | "L2_SWITCH"
  | "ROUTER"
  | "DNS_SERVER"
  | "WEB_SERVER"
  | "OBSERVER";

export type DeviceType =
  | "pc"
  | "access-point"
  | "switch"
  | "router"
  | "internet"
  | "dns"
  | "web";

export type FaultType =
  | "AP_DOWN"
  | "CABLE_CUT"
  | "BAD_GATEWAY"
  | "DNS_DOWN"
  | "ROUTE_MISSING"
  | "CERT_ERROR"
  | "WEB_DOWN";

export type DiagnosticTool = "PING" | "NSLOOKUP" | "TRACEROUTE" | "HTTPS";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  shortLabel: string;
  description: string;
  observes: string[];
  accent: string;
}

export interface PhaseDefinition {
  id: RoomPhase;
  index: number;
  label: string;
  shortLabel: string;
  instruction: string;
}

export interface DeviceDefinition {
  id: string;
  type: DeviceType;
  label: string;
  role: RoleId | null;
  address?: string;
}

export interface TopologyLink {
  id: string;
  from: string;
  to: string;
  medium: "Wi-Fi" | "Ethernet" | "仮想WAN";
  up: boolean;
}

export interface InterfaceConfig {
  address: string;
  prefix: number;
  gateway: string;
  dns: string;
}

export interface ProtocolLayer {
  id: "application" | "security" | "transport" | "network" | "link";
  label: string;
  value: string;
  visibleTo: RoleId[];
}

export interface ProtocolStep {
  id: string;
  index: number;
  protocol: "ARP" | "DNS" | "TCP" | "TLS" | "HTTPS";
  title: string;
  description: string;
  actorRole: RoleId;
  nodeId: string;
  eventType: "CREATE_PACKET" | "FORWARD_PACKET" | "CHANGE_PROTOCOL";
  layers: ProtocolLayer[];
  ttl: number;
}

export interface ActiveFault {
  type: FaultType;
  target: string;
  symptom: string;
  injectedAt: string;
}

export interface DiagnosticResult {
  id: string;
  tool: DiagnosticTool;
  target: string;
  success: boolean;
  output: string[];
  inference: string;
  createdAt: string;
  actorId: string;
}

export interface ParticipantPublic {
  id: string;
  displayName: string;
  role: RoleId;
  connectionState: "online" | "offline";
  joinedAt: string;
  lastSeenAt: string;
}

export interface RoomEvent {
  id: number;
  roomVersion: number;
  type: string;
  actor: string;
  summary: string;
  payload: Record<string, JsonValue>;
  createdAt: string;
}

export interface ReflectionResponse {
  participantId: string;
  promptId: string;
  response: string;
  submittedAt: string;
}

export interface SharedExplanation {
  participantId: string;
  displayName: string;
  phase: RoomPhase;
  text: string;
  submittedAt: string;
}

export interface RoomPublicState {
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
  teacherMessage: string;
  participants: ParticipantPublic[];
  devices: DeviceDefinition[];
  links: TopologyLink[];
  interfaceConfig: InterfaceConfig;
  protocolIndex: number;
  activeFaults: ActiveFault[];
  observedSymptoms: string[];
  diagnostics: DiagnosticResult[];
  latestEvents: RoomEvent[];
}

export interface ViewerContext {
  kind: "teacher" | "participant";
  participantId?: string;
  displayName: string;
  role?: RoleId;
}

export interface RoomSnapshot {
  room: RoomPublicState;
  viewer: ViewerContext;
  reflections: ReflectionResponse[];
  explanations: SharedExplanation[];
}

export interface CreateRoomRequest {
  title: string;
  capacity: number;
  scenario: "STANDARD_WEB_ACCESS";
  learningMode: LearningMode;
  displayName?: string;
}

export interface CreateRoomResponse {
  code: string;
  teacherToken: string;
  expiresAt: string;
  participantId?: string;
  participantToken?: string;
}

export interface JoinRoomRequest {
  displayName: string;
}

export interface JoinRoomResponse {
  code: string;
  participantId: string;
  participantToken: string;
  role: RoleId;
}

export type ClientAction =
  | { type: "CHANGE_PHASE"; phase: RoomPhase }
  | { type: "ASSIGN_ROLE"; participantId: string; role: RoleId }
  | { type: "TOGGLE_LINK"; linkId: string }
  | {
      type: "CONFIGURE_INTERFACE";
      address: string;
      prefix: number;
      gateway: string;
      dns: string;
    }
  | { type: "ADVANCE_PROTOCOL"; decision: string }
  | { type: "RESET_PROTOCOL" }
  | { type: "INJECT_FAULT"; faultType: FaultType }
  | { type: "CLEAR_FAULT"; faultType?: FaultType }
  | { type: "RUN_DIAGNOSTIC"; tool: DiagnosticTool; target: string }
  | { type: "SUBMIT_EXPLANATION"; phase: RoomPhase; text: string }
  | { type: "SUBMIT_REFLECTION"; promptId: string; text: string }
  | { type: "TEACHER_MESSAGE"; text: string };

export interface ActionEnvelope {
  roomVersion: number;
  action: ClientAction;
}

export type SocketClientMessage =
  | {
      type: "ACTION";
      requestId: string;
      roomVersion: number;
      action: ClientAction;
    }
  | { type: "PING"; lastEventId: number };

export type SocketServerMessage =
  | { type: "SNAPSHOT"; snapshot: RoomSnapshot }
  | { type: "ROOM_UPDATED"; event: RoomEvent; roomVersion: number }
  | {
      type: "PRESENCE";
      participantId: string;
      connectionState: "online" | "offline";
    }
  | { type: "ACK"; requestId: string; roomVersion: number }
  | { type: "PONG"; roomVersion: number }
  | { type: "ERROR"; requestId?: string; message: string; roomVersion?: number };

export interface ApiErrorBody {
  error: string;
  requestId?: string;
  details?: string[];
}

export interface RoomExportData {
  room: Omit<RoomPublicState, "latestEvents">;
  events: RoomEvent[];
  reflections: ReflectionResponse[];
  explanations: SharedExplanation[];
}
