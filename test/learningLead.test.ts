import { describe, expect, it } from "vitest";

import { learningLead } from "../src/shared/learningLead";
import type { PracticeMilestone } from "../src/shared/practice";
import type { CoreRoleId } from "../src/shared/rolePractice";
import { DEFAULT_LINKS, DEVICES, PHASE_DEFINITIONS, PROTOCOL_STEPS, REFLECTION_PROMPTS } from "../src/shared/scenario";
import type { RoomPublicState, RoomSnapshot } from "../src/shared/types";

const now = "2026-07-22T00:00:00.000Z";

function makeSnapshot(roomOverrides: Partial<RoomPublicState> = {}, snapshotOverrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  const room: RoomPublicState = {
    code: "ABC234",
    title: "ひとりで学ぶネットワーク",
    learningMode: "SOLO",
    phase: "ROLES",
    scenario: "STANDARD_WEB_ACCESS",
    status: "active",
    version: 1,
    capacity: 1,
    createdAt: now,
    expiresAt: now,
    teacherMessage: "案内",
    participants: [],
    devices: DEVICES,
    links: structuredClone(DEFAULT_LINKS),
    interfaceConfig: { address: "192.168.10.23", prefix: 24, gateway: "192.168.10.1", dns: "198.51.100.53" },
    protocolIndex: 0,
    activeFaults: [],
    observedSymptoms: [],
    diagnostics: [],
    latestEvents: [],
    ...roomOverrides,
  };
  return {
    room,
    viewer: { kind: "participant", participantId: "solo-1", displayName: "学習者", role: "CLIENT_PC" },
    reflections: [],
    explanations: [],
    ...snapshotOverrides,
  };
}

const practices = (...items: PracticeMilestone[]) => new Set<PracticeMilestone>(items);
const roles = (...items: CoreRoleId[]) => new Set<CoreRoleId>(items);

describe("beginner learning lead", () => {
  it("always provides a concrete, non-empty lead for every phase", () => {
    for (const phase of PHASE_DEFINITIONS) {
      const lead = learningLead(makeSnapshot({ phase: phase.id }), practices(), roles());
      expect(lead.title.length, phase.id).toBeGreaterThan(8);
      expect(lead.detail.length, phase.id).toBeGreaterThan(10);
      expect(lead.after.length, phase.id).toBeGreaterThan(8);
      if (lead.state !== "waiting") expect(lead.targetId, phase.id).toBeTruthy();
    }
  });

  it("leads topology practice through cut, ping, restore, and explanation in order", () => {
    const initial = makeSnapshot({ phase: "TOPOLOGY" });
    expect(learningLead(initial, practices(), roles()).targetId).toBe("topology-panel");

    const cut = makeSnapshot({
      phase: "TOPOLOGY",
      links: DEFAULT_LINKS.map((link, index) => index === 0 ? { ...link, up: false } : link),
      latestEvents: [{ id: 1, roomVersion: 2, type: "TOGGLE_LINK", actor: "学習者", summary: "切断", payload: {}, createdAt: now }],
    });
    expect(learningLead(cut, practices(), roles()).title).toContain("最初の出口まで届くか確かめる");
    expect(learningLead(cut, practices(), roles()).targetId).toBe("practice-lab");
    expect(learningLead(cut, practices("PING_GATEWAY"), roles()).title).toContain("元に戻します");

    const restored = makeSnapshot({ ...cut.room, links: structuredClone(DEFAULT_LINKS) });
    expect(learningLead(restored, practices("PING_GATEWAY"), roles()).title).toContain("1文");
  });

  it("points to each missing addressing check after the interface is saved", () => {
    const configured = makeSnapshot({
      phase: "ADDRESSING",
      latestEvents: [{ id: 1, roomVersion: 2, type: "CONFIGURE_INTERFACE", actor: "学習者", summary: "保存", payload: {}, createdAt: now }],
    });
    expect(learningLead(configured, practices(), roles()).title).toContain("PCのネットワーク設定を表示する");
    expect(learningLead(configured, practices("IPCONFIG"), roles()).title).toContain("最初の出口まで届くか確かめる");
  });

  it("identifies the active protocol step and advances reflection prompts", () => {
    const protocol = makeSnapshot({ phase: "PROTOCOL", protocolIndex: 7 });
    expect(learningLead(protocol, practices(), roles()).title).toContain("全17段階の8");
    expect(learningLead(protocol, practices(), roles()).title).toContain("通信カード");
    expect(learningLead(protocol, practices(), roles()).detail).toContain("クライアントPC");

    const reflection = makeSnapshot({ phase: "REFLECTION" });
    expect(learningLead(reflection, practices(), roles()).title).toContain("振り返り 1");
    const otherLearnerCompleted = makeSnapshot(
      { phase: "REFLECTION" },
      { reflections: REFLECTION_PROMPTS.map((prompt) => ({ participantId: "someone-else", promptId: prompt.id, response: "ほかの学習者の回答です。", submittedAt: now })) },
    );
    expect(learningLead(otherLearnerCompleted, practices(), roles()).title).toContain("振り返り 1");
    const completed = makeSnapshot(
      { phase: "REFLECTION", protocolIndex: PROTOCOL_STEPS.length },
      { reflections: REFLECTION_PROMPTS.map((prompt) => ({ participantId: "solo-1", promptId: prompt.id, response: "10文字以上の振り返りです。", submittedAt: now })) },
    );
    expect(learningLead(completed, practices(), roles()).state).toBe("complete");
    expect(learningLead(completed, practices(), roles()).title).toContain("学習完了");
  });

  it("keeps diagnosis guidance valid before and after choosing a local hypothesis", () => {
    const diagnosis = makeSnapshot({ phase: "DIAGNOSIS" });
    const lead = learningLead(diagnosis, practices(), roles());
    expect(lead.title).toContain("原因調査カード");
    expect(lead.detail).toContain("4候補");
    expect(lead.targetId).toBe("mission-panel");
  });
});
