import { describe, expect, it } from "vitest";

import {
  localPracticeOutput,
  parsePracticeCommand,
  protocolDecisionChoices,
} from "../src/shared/practice";
import { PROTOCOL_STEPS } from "../src/shared/scenario";
import { NETWORK_GLOSSARY } from "../src/shared/glossary";
import { CORE_ROLE_IDS, ROLE_PRACTICES, ROLE_READING_GUIDES, rolePractice } from "../src/shared/rolePractice";

describe("experiential practice commands", () => {
  it("provides one hands-on exercise with a single correct action for every core role", () => {
    expect(ROLE_PRACTICES.map((practice) => practice.role)).toEqual(CORE_ROLE_IDS);
    expect(new Set(ROLE_PRACTICES.map((practice) => practice.choices.findIndex((choice) => choice.correct))).size).toBe(3);

    for (const practice of ROLE_PRACTICES) {
      expect(practice.observations.length).toBeGreaterThanOrEqual(4);
      expect(practice.choices).toHaveLength(3);
      expect(practice.choices.filter((choice) => choice.correct)).toHaveLength(1);
      expect(new Set(practice.choices.map((choice) => choice.id)).size).toBe(3);
      expect(practice.successOutput.length).toBeGreaterThanOrEqual(3);
      expect(practice.explainPrompt.length).toBeGreaterThan(10);
      expect(practice.termIds.length).toBeGreaterThanOrEqual(3);
      expect(ROLE_READING_GUIDES[practice.role]).toHaveLength(3);
      for (const guide of ROLE_READING_GUIDES[practice.role]) {
        expect(guide.target.length).toBeGreaterThan(3);
        expect(guide.reading.length).toBeGreaterThan(20);
        expect(guide.check.length).toBeGreaterThan(15);
      }
      for (const termId of practice.termIds) {
        expect(NETWORK_GLOSSARY.some((term) => term.id === termId), `${practice.role}: ${termId}`).toBe(true);
      }
    }
    expect(rolePractice("OBSERVER")).toBeUndefined();
  });

  it("maps easy_Packet style commands to safe simulated diagnostics", () => {
    expect(parsePracticeCommand("nslookup class.yamanashi.example")).toMatchObject({
      kind: "DIAGNOSTIC",
      tool: "NSLOOKUP",
      target: "class.yamanashi.example",
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
    expect(parsePracticeCommand("curl https://class.yamanashi.example/lesson")).toMatchObject({
      kind: "DIAGNOSTIC",
      tool: "HTTPS",
      target: "class.yamanashi.example",
    });
  });

  it("turns a URL-form mistake into a concrete correction hint", () => {
    const parsed = parsePracticeCommand("ping https://class.yamanashi.example/lesson");
    expect(parsed.kind).toBe("OUTPUT");
    if (parsed.kind !== "OUTPUT") return;
    expect(parsed.success).toBe(false);
    expect(parsed.lines.join(" ")).toContain("ping class.yamanashi.example");
  });

  it("shows the room interface configuration through ipconfig", () => {
    const result = localPracticeOutput("IPCONFIG", {
      address: "192.168.10.23",
      prefix: 24,
      gateway: "192.168.10.1",
      dns: "198.51.100.53",
    });
    expect(result.lines.join("\n")).toContain("192.168.10.23");
    expect(result.lines.join("\n")).toContain("192.168.10.1");
    expect(result.lines.join("\n")).toContain("198.51.100.53");
  });

  it("requires a correct decision at every protocol step", () => {
    for (const step of PROTOCOL_STEPS) {
      const choices = protocolDecisionChoices(step);
      expect(choices).toHaveLength(3);
      expect(choices.filter((choice) => choice.correct)).toHaveLength(1);
      expect(new Set(choices.map((choice) => choice.label)).size).toBe(3);
    }
  });
});
