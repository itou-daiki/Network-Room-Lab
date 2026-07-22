import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomSnapshot,
} from "../src/shared/types";
import { DEFAULT_TARGET_URL } from "../src/shared/learningTarget";

async function createTestRoom(capacity = 6, targetUrl = DEFAULT_TARGET_URL) {
  const response = await SELF.fetch("http://example.com/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "統合テスト授業",
      capacity,
      scenario: "STANDARD_WEB_ACCESS",
      learningMode: "CLASSROOM",
      targetUrl,
    }),
  });
  expect(response.status).toBe(201);
  return response.json<CreateRoomResponse>();
}

async function createSoloRoom() {
  const response = await SELF.fetch("http://example.com/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "ひとり学習テスト",
      capacity: 1,
      scenario: "STANDARD_WEB_ACCESS",
      learningMode: "SOLO",
      targetUrl: DEFAULT_TARGET_URL,
      displayName: "ひとり学習者",
    }),
  });
  expect(response.status).toBe(201);
  return response.json<CreateRoomResponse>();
}

async function join(code: string, displayName: string) {
  const response = await SELF.fetch(`http://example.com/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  expect(response.status).toBe(201);
  return response.json<JoinRoomResponse>();
}

async function snapshot(code: string, token: string) {
  const response = await SELF.fetch(`http://example.com/api/rooms/${code}/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  return response.json<RoomSnapshot>();
}

async function action(code: string, token: string, roomVersion: number, payload: object) {
  return SELF.fetch(`http://example.com/api/rooms/${code}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomVersion, action: payload }),
  });
}

describe("Network Room API", () => {
  it("stores the teacher-selected URL and a real public DNS A-record result", async () => {
    const room = await createTestRoom(4, "https://example.com/network/lesson?unit=1#start");
    const state = await snapshot(room.code, room.teacherToken);

    expect(room.learningTarget.hostname).toBe("example.com");
    expect(room.learningTarget.ipv4Addresses.length).toBeGreaterThan(0);
    expect(state.room.learningTarget.url).toBe("https://example.com/network/lesson?unit=1#start");
    expect(state.room.learningTarget.hostname).toBe("example.com");
    expect(state.room.learningTarget.requestTarget).toBe("/network/lesson?unit=1");
    expect(state.room.learningTarget.resolver).toContain("Cloudflare 1.1.1.1");
    expect(state.room.learningTarget.ipv4Addresses.length).toBeGreaterThan(0);
    expect(state.room.learningTarget.primaryIpv4).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
    expect(state.room.learningTarget.primaryIpv4).not.toBe("203.0.113.80");
    expect(state.room.devices.find((device) => device.id === "web")?.address).toBe(state.room.learningTarget.primaryIpv4);
  });

  it("accepts 2 to 6 learners per classroom room and rejects larger groups", async () => {
    const room = await createTestRoom(2);
    await join(room.code, "1人目");
    await join(room.code, "2人目");

    const fullResponse = await SELF.fetch(`http://example.com/api/rooms/${room.code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "3人目" }),
    });
    expect(fullResponse.status).toBe(409);

    const tooLargeResponse = await SELF.fetch("http://example.com/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "定員超過テスト",
        capacity: 7,
        scenario: "STANDARD_WEB_ACCESS",
        learningMode: "CLASSROOM",
      }),
    });
    expect(tooLargeResponse.status).toBe(400);
  });

  it("lets a small group share an unassigned device role without bypassing assigned roles", async () => {
    const room = await createTestRoom(2);
    const pc = await join(room.code, "PC担当");
    const accessPoint = await join(room.code, "AP担当");
    let state = await snapshot(room.code, room.teacherToken);

    let response = await action(room.code, room.teacherToken, state.room.version, {
      type: "CHANGE_PHASE",
      phase: "PROTOCOL",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, accessPoint.participantToken);
    response = await action(room.code, accessPoint.participantToken, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "PC担当がいる段階を代わりに進めようとしました。",
    });
    expect(response.status).toBe(403);

    state = await snapshot(room.code, pc.participantToken);
    response = await action(room.code, pc.participantToken, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "PC担当としてARPの操作を進めます。",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, pc.participantToken);
    response = await action(room.code, pc.participantToken, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "AP担当がいる段階を代わりに進めようとしました。",
    });
    expect(response.status).toBe(403);

    state = await snapshot(room.code, accessPoint.participantToken);
    response = await action(room.code, accessPoint.participantToken, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "AP担当として有線LANへ渡します。",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, pc.participantToken);
    response = await action(room.code, pc.participantToken, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "担当者がいないL2スイッチ役を班で進めます。",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, pc.participantToken);
    expect(state.room.protocolIndex).toBe(3);
  });

  it("shares a learner explanation with the other room participants", async () => {
    const room = await createTestRoom();
    const first = await join(room.code, "説明した人");
    const second = await join(room.code, "読んだ人");
    let state = await snapshot(room.code, room.teacherToken);

    let response = await action(room.code, room.teacherToken, state.room.version, {
      type: "CHANGE_PHASE",
      phase: "ADDRESSING",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, first.participantToken);
    response = await action(room.code, first.participantToken, state.room.version, {
      type: "SUBMIT_EXPLANATION",
      phase: "ADDRESSING",
      text: "IP設定を確認すると、通信前の間違いを切り分けられると分かりました。",
    });
    expect(response.status).toBe(200);

    const sharedState = await snapshot(room.code, second.participantToken);
    expect(sharedState.explanations).toEqual([
      expect.objectContaining({
        displayName: "説明した人",
        phase: "ADDRESSING",
        text: "IP設定を確認すると、通信前の間違いを切り分けられると分かりました。",
      }),
    ]);
  });

  it("lets a solo learner disconnect a link and verify the result with ping", async () => {
    const room = await createSoloRoom();
    const token = room.participantToken!;
    let state = await snapshot(room.code, token);

    let response = await action(room.code, token, state.room.version, { type: "CHANGE_PHASE", phase: "TOPOLOGY" });
    expect(response.status).toBe(200);
    state = await snapshot(room.code, token);

    response = await action(room.code, token, state.room.version, { type: "TOGGLE_LINK", linkId: "ap-switch" });
    expect(response.status).toBe(200);
    state = await snapshot(room.code, token);

    response = await action(room.code, token, state.room.version, { type: "RUN_DIAGNOSTIC", tool: "PING", target: "192.168.10.1" });
    expect(response.status).toBe(200);
    state = await snapshot(room.code, token);
    expect(state.room.diagnostics.at(-1)?.success).toBe(false);
    expect(state.room.diagnostics.at(-1)?.output.join(" ")).toContain("ap-switch");
  });

  it("lets one learner operate every role and progress at their own pace", async () => {
    const room = await createSoloRoom();
    expect(room.participantToken).toBeTruthy();
    const token = room.participantToken!;

    let state = await snapshot(room.code, token);
    expect(state.room.learningMode).toBe("SOLO");
    expect(state.room.phase).toBe("ROLES");
    expect(state.room.capacity).toBe(1);
    expect(state.room.participants).toHaveLength(1);

    let response = await action(room.code, token, state.room.version, {
      type: "CHANGE_PHASE",
      phase: "PROTOCOL",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, token);
    response = await action(room.code, token, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "PCとしてゲートウェイのMACアドレスを確認します。",
    });
    expect(response.status).toBe(200);

    state = await snapshot(room.code, token);
    response = await action(room.code, token, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "次は無線APとして有線LANへ橋渡しします。",
    });
    expect(response.status).toBe(200);
    state = await snapshot(room.code, token);
    expect(state.room.protocolIndex).toBe(2);

    response = await action(room.code, token, state.room.version, {
      type: "CHANGE_PHASE",
      phase: "DIAGNOSIS",
    });
    expect(response.status).toBe(200);
    state = await snapshot(room.code, token);
    expect(state.room.activeFaults).toEqual([]);
    expect(state.room.observedSymptoms).toHaveLength(1);
  });

  it("creates a room and assigns the six network roles in order", async () => {
    const room = await createTestRoom();
    const names = ["PC担当", "AP担当", "L2担当", "Router担当", "DNS担当", "Web担当"];
    const joins = [];
    for (const name of names) joins.push(await join(room.code, name));

    expect(joins.map((item) => item.role)).toEqual([
      "CLIENT_PC",
      "ACCESS_POINT",
      "L2_SWITCH",
      "ROUTER",
      "DNS_SERVER",
      "WEB_SERVER",
    ]);

    const state = await snapshot(room.code, room.teacherToken);
    expect(state.viewer.kind).toBe("teacher");
    expect(state.room.participants).toHaveLength(6);
    expect(state.room.latestEvents.at(-1)?.type).toBe("JOIN_ROOM");
  });

  it("enforces phase and role permissions for protocol progression", async () => {
    const room = await createTestRoom();
    const participant = await join(room.code, "PC担当");
    let state = await snapshot(room.code, room.teacherToken);

    const phaseResponse = await action(room.code, room.teacherToken, state.room.version, {
      type: "CHANGE_PHASE",
      phase: "PROTOCOL",
    });
    expect(phaseResponse.status).toBe(200);

    state = await snapshot(room.code, participant.participantToken);
    const advanceResponse = await action(room.code, participant.participantToken, state.room.version, {
      type: "ADVANCE_PROTOCOL",
      decision: "外部宛てなので、まずゲートウェイのMACアドレスをARPで問い合わせます。",
    });
    expect(advanceResponse.status).toBe(200);

    const after = await snapshot(room.code, participant.participantToken);
    expect(after.room.protocolIndex).toBe(1);
    expect(after.room.latestEvents.at(-1)?.type).toBe("CREATE_PACKET");
  });

  it("hides fault identities from learners while preserving observable symptoms", async () => {
    const room = await createTestRoom();
    const participant = await join(room.code, "診断担当");
    let teacherState = await snapshot(room.code, room.teacherToken);

    let response = await action(room.code, room.teacherToken, teacherState.room.version, {
      type: "CHANGE_PHASE",
      phase: "DIAGNOSIS",
    });
    expect(response.status).toBe(200);
    teacherState = await snapshot(room.code, room.teacherToken);

    response = await action(room.code, room.teacherToken, teacherState.room.version, {
      type: "INJECT_FAULT",
      faultType: "DNS_DOWN",
    });
    expect(response.status).toBe(200);

    const learnerState = await snapshot(room.code, participant.participantToken);
    expect(learnerState.room.activeFaults).toEqual([]);
    expect(learnerState.room.observedSymptoms).toContain("WebサーバのIPアドレスを指定すると届きますが、Webサイト名では届きません。");
  });

  it("rejects invalid bearer tokens", async () => {
    const room = await createTestRoom();
    const response = await SELF.fetch(`http://example.com/api/rooms/${room.code}/snapshot`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(response.status).toBe(401);
  });
});
