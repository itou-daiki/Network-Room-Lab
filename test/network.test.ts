import { describe, expect, it } from "vitest";

import { isSameSubnet, simulateDiagnostic, validateInterfaceConfig } from "../src/shared/network";
import { DEFAULT_LINKS } from "../src/shared/scenario";
import type { ActiveFault } from "../src/shared/types";

describe("network learning model", () => {
  it("distinguishes local and remote IPv4 networks", () => {
    expect(isSameSubnet("192.168.10.23", "192.168.10.1", 24)).toBe(true);
    expect(isSameSubnet("192.168.10.23", "203.0.113.80", 24)).toBe(false);
    expect(isSameSubnet("10.1.15.8", "10.1.31.9", 19)).toBe(true);
  });

  it("rejects an off-subnet default gateway", () => {
    const errors = validateInterfaceConfig({
      address: "192.168.10.23",
      prefix: 24,
      gateway: "192.168.20.1",
      dns: "198.51.100.53",
    });
    expect(errors).toContain("PCとデフォルトゲートウェイが同じサブネットにありません。");
  });

  it("separates DNS failure from IP reachability", () => {
    const faults: ActiveFault[] = [
      {
        type: "DNS_DOWN",
        target: "dns",
        symptom: "IP直指定なら開きますがURLでは開きません。",
        injectedAt: "2026-07-22T00:00:00.000Z",
      },
    ];
    const lookup = simulateDiagnostic(
      "NSLOOKUP",
      "class.yamanashi.example",
      faults,
      "p_1",
      "2026-07-22T00:00:00.000Z",
      "diag_1",
    );
    const ping = simulateDiagnostic(
      "PING",
      "203.0.113.80",
      faults,
      "p_1",
      "2026-07-22T00:00:00.000Z",
      "diag_2",
    );
    expect(lookup.success).toBe(false);
    expect(ping.success).toBe(true);
  });

  it("reflects a learner-disconnected link in command output", () => {
    const links = DEFAULT_LINKS.map((link) => ({ ...link, up: link.id !== "ap-switch" }));
    const result = simulateDiagnostic(
      "PING",
      "192.168.10.1",
      [],
      "p_1",
      "2026-07-22T00:00:00.000Z",
      "diag_link",
      {
        links,
        interfaceConfig: { address: "192.168.10.23", prefix: 24, gateway: "192.168.10.1", dns: "198.51.100.53" },
      },
    );
    expect(result.success).toBe(false);
    expect(result.output.join(" ")).toContain("ap-switch");
  });

  it("lets ping reach a stopped web server while HTTPS still fails", () => {
    const faults: ActiveFault[] = [{ type: "WEB_DOWN", target: "web", symptom: "Web停止", injectedAt: "2026-07-22T00:00:00.000Z" }];
    const ping = simulateDiagnostic("PING", "203.0.113.80", faults, "p_1", "2026-07-22T00:00:00.000Z", "diag_ping");
    const https = simulateDiagnostic("HTTPS", "class.yamanashi.example", faults, "p_1", "2026-07-22T00:00:00.000Z", "diag_https");
    expect(ping.success).toBe(true);
    expect(https.success).toBe(false);
    expect(https.output.join(" ")).toContain("connection refused");
  });
});
