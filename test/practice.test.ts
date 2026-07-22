import { describe, expect, it } from "vitest";

import {
  PRACTICE_TASKS,
  localPracticeOutput,
  parsePracticeCommand,
  practiceTasksForTarget,
  protocolDecisionChoices,
} from "../src/shared/practice";
import { LEARNING_SCENARIO_GOAL, PROTOCOL_STEPS, learningScenarioGoal, protocolStepsForTarget } from "../src/shared/scenario";
import { NETWORK_GLOSSARY, networkGlossaryForTarget } from "../src/shared/glossary";
import { CORE_ROLE_IDS, ROLE_PRACTICES, ROLE_READING_GUIDES, ROLE_STAGE_TERM_IDS, rolePractice, rolePracticesForTarget } from "../src/shared/rolePractice";
import type { LearningTarget } from "../src/shared/types";

const customTarget: LearningTarget = {
  url: "https://example.com/course/start?unit=1",
  hostname: "example.com",
  requestTarget: "/course/start?unit=1",
  ipv4Addresses: ["93.184.216.34", "93.184.216.35"],
  primaryIpv4: "93.184.216.34",
  dnsTtl: 240,
  resolvedAt: "2026-07-23T00:00:00.000Z",
  resolver: "Cloudflare 1.1.1.1（DNS over HTTPS）",
};

describe("experiential practice commands", () => {
  it("provides one hands-on exercise with a single correct action for every core role", () => {
    expect(ROLE_PRACTICES.map((practice) => practice.role)).toEqual(CORE_ROLE_IDS);
    expect(new Set(ROLE_PRACTICES.map((practice) => practice.choices.findIndex((choice) => choice.correct))).size).toBe(3);

    for (const practice of ROLE_PRACTICES) {
      expect(practice.observations.length).toBeGreaterThanOrEqual(4);
      expect(practice.beginnerStory.length).toBeGreaterThan(20);
      expect(practice.everydayExample.length).toBeGreaterThan(20);
      expect(practice.observationPurpose.length).toBeGreaterThan(20);
      expect(practice.question).toContain("ために");
      expect(practice.decisionHint.length).toBeGreaterThan(20);
      expect(practice.choices).toHaveLength(3);
      expect(practice.choices.filter((choice) => choice.correct)).toHaveLength(1);
      expect(new Set(practice.choices.map((choice) => choice.id)).size).toBe(3);
      expect(practice.successOutput.length).toBeGreaterThanOrEqual(3);
      expect(practice.successOutput.join(" ")).not.toMatch(/who has/i);
      expect(practice.successMeanings).toHaveLength(practice.successOutput.length);
      expect(practice.explainPrompt.length).toBeGreaterThan(10);
      expect(practice.sentenceStarter.length).toBeGreaterThan(15);
      expect(practice.explainKeywords).toHaveLength(3);
      expect(practice.termIds.length).toBeGreaterThanOrEqual(3);
      for (const observation of practice.observations) {
        expect(observation.meaning.length).toBeGreaterThan(15);
      }
      for (const meaning of practice.successMeanings) {
        expect(meaning.length).toBeGreaterThan(10);
      }
      expect(ROLE_READING_GUIDES[practice.role]).toHaveLength(3);
      for (const guide of ROLE_READING_GUIDES[practice.role]) {
        expect(guide.target.length).toBeGreaterThan(3);
        expect(guide.reading.length).toBeGreaterThan(20);
        expect(guide.check.length).toBeGreaterThan(15);
      }
      for (const termId of practice.termIds) {
        expect(NETWORK_GLOSSARY.some((term) => term.id === termId), `${practice.role}: ${termId}`).toBe(true);
      }
      for (const [stage, termIds] of Object.entries(ROLE_STAGE_TERM_IDS[practice.role])) {
        expect(termIds.length, `${practice.role} stage ${stage}`).toBeGreaterThanOrEqual(3);
        for (const termId of termIds) {
          expect(NETWORK_GLOSSARY.some((term) => term.id === termId), `${practice.role} stage ${stage}: ${termId}`).toBe(true);
        }
      }
    }
    expect(rolePractice("OBSERVER")).toBeUndefined();
  });

  it("keeps the overall Web-site goal and beginner explanations visible in the learning data", () => {
    expect(LEARNING_SCENARIO_GOAL.title).toContain("文部科学省");
    expect(LEARNING_SCENARIO_GOAL.url).toBe("https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm");
    expect(LEARNING_SCENARIO_GOAL.detail).toContain("6つの機器");

    const pcPractice = rolePractice("CLIENT_PC");
    expect(pcPractice?.everydayExample).toContain("郵便局");
    expect(pcPractice?.observationTitle).toBe("PCのネットワーク設定");
    expect(pcPractice?.mission).toContain("このページをください");
    expect(pcPractice?.beginnerStory).toContain("Webページそのものではありません");
    expect(pcPractice?.beginnerStory).toContain("ページのデータをPCへ返します");
    expect(pcPractice?.situation).toContain("DNSへの問い合わせが終わり");
    expect(pcPractice?.successMeanings.join(" ")).toContain("このページをください");
    expect(pcPractice?.successOutput[0]).toContain("最初の渡し先をデフォルトゲートウェイ");
    expect(pcPractice?.successOutput[1]).toContain("PCがARPを使って送る問い合わせ");
    expect(pcPractice?.successOutput[2]).toContain("ルータからのARP応答");
    expect(pcPractice?.successMeanings.join(" ")).toContain("IPパケットの最終宛先はWebサーバのまま");
    expect(pcPractice?.observations.find((item) => item.value === "192.168.10.1")?.meaning).toContain("ルータのLAN側IPアドレス");
    expect(ROLE_STAGE_TERM_IDS.CLIENT_PC[1]).toContain("dns");
    expect(ROLE_STAGE_TERM_IDS.CLIENT_PC[1]).toContain("request-response");

    for (const task of PRACTICE_TASKS) {
      expect(task.purpose.length, task.id).toBeGreaterThan(20);
      expect(task.observation.length, task.id).toBeGreaterThan(15);
    }

    const frame = NETWORK_GLOSSARY.find((term) => term.id === "frame");
    expect(frame?.short).toContain("入れ物");
    expect(frame?.detail).toContain("PC");
    expect(frame?.detail).toContain("Wi-Fi");
    expect(frame?.detail).toContain("Ethernet");

    const learnerText = JSON.stringify({
      goal: LEARNING_SCENARIO_GOAL,
      practices: ROLE_PRACTICES,
      tasks: PRACTICE_TASKS,
      protocol: PROTOCOL_STEPS,
    });
    expect(learnerText).not.toContain("4つの値");
    expect(learnerText).not.toContain("結果の「つまり」");
    expect(learnerText).not.toMatch(/ARP who has/i);
  });

  it("materializes every learner-facing model with the selected URL and saved DNS result", () => {
    const learnerText = JSON.stringify({
      goal: learningScenarioGoal(customTarget),
      practices: rolePracticesForTarget(customTarget),
      tasks: practiceTasksForTarget(customTarget),
      protocol: protocolStepsForTarget(customTarget),
      glossary: networkGlossaryForTarget(customTarget),
    });

    expect(learnerText).toContain(customTarget.url);
    expect(learnerText).toContain(customTarget.hostname);
    expect(learnerText).toContain(customTarget.primaryIpv4);
    expect(learnerText).toContain("93.184.216.35");
    expect(learnerText).toContain("実際のDNS");
    expect(learnerText).not.toContain("203.0.113.80");
    expect(learnerText).not.toContain("www.mext.go.jp");
  });

  it("explains common abbreviations with their full names and detailed beginner context", () => {
    const expectedFullNames: Record<string, string> = {
      url: "Uniform Resource Locator",
      "ip-address": "Internet Protocol Address",
      "mac-address": "Media Access Control Address",
      arp: "Address Resolution Protocol",
      dns: "Domain Name System",
      ttl: "Time To Live",
      tcp: "Transmission Control Protocol",
      tls: "Transport Layer Security",
      http: "Hypertext Transfer Protocol",
      https: "Hypertext Transfer Protocol Secure",
      ssid: "Service Set Identifier",
    };

    for (const [id, fullName] of Object.entries(expectedFullNames)) {
      const term = NETWORK_GLOSSARY.find((item) => item.id === id);
      expect(term?.fullName, id).toContain(fullName);
      expect(term?.short.length, id).toBeGreaterThan(20);
      expect(term?.detail.length, id).toBeGreaterThan(50);
      expect(term?.example.length, id).toBeGreaterThan(20);
    }

    const arp = NETWORK_GLOSSARY.find((term) => term.id === "arp");
    expect(arp?.detail).toContain("Addressは");
    expect(arp?.detail).toContain("デフォルトゲートウェイ");
    expect(arp?.detail).toContain("質問に答えるサーバ名ではなく");
    expect(arp?.detail).toContain("コマンドではなく");
  });

  it("maps easy_Packet style commands to safe simulated diagnostics", () => {
    expect(parsePracticeCommand("nslookup www.mext.go.jp")).toMatchObject({
      kind: "DIAGNOSTIC",
      tool: "NSLOOKUP",
      target: "www.mext.go.jp",
      milestone: "NSLOOKUP",
    });
    expect(parsePracticeCommand("ping 192.168.10.1")).toMatchObject({
      kind: "DIAGNOSTIC",
      tool: "PING",
      milestone: "PING_GATEWAY",
    });
    expect(parsePracticeCommand("tracert 203.0.113.80")).toMatchObject({
      kind: "DIAGNOSTIC",
      tool: "TRACEROUTE",
    });
    expect(parsePracticeCommand("curl https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm")).toMatchObject({
      kind: "DIAGNOSTIC",
      tool: "HTTPS",
      target: "www.mext.go.jp",
    });
  });

  it("turns a URL-form mistake into a concrete correction hint", () => {
    const parsed = parsePracticeCommand("ping https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm");
    expect(parsed.kind).toBe("OUTPUT");
    if (parsed.kind !== "OUTPUT") return;
    expect(parsed.success).toBe(false);
    expect(parsed.lines.join(" ")).toContain("ping www.mext.go.jp");
  });

  it("shows the room interface configuration through ipconfig", () => {
    const result = localPracticeOutput("IPCONFIG", {
      address: "192.168.10.23",
      prefix: 24,
      gateway: "192.168.10.1",
      dns: "1.1.1.1",
    });
    expect(result.lines.join("\n")).toContain("192.168.10.23");
    expect(result.lines.join("\n")).toContain("192.168.10.1");
    expect(result.lines.join("\n")).toContain("1.1.1.1");
  });

  it("requires a correct decision at every protocol step", () => {
    for (const step of PROTOCOL_STEPS) {
      const choices = protocolDecisionChoices(step);
      expect(choices).toHaveLength(3);
      expect(choices.filter((choice) => choice.correct)).toHaveLength(1);
      expect(new Set(choices.map((choice) => choice.label)).size).toBe(3);
    }
    expect(PROTOCOL_STEPS[0]?.description).toContain("ルータのLAN側IPアドレス");
    expect(PROTOCOL_STEPS[0]?.layers.find((layer) => layer.id === "network")?.value).toContain("デフォルトゲートウェイ");
    expect(PROTOCOL_STEPS[0]?.layers.find((layer) => layer.id === "network")?.value).not.toContain("IPv4 192.168.10.23 →");
    expect(PROTOCOL_STEPS[0]?.layers.find((layer) => layer.id === "link")?.value).toContain("FF-FF-FF-FF-FF-FF");
    expect(PROTOCOL_STEPS[2]?.description).toContain("ブロードキャスト");
    expect(PROTOCOL_STEPS[3]?.description).toContain("学習モデルでは同じLAN内の繰り返しを省略");
    expect(PROTOCOL_STEPS[7]?.description).toContain("DNSの答え");
    expect(PROTOCOL_STEPS.at(-1)?.description).toContain("ブラウザがHTMLを読み取り");
  });
});
