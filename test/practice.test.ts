import { describe, expect, it } from "vitest";

import {
  localPracticeOutput,
  parsePracticeCommand,
  protocolDecisionChoices,
} from "../src/shared/practice";
import { PROTOCOL_STEPS } from "../src/shared/scenario";

describe("experiential practice commands", () => {
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
